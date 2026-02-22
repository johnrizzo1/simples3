import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { S3Bucket, S3Endpoint, S3Object, ConflictItem, DiskSpaceInfo } from "../types/models";
import { FileItem } from "./FileItem";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { InputDialog } from "./InputDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { ConflictDialog } from "./ConflictDialog";
import { useClipboard } from "../contexts/ClipboardContext";
import {
  Home,
  ArrowUp,
  RefreshCw,
  Database,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  FolderPlus,
  Copy,
  Clipboard,
} from "lucide-react";

type ViewMode = "buckets" | "objects";

interface BreadcrumbPart {
  name: string;
  prefix: string;
}

interface S3PaneProps {
  initialBucket?: string;
  initialPrefix?: string;
  refreshKey?: number;
  endpoints?: S3Endpoint[];
  onEndpointChange?: (endpointId: string) => void;
}

export function S3Pane({ initialBucket, initialPrefix, refreshKey, endpoints, onEndpointChange }: S3PaneProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("buckets");
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [currentBucket, setCurrentBucket] = useState<string>("");
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [selectedBucket, setSelectedBucket] = useState<S3Bucket | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<S3Object[]>([]);
  const [anchorObject, setAnchorObject] = useState<S3Object | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [inputDialog, setInputDialog] = useState<{ title: string; label: string; defaultValue?: string; onConfirm: (value: string) => void } | null>(null);
  const { clipboard, setClipboard } = useClipboard();

  // Promise-based input dialog helper
  const inputResolveRef = useRef<((value: string | null) => void) | null>(null);

  const showInput = useCallback((title: string, label: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      inputResolveRef.current = resolve;
      setInputDialog({
        title,
        label,
        defaultValue,
        onConfirm: (value) => {
          setInputDialog(null);
          inputResolveRef.current = null;
          resolve(value);
        },
      });
    });
  }, []);

  const cancelInput = useCallback(() => {
    setInputDialog(null);
    if (inputResolveRef.current) {
      inputResolveRef.current(null);
      inputResolveRef.current = null;
    }
  }, []);

  // Promise-based confirm dialog helper
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback((title: string, msg: string): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        title,
        message: msg,
        onConfirm: () => {
          setConfirmDialog(null);
          confirmResolveRef.current = null;
          resolve(true);
        },
      });
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmDialog(null);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
  }, []);

  // Promise-based conflict dialog helper
  const [conflictDialog, setConflictDialog] = useState<{ conflicts: ConflictItem[]; onResolve: (items: ConflictItem[]) => void } | null>(null);
  const conflictResolveRef = useRef<((items: ConflictItem[] | null) => void) | null>(null);

  const showConflicts = useCallback((conflicts: ConflictItem[]): Promise<ConflictItem[] | null> => {
    return new Promise((resolve) => {
      conflictResolveRef.current = resolve;
      setConflictDialog({
        conflicts,
        onResolve: (items) => {
          setConflictDialog(null);
          conflictResolveRef.current = null;
          resolve(items);
        },
      });
    });
  }, []);

  const cancelConflicts = useCallback(() => {
    setConflictDialog(null);
    if (conflictResolveRef.current) {
      conflictResolveRef.current(null);
      conflictResolveRef.current = null;
    }
  }, []);

  // Resolve ~ in paths to the actual home directory
  const resolvePath = async (path: string): Promise<string> => {
    if (path.startsWith("~/") || path === "~") {
      const home = await invoke<string>("get_home_directory");
      return path.replace("~", home);
    }
    return path;
  };

  // Load buckets on mount, or when endpoint changes (refreshKey)
  useEffect(() => {
    if (refreshKey === 0 && initialBucket) {
      loadObjects(initialBucket, initialPrefix || "");
    } else {
      setViewMode("buckets");
      loadBuckets();
    }
  }, [refreshKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 - Refresh
      if (e.key === "F5") {
        e.preventDefault();
        if (viewMode === "buckets") {
          loadBuckets();
        } else {
          loadObjects(currentBucket, currentPrefix);
        }
      }
      // Delete - Delete selected objects
      if (e.key === "Delete" && viewMode === "objects" && selectedObjects.length > 0) {
        e.preventDefault();
        const objectsToDelete = [...selectedObjects];
        const count = objectsToDelete.length;
        const names = objectsToDelete.slice(0, 5).map((o) => o.key).join("\n");
        const suffix = count > 5 ? `\n...and ${count - 5} more` : "";
        showConfirm("Confirm Delete", `Delete ${count} item(s)?\n${names}${suffix}`).then(async (confirmed) => {
          if (!confirmed) return;
          const results = await Promise.allSettled(
            objectsToDelete.map((obj) =>
              obj.is_prefix
                ? invoke("delete_s3_prefix", { bucket: obj.bucket, prefix: obj.key })
                : invoke("delete_s3_object", { bucket: obj.bucket, key: obj.key })
            )
          );
          const failures = results.filter((r) => r.status === "rejected");
          if (failures.length > 0) {
            await message(`${failures.length} of ${count} deletion(s) failed.`, { title: "Error", kind: "error" });
          }
          loadObjects(currentBucket, currentPrefix);
          setSelectedObjects([]);
          setAnchorObject(null);
        });
      }
      // Ctrl/Cmd + D - Download selected objects
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && viewMode === "objects" && selectedObjects.length > 0) {
        e.preventDefault();
        const downloadable = selectedObjects.filter((o) => !o.is_prefix);
        if (downloadable.length === 0) return;
        (async () => {
          const localDirInput = await showInput("Download from S3", "Local directory:", "~/Downloads");
          if (!localDirInput) return;
          const localDir = await resolvePath(localDirInput);
          Promise.allSettled(
            downloadable.map((obj) => {
              const fileName = obj.key.split("/").pop() || "download";
              return invoke<string>("download_file", {
                bucket: obj.bucket,
                s3Key: obj.key,
                localPath: `${localDir}/${fileName}`,
              });
            })
          ).then(async (results) => {
            const failures = results.filter((r) => r.status === "rejected");
            if (failures.length > 0) {
              await message(`${failures.length} of ${downloadable.length} download(s) failed to queue.`, { title: "Error", kind: "error" });
            }
          });
        })();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, selectedObjects, selectedBucket, currentBucket, currentPrefix]);

  const loadBuckets = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<S3Bucket[]>("list_buckets");
      setBuckets(result);
      setViewMode("buckets");
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const loadObjects = async (bucket: string, prefix: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<S3Object[]>("list_objects", {
        bucket,
        prefix: prefix || null,
      });
      setObjects(result);
      setCurrentBucket(bucket);
      setCurrentPrefix(prefix);
      setViewMode("objects");
      setSelectedObjects([]);
      setAnchorObject(null);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleBucketClick = (bucket: S3Bucket) => {
    setSelectedBucket(bucket);
  };

  const handleBucketDoubleClick = (bucket: S3Bucket) => {
    loadObjects(bucket.name);
  };

  const handleObjectClick = (object: S3Object, shiftKey: boolean) => {
    if (shiftKey && anchorObject) {
      const anchorIndex = objects.findIndex((o) => o.key === anchorObject.key);
      const clickedIndex = objects.findIndex((o) => o.key === object.key);

      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        setSelectedObjects(objects.slice(start, end + 1));
      }
    } else {
      setSelectedObjects([object]);
      setAnchorObject(object);
    }
  };

  const handleObjectDoubleClick = (object: S3Object) => {
    if (object.is_prefix) {
      loadObjects(currentBucket, object.key);
    }
  };

  const handleBackToBuckets = () => {
    setViewMode("buckets");
    setCurrentBucket("");
    setCurrentPrefix("");
    setSelectedObjects([]);
    setAnchorObject(null);
    setSelectedBucket(null);
  };

  const handleParentFolder = () => {
    const parts = currentPrefix.split("/").filter((p) => p);
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
    loadObjects(currentBucket, newPrefix);
  };

  const handleRefresh = () => {
    if (viewMode === "buckets") {
      loadBuckets();
    } else {
      loadObjects(currentBucket, currentPrefix);
    }
  };

  // Check disk space before downloads and warn if insufficient
  const checkDiskSpace = async (localDir: string, totalSize: number): Promise<boolean> => {
    try {
      const diskInfo = await invoke<DiskSpaceInfo>("get_disk_space", { path: localDir });
      if (totalSize > diskInfo.available_bytes) {
        const needed = (totalSize / 1024 / 1024).toFixed(1);
        const available = (diskInfo.available_bytes / 1024 / 1024).toFixed(1);
        const ok = await showConfirm(
          "Low Disk Space",
          `Download requires ~${needed} MB but only ${available} MB is available. Continue anyway?`
        );
        return ok;
      }
    } catch {
      // If disk space check fails, continue anyway
    }
    return true;
  };

  // Check for local file conflicts before downloading
  const checkLocalConflicts = async (files: Array<{ localPath: string; name: string }>): Promise<Array<{ localPath: string; name: string }> | null> => {
    const conflicts: ConflictItem[] = [];
    for (const file of files) {
      try {
        const exists = await invoke<boolean>("check_local_file_exists", { path: file.localPath });
        if (exists) {
          conflicts.push({ name: file.name, path: file.localPath, resolution: "overwrite" });
        }
      } catch {
        // If check fails, assume no conflict
      }
    }

    if (conflicts.length === 0) return files;

    const resolved = await showConflicts(conflicts);
    if (!resolved) return null;

    // Apply resolutions
    const result: Array<{ localPath: string; name: string }> = [];
    const conflictPaths = new Set(resolved.map((c) => c.path));

    // Add non-conflicting files
    for (const file of files) {
      if (!conflictPaths.has(file.localPath)) {
        result.push(file);
      }
    }

    // Add resolved conflicts
    for (const item of resolved) {
      if (item.resolution === "skip") continue;
      if (item.resolution === "rename" && item.newName) {
        const dir = item.path.substring(0, item.path.lastIndexOf("/"));
        result.push({ localPath: `${dir}/${item.newName}`, name: item.newName });
      } else {
        // overwrite
        result.push({ localPath: item.path, name: item.name });
      }
    }

    return result;
  };

  const handleDownload = async () => {
    const downloadable = selectedObjects.filter((o) => !o.is_prefix);
    if (downloadable.length === 0) {
      await message("Please select one or more files to download", { title: "No Files Selected" });
      return;
    }

    if (downloadable.length === 1) {
      const obj = downloadable[0];
      const fileName = obj.key.split("/").pop() || "download";
      const localPathInput = await showInput("Download from S3", "Local path:", `~/Downloads/${fileName}`);
      if (!localPathInput) return;
      const localPath = await resolvePath(localPathInput);

      // Disk space check
      const spaceOk = await checkDiskSpace(localPath, obj.size);
      if (!spaceOk) return;

      // Conflict check
      const resolved = await checkLocalConflicts([{ localPath, name: fileName }]);
      if (!resolved || resolved.length === 0) return;

      try {
        await invoke<string>("download_file", {
          bucket: obj.bucket,
          s3Key: obj.key,
          localPath: resolved[0].localPath,
        });
      } catch (err) {
        await message(`Download failed: ${err}`, { title: "Error", kind: "error" });
      }
    } else {
      const localDirInput = await showInput("Download from S3", "Local directory:", "~/Downloads");
      if (!localDirInput) return;
      const localDir = await resolvePath(localDirInput);

      // Disk space check
      const totalSize = downloadable.reduce((sum, o) => sum + o.size, 0);
      const spaceOk = await checkDiskSpace(localDir, totalSize);
      if (!spaceOk) return;

      // Build file list and check conflicts
      const fileList = downloadable.map((obj) => {
        const fileName = obj.key.split("/").pop() || "download";
        return { localPath: `${localDir}/${fileName}`, name: fileName, s3Key: obj.key, bucket: obj.bucket };
      });

      const resolved = await checkLocalConflicts(fileList.map((f) => ({ localPath: f.localPath, name: f.name })));
      if (!resolved) return;

      // Match resolved paths back to S3 keys
      const resolvedPaths = new Map(resolved.map((r) => [r.name, r.localPath]));
      const toDownload = fileList
        .filter((f) => resolvedPaths.has(f.name))
        .map((f) => ({ ...f, localPath: resolvedPaths.get(f.name)! }));

      const results = await Promise.allSettled(
        toDownload.map((f) =>
          invoke<string>("download_file", {
            bucket: f.bucket,
            s3Key: f.s3Key,
            localPath: f.localPath,
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        await message(`${failures.length} of ${toDownload.length} download(s) failed to queue.`, { title: "Error", kind: "error" });
      }
    }
  };

  const handleDelete = async () => {
    if (selectedObjects.length === 0) {
      await message("Please select one or more items to delete", { title: "No Items Selected" });
      return;
    }

    const count = selectedObjects.length;
    const names = selectedObjects.slice(0, 5).map((o) => o.key).join("\n");
    const suffix = count > 5 ? `\n...and ${count - 5} more` : "";
    const confirmed = await showConfirm("Confirm Delete", `Delete ${count} item(s)?\n${names}${suffix}`);
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedObjects.map((obj) =>
        obj.is_prefix
          ? invoke("delete_s3_prefix", { bucket: obj.bucket, prefix: obj.key })
          : invoke("delete_s3_object", { bucket: obj.bucket, key: obj.key })
      )
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      await message(`${failures.length} of ${count} deletion(s) failed.`, { title: "Error", kind: "error" });
    }
    await loadObjects(currentBucket, currentPrefix);
    setSelectedObjects([]);
    setAnchorObject(null);
  };

  // Drag and drop handlers
  const handleObjectDragStart = (e: React.DragEvent, object: S3Object) => {
    const isInSelection = selectedObjects.some((s) => s.key === object.key);
    const objectsToDrag = isInSelection ? selectedObjects : [object];

    if (!isInSelection) {
      setSelectedObjects([object]);
      setAnchorObject(object);
    }

    const dragData = objectsToDrag.map((o) => ({
      bucket: o.bucket,
      key: o.key,
      is_prefix: o.is_prefix,
    }));

    e.dataTransfer.setData("application/x-simples3-s3", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (viewMode === "objects" && e.dataTransfer.types.includes("application/x-simples3-local")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  // Check for S3 object conflicts before uploading
  const checkS3Conflicts = async (files: Array<{ name: string; s3Key: string; localPath: string; is_directory: boolean }>): Promise<Array<{ name: string; s3Key: string; localPath: string; is_directory: boolean }> | null> => {
    const fileItems = files.filter((f) => !f.is_directory);
    const conflicts: ConflictItem[] = [];

    for (const file of fileItems) {
      try {
        const exists = await invoke<boolean>("check_object_exists", { bucket: currentBucket, key: file.s3Key });
        if (exists) {
          conflicts.push({ name: file.name, path: file.s3Key, resolution: "overwrite" });
        }
      } catch {
        // If check fails, assume no conflict
      }
    }

    if (conflicts.length === 0) return files;

    const resolved = await showConflicts(conflicts);
    if (!resolved) return null;

    const result: Array<{ name: string; s3Key: string; localPath: string; is_directory: boolean }> = [];
    const conflictKeys = new Set(resolved.map((c) => c.path));

    // Add non-conflicting items (including directories)
    for (const file of files) {
      if (!conflictKeys.has(file.s3Key)) {
        result.push(file);
      }
    }

    // Add resolved conflicts
    for (const item of resolved) {
      if (item.resolution === "skip") continue;
      const original = fileItems.find((f) => f.s3Key === item.path);
      if (!original) continue;
      if (item.resolution === "rename" && item.newName) {
        const prefix = item.path.substring(0, item.path.lastIndexOf("/") + 1);
        result.push({ ...original, s3Key: `${prefix}${item.newName}`, name: item.newName });
      } else {
        result.push(original);
      }
    }

    return result;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (viewMode !== "objects") return;

    const localData = e.dataTransfer.getData("application/x-simples3-local");
    if (!localData) return;

    try {
      const parsed = JSON.parse(localData);
      const draggedItems: Array<{ path: string; name: string; is_directory: boolean }> =
        Array.isArray(parsed) ? parsed : [parsed];

      // Build upload items with S3 keys
      const uploadItems = draggedItems.map((item) => ({
        name: item.name,
        s3Key: item.is_directory
          ? (currentPrefix ? `${currentPrefix}${item.name}/` : `${item.name}/`)
          : (currentPrefix ? `${currentPrefix}${item.name}` : item.name),
        localPath: item.path,
        is_directory: item.is_directory,
      }));

      // Check for conflicts on non-directory items
      const resolved = await checkS3Conflicts(uploadItems);
      if (!resolved) return;

      for (const item of resolved) {
        if (item.is_directory) {
          await invoke<string[]>("upload_directory", {
            localPath: item.localPath,
            bucket: currentBucket,
            s3Prefix: item.s3Key,
          });
        } else {
          await invoke<string>("upload_file", {
            localPath: item.localPath,
            bucket: currentBucket,
            s3Key: item.s3Key,
          });
        }
      }

      setTimeout(() => loadObjects(currentBucket, currentPrefix), 1000);
    } catch (err) {
      await message(`Upload failed: ${err}`, { title: "Error", kind: "error" });
    }
  };

  // Context menu handlers
  const handleBlankContextMenu = (e: React.MouseEvent) => {
    if (viewMode !== "objects") return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: "New Folder",
          icon: <FolderPlus className="w-4 h-4" />,
          onClick: async () => {
            const name = await showInput("New Folder", "Folder name:");
            if (!name) return;
            try {
              const folderKey = currentPrefix ? `${currentPrefix}${name}/` : `${name}/`;
              await invoke("upload_file", {
                localPath: "/dev/null",
                bucket: currentBucket,
                s3Key: folderKey,
              });
              setTimeout(() => loadObjects(currentBucket, currentPrefix), 1000);
            } catch (err) {
              await message(`Failed to create folder: ${err}`, { title: "Error", kind: "error" });
            }
          },
        },
        {
          label: "Paste",
          icon: <Clipboard className="w-4 h-4" />,
          disabled: !clipboard,
          onClick: async () => {
            if (!clipboard) return;
            try {
              if (clipboard.source === "local") {
                for (const item of clipboard.items) {
                  if (item.is_directory) {
                    const s3Prefix = currentPrefix ? `${currentPrefix}${item.name}/` : `${item.name}/`;
                    await invoke<string[]>("upload_directory", {
                      localPath: item.path,
                      bucket: currentBucket,
                      s3Prefix,
                    });
                  } else {
                    const s3Key = currentPrefix ? `${currentPrefix}${item.name}` : item.name;
                    await invoke<string>("upload_file", {
                      localPath: item.path,
                      bucket: currentBucket,
                      s3Key,
                    });
                  }
                }
              } else {
                // S3 to S3 copy
                for (const item of clipboard.items) {
                  if (item.is_prefix) {
                    // Copy all objects under this prefix
                    const objects = await invoke<S3Object[]>("list_objects", {
                      bucket: item.bucket,
                      prefix: item.key,
                    });
                    const folderName = item.key.split("/").filter((p: string) => p).pop() || "";
                    for (const obj of objects) {
                      if (obj.key.endsWith("/")) continue;
                      const relativePart = obj.key.slice(item.key.length);
                      const destKey = currentPrefix ? `${currentPrefix}${folderName}/${relativePart}` : `${folderName}/${relativePart}`;
                      await invoke("copy_s3_object", {
                        bucket: currentBucket,
                        sourceKey: obj.key,
                        destKey,
                      });
                    }
                  } else {
                    const fileName = item.key.split("/").pop() || item.key;
                    const destKey = currentPrefix ? `${currentPrefix}${fileName}` : fileName;
                    await invoke("copy_s3_object", {
                      bucket: currentBucket,
                      sourceKey: item.key,
                      destKey,
                    });
                  }
                }
              }
              setTimeout(() => loadObjects(currentBucket, currentPrefix), 1000);
            } catch (err) {
              await message(`Paste failed: ${err}`, { title: "Error", kind: "error" });
            }
          },
        },
      ],
    });
  };

  const handleObjectContextMenu = (e: React.MouseEvent, object: S3Object) => {
    e.preventDefault();
    e.stopPropagation();

    // Select the item if not already selected
    if (!selectedObjects.some((s) => s.key === object.key)) {
      setSelectedObjects([object]);
      setAnchorObject(object);
    }

    const objectsForAction = selectedObjects.some((s) => s.key === object.key) ? selectedObjects : [object];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: "Copy",
          icon: <Copy className="w-4 h-4" />,
          onClick: () => {
            setClipboard({
              source: "s3",
              items: objectsForAction.map((o) => ({
                bucket: o.bucket,
                key: o.key,
                is_prefix: o.is_prefix,
              })),
              prefix: currentPrefix,
            });
          },
        },
        {
          label: "Delete",
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDelete(),
        },
      ],
    });
  };

  // Build breadcrumb from current prefix
  const getBreadcrumbs = (): BreadcrumbPart[] => {
    if (!currentPrefix) return [];
    const parts = currentPrefix.split("/").filter((p) => p);
    const breadcrumbs: BreadcrumbPart[] = [];
    let accumulatedPrefix = "";

    parts.forEach((part) => {
      accumulatedPrefix += part + "/";
      breadcrumbs.push({
        name: part,
        prefix: accumulatedPrefix,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Format bucket/object for FileItem component
  const formatBucketAsFileItem = (bucket: S3Bucket) => ({
    path: bucket.name,
    name: bucket.name,
    size: 0,
    modified: bucket.created,
    is_directory: true,
    file_type: null,
  });

  const formatObjectAsFileItem = (object: S3Object) => ({
    path: object.key,
    name: object.key.split("/").filter((p) => p).pop() || object.key,
    size: object.size,
    modified: object.modified,
    is_directory: object.is_prefix,
    file_type: object.is_prefix ? null : object.key.split(".").pop() || null,
  });

  return (
    <div
      className="h-full flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Navigation bar */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        {viewMode === "objects" && (
          <>
            <button
              onClick={handleBackToBuckets}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Back to buckets"
            >
              <Home className="w-4 h-4" />
            </button>
            {currentPrefix && (
              <button
                onClick={handleParentFolder}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Parent folder"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </>
        )}
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Refresh"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        {/* Action buttons */}
        {viewMode === "objects" && (
          <>
            <button
              onClick={handleDownload}
              disabled={selectedObjects.length === 0 || selectedObjects.every((o) => o.is_prefix)}
              className="p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 dark:text-blue-400"
              title="Download selected file(s)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={selectedObjects.length === 0}
              className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
              title="Delete selected item(s)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Breadcrumb */}
        <div className="flex-1 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
          {viewMode === "buckets" ? (
            <span className="flex items-center gap-1">
              <Database className="w-4 h-4" />
              Buckets
            </span>
          ) : (
            <>
              <button
                onClick={() => loadObjects(currentBucket)}
                className="flex items-center gap-1 hover:text-blue-500"
              >
                <Database className="w-4 h-4" />
                {currentBucket}
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span>/</span>
                  <button
                    onClick={() => loadObjects(currentBucket, crumb.prefix)}
                    className="hover:text-blue-500"
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>

        {/* Endpoint switcher */}
        {endpoints && endpoints.length > 0 && (
          <select
            className="px-2 py-0 text-sm bg-transparent truncate max-w-[200px] flex-shrink-0"
            value={endpoints.find((ep) => ep.is_active)?.id ?? ""}
            onChange={(e) => onEndpointChange?.(e.target.value)}
            title="Active S3 Endpoint"
          >
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div
          className={`flex-1 overflow-y-auto ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 border-dashed" : ""}`}
          onContextMenu={handleBlankContextMenu}
        >
          {isDragOver && viewMode === "objects" && (
            <div className="p-8 text-center text-blue-600 dark:text-blue-400 font-medium">
              Drop local file or folder here to upload to {currentBucket}{currentPrefix ? `/${currentPrefix}` : ""}
            </div>
          )}

          {viewMode === "buckets" ? (
            // Bucket list
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {buckets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No buckets found. Create a bucket in the S3 console.
                </div>
              ) : (
                buckets.map((bucket) => (
                  <FileItem
                    key={bucket.name}
                    item={formatBucketAsFileItem(bucket)}
                    selected={selectedBucket === bucket}
                    onSelect={() => handleBucketClick(bucket)}
                    onDoubleClick={() => handleBucketDoubleClick(bucket)}
                  />
                ))
              )}
            </div>
          ) : (
            // Object list
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {objects.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No objects found in this location.
                </div>
              ) : (
                objects.map((object) => (
                  <FileItem
                    key={object.key}
                    item={formatObjectAsFileItem(object)}
                    selected={selectedObjects.some((s) => s.key === object.key)}
                    onSelect={(_item, shiftKey) => handleObjectClick(object, shiftKey)}
                    onDoubleClick={() => handleObjectDoubleClick(object)}
                    draggable={true}
                    onDragStart={(e) => handleObjectDragStart(e, object)}
                    onContextMenu={(e) => handleObjectContextMenu(e, object)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Metadata panel - Bucket view */}
      {viewMode === "buckets" && selectedBucket && !loading && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-semibold mb-2">Details</h3>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-500">Name:</span> {selectedBucket.name}
            </div>
            <div>
              <span className="text-gray-500">Created:</span>{" "}
              {new Date(selectedBucket.created).toLocaleString()}
            </div>
            {selectedBucket.region && (
              <div>
                <span className="text-gray-500">Region:</span> {selectedBucket.region}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata panel - Single object */}
      {viewMode === "objects" && selectedObjects.length === 1 && !loading && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-semibold mb-2">Details</h3>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-500">Key:</span> {selectedObjects[0].key}
            </div>
            {!selectedObjects[0].is_prefix && (
              <>
                <div>
                  <span className="text-gray-500">Size:</span>{" "}
                  {(selectedObjects[0].size / 1024 / 1024).toFixed(2)} MB
                </div>
                <div>
                  <span className="text-gray-500">Modified:</span>{" "}
                  {new Date(selectedObjects[0].modified).toLocaleString()}
                </div>
                {selectedObjects[0].storage_class && (
                  <div>
                    <span className="text-gray-500">Storage Class:</span>{" "}
                    {selectedObjects[0].storage_class}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Metadata panel - Multiple objects */}
      {viewMode === "objects" && selectedObjects.length > 1 && !loading && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-semibold mb-2">{selectedObjects.length} items selected</h3>
          <div className="text-sm space-y-1">
            <div>Files: {selectedObjects.filter((o) => !o.is_prefix).length}</div>
            <div>Prefixes: {selectedObjects.filter((o) => o.is_prefix).length}</div>
            <div>Total size: {(selectedObjects.reduce((sum, o) => sum + o.size, 0) / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          label={inputDialog.label}
          defaultValue={inputDialog.defaultValue}
          onConfirm={inputDialog.onConfirm}
          onCancel={cancelInput}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={cancelConfirm}
        />
      )}

      {conflictDialog && (
        <ConflictDialog
          conflicts={conflictDialog.conflicts}
          onResolve={conflictDialog.onResolve}
          onCancel={cancelConflicts}
        />
      )}
    </div>
  );
}
