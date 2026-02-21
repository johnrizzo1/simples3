import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { S3Bucket, S3Object } from "../types/models";
import { FileItem } from "./FileItem";
import {
  Home,
  ArrowUp,
  RefreshCw,
  Database,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";

type ViewMode = "buckets" | "objects";

interface BreadcrumbPart {
  name: string;
  prefix: string;
}

export function S3Pane() {
  const [viewMode, setViewMode] = useState<ViewMode>("buckets");
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [currentBucket, setCurrentBucket] = useState<string>("");
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<S3Bucket | S3Object | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load buckets on mount
  useEffect(() => {
    loadBuckets();
  }, []);

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
      // Delete - Delete selected item (only in objects view)
      if (e.key === "Delete" && selectedItem && viewMode === "objects" && !("name" in selectedItem)) {
        e.preventDefault();
        const s3Object = selectedItem as S3Object;
        const itemType = s3Object.is_prefix ? "folder" : "file";
        const confirmed = confirm(
          `Are you sure you want to delete this ${itemType}?\n${s3Object.key}\n\nThis action cannot be undone.`
        );
        if (confirmed) {
          invoke("delete_s3_object", {
            bucket: s3Object.bucket,
            key: s3Object.key,
          })
            .then(() => {
              alert("Object deleted successfully");
              loadObjects(currentBucket, currentPrefix);
              setSelectedItem(null);
            })
            .catch((err) => alert(`Delete failed: ${err}`));
        }
      }
      // Ctrl/Cmd + D - Download
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "d" &&
        selectedItem &&
        viewMode === "objects" &&
        !("name" in selectedItem) &&
        !(selectedItem as S3Object).is_prefix
      ) {
        e.preventDefault();
        const s3Object = selectedItem as S3Object;
        const fileName = s3Object.key.split("/").pop() || "download";
        const localPath = prompt("Enter local path to save the file:", `~/Downloads/${fileName}`);
        if (localPath) {
          invoke<string>("download_file", {
            bucket: s3Object.bucket,
            s3Key: s3Object.key,
            localPath,
          })
            .then((jobId) => alert(`Download queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`))
            .catch((err) => alert(`Download failed: ${err}`));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, selectedItem, currentBucket, currentPrefix]);

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
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleBucketClick = (bucket: S3Bucket) => {
    setSelectedItem(bucket);
  };

  const handleBucketDoubleClick = (bucket: S3Bucket) => {
    loadObjects(bucket.name);
  };

  const handleObjectClick = (object: S3Object) => {
    setSelectedItem(object);
  };

  const handleObjectDoubleClick = (object: S3Object) => {
    // If it's a prefix (folder), navigate into it
    if (object.is_prefix) {
      loadObjects(currentBucket, object.key);
    }
  };

  const handleBackToBuckets = () => {
    setViewMode("buckets");
    setCurrentBucket("");
    setCurrentPrefix("");
    setSelectedItem(null);
  };

  const handleParentFolder = () => {
    // Remove the last segment from the prefix
    const parts = currentPrefix.split("/").filter((p) => p);
    parts.pop(); // Remove last part
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

  const handleDownload = async () => {
    if (!selectedItem || viewMode === "buckets" || "name" in selectedItem) {
      alert("Please select a file to download");
      return;
    }

    const s3Object = selectedItem as S3Object;
    if (s3Object.is_prefix) {
      alert("Cannot download folders. Please select a file.");
      return;
    }

    // Prompt for local download path
    const fileName = s3Object.key.split("/").pop() || "download";
    const localPath = prompt("Enter local path to save the file:", `~/Downloads/${fileName}`);
    if (!localPath) return;

    try {
      const jobId = await invoke<string>("download_file", {
        bucket: s3Object.bucket,
        s3Key: s3Object.key,
        localPath,
      });
      alert(`Download queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`);
    } catch (err) {
      alert(`Download failed: ${err}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || viewMode === "buckets" || "name" in selectedItem) {
      alert("Please select a file or folder to delete");
      return;
    }

    const s3Object = selectedItem as S3Object;
    const itemType = s3Object.is_prefix ? "folder" : "file";
    const confirmed = confirm(
      `Are you sure you want to delete this ${itemType}?\n${s3Object.key}\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await invoke("delete_s3_object", {
        bucket: s3Object.bucket,
        key: s3Object.key,
      });
      alert("Object deleted successfully");
      await loadObjects(currentBucket, currentPrefix);
      setSelectedItem(null);
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // Drag and drop handlers
  const handleObjectDragStart = (e: React.DragEvent, object: S3Object) => {
    console.log("S3Pane dragStart:", object);

    if (object.is_prefix) {
      console.log("Prefix/folder drag prevented");
      e.preventDefault();
      return;
    }

    const dragData = {
      bucket: object.bucket,
      key: object.key,
    };

    console.log("Setting S3 drag data:", dragData);

    // Store S3 object info for drag-and-drop to local
    e.dataTransfer.setData("application/x-simples3-s3", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";

    console.log("S3 drag data set successfully");
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only accept local files when we're in objects view (not buckets)
    if (viewMode === "objects" && e.dataTransfer.types.includes("application/x-simples3-local")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we're leaving the pane itself, not a child element
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    console.log("S3Pane handleDrop called");
    console.log("ViewMode:", viewMode);
    console.log("DataTransfer types:", e.dataTransfer.types);

    if (viewMode !== "objects") {
      console.log("Not in objects view, ignoring drop");
      return;
    }

    const localData = e.dataTransfer.getData("application/x-simples3-local");
    console.log("Local data retrieved:", localData);

    if (!localData) {
      console.log("No local data found in drop");
      return;
    }

    try {
      const { path, name } = JSON.parse(localData);

      // Use current prefix as the upload location
      const s3Key = currentPrefix ? `${currentPrefix}${name}` : name;

      console.log("Attempting to upload:", { path, name, bucket: currentBucket, s3Key });

      const confirmed = confirm(
        `Upload file to S3:\nBucket: ${currentBucket}\nKey: ${s3Key}\n\nProceed?`
      );
      if (!confirmed) {
        console.log("Upload canceled by user");
        return;
      }

      console.log("Calling upload_file command...");
      const jobId = await invoke<string>("upload_file", {
        localPath: path,
        bucket: currentBucket,
        s3Key,
      });

      console.log("Upload queued with job ID:", jobId);
      alert(`Upload queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`);

      // Refresh objects to show new file when upload completes
      setTimeout(() => loadObjects(currentBucket, currentPrefix), 1000);
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err}`);
    }
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
      <div className="p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
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
              disabled={!selectedItem || (selectedItem as S3Object)?.is_prefix}
              className="p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 dark:text-blue-400"
              title="Download selected file"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={!selectedItem}
              className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
              title="Delete selected item"
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
        <div className={`flex-1 overflow-y-auto ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 border-dashed" : ""}`}>
          {isDragOver && viewMode === "objects" && (
            <div className="p-8 text-center text-blue-600 dark:text-blue-400 font-medium">
              Drop local file here to upload to {currentBucket}{currentPrefix ? `/${currentPrefix}` : ""}
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
                    selected={selectedItem === bucket}
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
                    selected={selectedItem === object}
                    onSelect={() => handleObjectClick(object)}
                    onDoubleClick={() => handleObjectDoubleClick(object)}
                    draggable={!object.is_prefix}
                    onDragStart={(e) => handleObjectDragStart(e, object)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Metadata panel */}
      {selectedItem && !loading && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-semibold mb-2">Details</h3>
          {"name" in selectedItem ? (
            // Bucket details
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-500">Name:</span> {selectedItem.name}
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{" "}
                {new Date(selectedItem.created).toLocaleString()}
              </div>
              {selectedItem.region && (
                <div>
                  <span className="text-gray-500">Region:</span> {selectedItem.region}
                </div>
              )}
            </div>
          ) : (
            // Object details
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-500">Key:</span> {selectedItem.key}
              </div>
              {!selectedItem.is_prefix && (
                <>
                  <div>
                    <span className="text-gray-500">Size:</span>{" "}
                    {(selectedItem.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div>
                    <span className="text-gray-500">Modified:</span>{" "}
                    {new Date(selectedItem.modified).toLocaleString()}
                  </div>
                  {selectedItem.storage_class && (
                    <div>
                      <span className="text-gray-500">Storage Class:</span>{" "}
                      {selectedItem.storage_class}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
