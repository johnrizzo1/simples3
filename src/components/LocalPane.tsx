import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { LocalFileItem } from "../types/models";
import { FileItem } from "./FileItem";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { InputDialog } from "./InputDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { useClipboard } from "../contexts/ClipboardContext";
import { ChevronUp, Home, RefreshCw, Upload, Trash2, FolderPlus, Copy, Clipboard, Eye, EyeOff } from "lucide-react";

export function LocalPane() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<LocalFileItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<LocalFileItem[]>([]);
  const [anchorItem, setAnchorItem] = useState<LocalFileItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
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

  const filteredItems = useMemo(
    () => showHidden ? items : items.filter((i) => !i.name.startsWith(".")),
    [items, showHidden]
  );

  // Load home directory on mount
  useEffect(() => {
    loadHomeDirectory();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 - Refresh
      if (e.key === "F5") {
        e.preventDefault();
        loadDirectory(currentPath);
      }
      // Delete - Delete selected items
      if (e.key === "Delete" && selectedItems.length > 0) {
        e.preventDefault();
        const itemsToDelete = [...selectedItems];
        const count = itemsToDelete.length;
        const names = count <= 5
          ? itemsToDelete.map((i) => i.name).join("\n")
          : itemsToDelete.slice(0, 5).map((i) => i.name).join("\n") + `\n...and ${count - 5} more`;
        showConfirm("Confirm Delete", `Are you sure you want to delete ${count} item(s)?\n${names}`).then(async (confirmed) => {
          if (!confirmed) return;
          const results = await Promise.allSettled(
            itemsToDelete.map((item) =>
              invoke("delete_local_item", { path: item.path })
            )
          );
          const failures = results.filter((r) => r.status === "rejected");
          if (failures.length > 0) {
            await message(`${failures.length} of ${count} deletion(s) failed.`, { title: "Error", kind: "error" });
          }
          loadDirectory(currentPath);
          setSelectedItems([]);
          setAnchorItem(null);
        });
      }
      // Ctrl/Cmd + U - Upload selected files
      if ((e.ctrlKey || e.metaKey) && e.key === "u" && selectedItems.length > 0) {
        e.preventDefault();
        const uploadable = selectedItems.filter((i) => !i.is_directory);
        if (uploadable.length === 0) return;
        (async () => {
          const bucket = await showInput("Upload to S3", "Bucket name:");
          if (!bucket) return;
          if (uploadable.length === 1) {
            const s3Key = await showInput("Upload to S3", "S3 key (path):", uploadable[0].name);
            if (!s3Key) return;
            invoke<string>("upload_file", {
              localPath: uploadable[0].path,
              bucket,
              s3Key,
            }).catch((err) => message(`Upload failed: ${err}`, { title: "Error", kind: "error" }));
          } else {
            const s3Prefix = await showInput("Upload to S3", "S3 prefix for uploads:", "") ?? "";
            if (s3Prefix === null) return;
            Promise.allSettled(
              uploadable.map((item) =>
                invoke<string>("upload_file", {
                  localPath: item.path,
                  bucket,
                  s3Key: s3Prefix ? `${s3Prefix}/${item.name}` : item.name,
                })
              )
            ).then(async (results) => {
              const failures = results.filter((r) => r.status === "rejected");
              if (failures.length > 0) {
                await message(`${failures.length} of ${uploadable.length} upload(s) failed to queue.`, { title: "Error", kind: "error" });
              }
            });
          }
        })();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPath, selectedItems]);

  const loadHomeDirectory = async () => {
    try {
      setLoading(true);
      setError(null);
      setItems([]);
      const homePath = await invoke<string>("get_home_directory");
      if (!homePath || homePath.trim() === "") {
        throw new Error("Home directory path is empty");
      }
      setCurrentPath(homePath);
      await loadDirectory(homePath);
    } catch (err) {
      setError(`Failed to load home directory: ${err}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (path: string) => {
    if (!path || path.trim() === "") {
      setError("No directory path specified");
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fileItems = await invoke<LocalFileItem[]>("list_directory", { path });
      setItems(fileItems);
      setSelectedItems([]);
      setAnchorItem(null);
    } catch (err) {
      setError(`Failed to load directory: ${err}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: LocalFileItem, shiftKey: boolean) => {
    if (shiftKey && anchorItem) {
      const anchorIndex = filteredItems.findIndex((i) => i.path === anchorItem.path);
      const clickedIndex = filteredItems.findIndex((i) => i.path === item.path);

      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        setSelectedItems(filteredItems.slice(start, end + 1));
      }
    } else {
      setSelectedItems([item]);
      setAnchorItem(item);
    }
  };

  const handleItemDoubleClick = (item: LocalFileItem) => {
    if (item.is_directory) {
      setCurrentPath(item.path);
      loadDirectory(item.path);
    }
  };

  const handleParentDirectory = () => {
    const parts = currentPath.split(/[/\\]/);
    parts.pop();
    const parentPath = parts.join("/") || "/";
    setCurrentPath(parentPath);
    loadDirectory(parentPath);
  };

  const handleRefresh = () => {
    loadDirectory(currentPath);
  };

  const handleUpload = async () => {
    const uploadable = selectedItems.filter((i) => !i.is_directory);
    if (uploadable.length === 0) {
      await message("Please select one or more files to upload", { title: "No Files Selected" });
      return;
    }

    const bucket = await showInput("Upload to S3", "Bucket name:");
    if (!bucket) return;

    if (uploadable.length === 1) {
      const item = uploadable[0];
      const s3Key = await showInput("Upload to S3", "S3 key (path):", item.name);
      if (!s3Key) return;
      try {
        await invoke<string>("upload_file", {
          localPath: item.path,
          bucket,
          s3Key,
        });
      } catch (err) {
        await message(`Upload failed: ${err}`, { title: "Error", kind: "error" });
      }
    } else {
      const s3Prefix = await showInput("Upload to S3", "S3 prefix for uploads:");
      if (s3Prefix === null) return;
      const results = await Promise.allSettled(
        uploadable.map((item) =>
          invoke<string>("upload_file", {
            localPath: item.path,
            bucket,
            s3Key: s3Prefix ? `${s3Prefix}/${item.name}` : item.name,
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        await message(`${failures.length} of ${uploadable.length} upload(s) failed to queue.`, { title: "Error", kind: "error" });
      }
    }
  };

  const handleDelete = async () => {
    if (selectedItems.length === 0) {
      await message("Please select one or more items to delete", { title: "No Items Selected" });
      return;
    }

    const count = selectedItems.length;
    const names = count <= 5
      ? selectedItems.map((i) => i.name).join("\n")
      : selectedItems.slice(0, 5).map((i) => i.name).join("\n") + `\n...and ${count - 5} more`;
    const confirmed = await showConfirm("Confirm Delete", `Are you sure you want to delete ${count} item(s)?\n${names}`);
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedItems.map((item) =>
        invoke("delete_local_item", { path: item.path })
      )
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      await message(`${failures.length} of ${count} deletion(s) failed.`, { title: "Error", kind: "error" });
    }
    await loadDirectory(currentPath);
    setSelectedItems([]);
    setAnchorItem(null);
  };

  // Drag and drop handlers
  const handleItemDragStart = (e: React.DragEvent, item: LocalFileItem) => {
    const isInSelection = selectedItems.some((s) => s.path === item.path);
    const itemsToDrag = isInSelection ? selectedItems : [item];

    if (!isInSelection) {
      setSelectedItems([item]);
      setAnchorItem(item);
    }

    const dragData = itemsToDrag.map((i) => ({
      path: i.path,
      name: i.name,
      is_directory: i.is_directory,
    }));

    e.dataTransfer.setData("application/x-simples3-local", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-simples3-s3")) {
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const s3Data = e.dataTransfer.getData("application/x-simples3-s3");
    if (!s3Data) return;

    try {
      const parsed = JSON.parse(s3Data);
      const draggedItems: Array<{ bucket: string; key: string; is_prefix: boolean }> =
        Array.isArray(parsed) ? parsed : [parsed];

      for (const item of draggedItems) {
        if (item.is_prefix) {
          const folderName = item.key.split("/").filter((p: string) => p).pop() || "download";
          const localDest = `${currentPath}/${folderName}`;
          await invoke<string[]>("download_prefix", {
            bucket: item.bucket,
            s3Prefix: item.key,
            localPath: localDest,
          });
        } else {
          const fileName = item.key.split("/").pop() || "download";
          const localPath = `${currentPath}/${fileName}`;
          await invoke<string>("download_file", {
            bucket: item.bucket,
            s3Key: item.key,
            localPath,
          });
        }
      }

      setTimeout(() => loadDirectory(currentPath), 1000);
    } catch (err) {
      await message(`Download failed: ${err}`, { title: "Error", kind: "error" });
    }
  };

  // Context menu handlers
  const handleBlankContextMenu = (e: React.MouseEvent) => {
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
              await invoke("create_directory", { path: `${currentPath}/${name}` });
              loadDirectory(currentPath);
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
                const sources = clipboard.items.map((i) => i.path);
                await invoke("copy_local_items", { sources, destDir: currentPath });
              } else {
                for (const item of clipboard.items) {
                  if (item.is_prefix) {
                    const folderName = item.key.split("/").filter((p: string) => p).pop() || "download";
                    await invoke<string[]>("download_prefix", {
                      bucket: item.bucket,
                      s3Prefix: item.key,
                      localPath: `${currentPath}/${folderName}`,
                    });
                  } else {
                    const fileName = item.key.split("/").pop() || "download";
                    await invoke<string>("download_file", {
                      bucket: item.bucket,
                      s3Key: item.key,
                      localPath: `${currentPath}/${fileName}`,
                    });
                  }
                }
              }
              loadDirectory(currentPath);
            } catch (err) {
              await message(`Paste failed: ${err}`, { title: "Error", kind: "error" });
            }
          },
        },
      ],
    });
  };

  const handleItemContextMenu = (e: React.MouseEvent, item: LocalFileItem) => {
    e.preventDefault();
    e.stopPropagation();

    // Select the item if not already selected
    if (!selectedItems.some((s) => s.path === item.path)) {
      setSelectedItems([item]);
      setAnchorItem(item);
    }

    const itemsForAction = selectedItems.some((s) => s.path === item.path) ? selectedItems : [item];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: "Copy",
          icon: <Copy className="w-4 h-4" />,
          onClick: () => {
            setClipboard({
              source: "local",
              items: itemsForAction.map((i) => ({
                path: i.path,
                name: i.name,
                is_directory: i.is_directory,
              })),
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

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header with navigation */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={loadHomeDirectory}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Go to home directory"
        >
          <Home className="w-4 h-4" />
        </button>

        <button
          onClick={handleParentDirectory}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Parent directory"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          onClick={handleRefresh}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        <button
          onClick={() => setShowHidden((v) => !v)}
          className={`p-2 rounded ${showHidden ? "bg-blue-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          title={showHidden ? "Hide hidden files" : "Show hidden files"}
        >
          {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0 px-2">
          <div className="text-sm truncate font-mono">{currentPath}</div>
        </div>

        <button
          onClick={handleUpload}
          disabled={selectedItems.length === 0 || selectedItems.every((i) => i.is_directory)}
          className="p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 dark:text-blue-400"
          title="Upload selected file(s) to S3"
        >
          <Upload className="w-4 h-4" />
        </button>

        <button
          onClick={handleDelete}
          disabled={selectedItems.length === 0}
          className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
          title="Delete selected item(s)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* File list */}
      <div
        className={`flex-1 overflow-auto p-2 ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 border-dashed" : ""}`}
        onContextMenu={handleBlankContextMenu}
      >
        {isDragOver && (
          <div className="p-8 text-center text-blue-600 dark:text-blue-400 font-medium">
            Drop S3 file or folder here to download
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="p-4 text-center text-gray-500">Empty directory</div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-1">
            {filteredItems.map((item) => (
              <FileItem
                key={item.path}
                item={item}
                selected={selectedItems.some((s) => s.path === item.path)}
                onSelect={handleItemSelect}
                onDoubleClick={handleItemDoubleClick}
                draggable={true}
                onDragStart={(e) => handleItemDragStart(e, item)}
                onContextMenu={(e) => handleItemContextMenu(e, item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected item metadata */}
      {selectedItems.length === 1 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <div className="font-medium mb-1">Selected:</div>
          <div className="text-gray-600 dark:text-gray-400">
            <div>Name: {selectedItems[0].name}</div>
            <div>
              Type: {selectedItems[0].is_directory ? "Directory" : selectedItems[0].file_type || "File"}
            </div>
            {!selectedItems[0].is_directory && <div>Size: {selectedItems[0].size} bytes</div>}
            <div className="truncate" title={selectedItems[0].path}>
              Path: {selectedItems[0].path}
            </div>
          </div>
        </div>
      )}
      {selectedItems.length > 1 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <div className="font-medium mb-1">{selectedItems.length} items selected</div>
          <div className="text-gray-600 dark:text-gray-400">
            <div>Files: {selectedItems.filter((i) => !i.is_directory).length}</div>
            <div>Directories: {selectedItems.filter((i) => i.is_directory).length}</div>
            <div>Total size: {selectedItems.reduce((sum, i) => sum + i.size, 0).toLocaleString()} bytes</div>
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
    </div>
  );
}
