import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LocalFileItem } from "../types/models";
import { FileItem } from "./FileItem";
import { ChevronUp, Home, RefreshCw, Upload, Trash2 } from "lucide-react";

export function LocalPane() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<LocalFileItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<LocalFileItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
      // Delete - Delete selected item
      if (e.key === "Delete" && selectedItem) {
        e.preventDefault();
        const confirmed = confirm(
          `Are you sure you want to delete ${selectedItem.name}?\nThis action cannot be undone.`
        );
        if (confirmed) {
          invoke("delete_local_item", { path: selectedItem.path })
            .then(() => {
              alert("Item deleted successfully");
              loadDirectory(currentPath);
              setSelectedItem(null);
            })
            .catch((err) => alert(`Delete failed: ${err}`));
        }
      }
      // Ctrl/Cmd + U - Upload
      if ((e.ctrlKey || e.metaKey) && e.key === "u" && selectedItem && !selectedItem.is_directory) {
        e.preventDefault();
        const bucket = prompt("Enter S3 bucket name:");
        if (bucket) {
          const defaultKey = selectedItem.name;
          const s3Key = prompt("Enter S3 key (path):", defaultKey);
          if (s3Key) {
            invoke<string>("upload_file", {
              localPath: selectedItem.path,
              bucket,
              s3Key,
            })
              .then((jobId) => alert(`Upload queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`))
              .catch((err) => alert(`Upload failed: ${err}`));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPath, selectedItem]);

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
      setSelectedItem(null);
    } catch (err) {
      setError(`Failed to load directory: ${err}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: LocalFileItem) => {
    setSelectedItem(item);
  };

  const handleItemDoubleClick = (item: LocalFileItem) => {
    if (item.is_directory) {
      setCurrentPath(item.path);
      loadDirectory(item.path);
    }
  };

  const handleParentDirectory = () => {
    // Navigate to parent directory
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
    if (!selectedItem || selectedItem.is_directory) {
      alert("Please select a file to upload");
      return;
    }

    // Prompt for bucket and S3 key
    const bucket = prompt("Enter S3 bucket name:");
    if (!bucket) return;

    const defaultKey = selectedItem.name;
    const s3Key = prompt("Enter S3 key (path):", defaultKey);
    if (!s3Key) return;

    try {
      const jobId = await invoke<string>("upload_file", {
        localPath: selectedItem.path,
        bucket,
        s3Key,
      });
      alert(`Upload queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`);
    } catch (err) {
      alert(`Upload failed: ${err}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) {
      alert("Please select a file or directory to delete");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete ${selectedItem.name}?\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await invoke("delete_local_item", { path: selectedItem.path });
      alert("Item deleted successfully");
      await loadDirectory(currentPath);
      setSelectedItem(null);
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // Drag and drop handlers
  const handleItemDragStart = (e: React.DragEvent, item: LocalFileItem) => {
    console.log("LocalPane dragStart:", item);

    if (item.is_directory) {
      console.log("Directory drag prevented");
      e.preventDefault();
      return;
    }

    const dragData = {
      path: item.path,
      name: item.name,
    };

    console.log("Setting drag data:", dragData);

    // Store local file info for drag-and-drop to S3
    e.dataTransfer.setData("application/x-simples3-local", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";

    console.log("Drag data set successfully");
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Check if this is an S3 object being dragged
    if (e.dataTransfer.types.includes("application/x-simples3-s3")) {
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

    console.log("LocalPane handleDrop called");
    console.log("DataTransfer types:", e.dataTransfer.types);

    const s3Data = e.dataTransfer.getData("application/x-simples3-s3");
    console.log("S3 data retrieved:", s3Data);

    if (!s3Data) {
      console.log("No S3 data found in drop");
      return;
    }

    try {
      const { bucket, key } = JSON.parse(s3Data);
      const fileName = key.split("/").pop() || "download";

      // Use current directory as download location
      const localPath = `${currentPath}/${fileName}`;

      console.log("Attempting to download:", { bucket, key, localPath });

      const confirmed = confirm(
        `Download S3 file to:\n${localPath}\n\nProceed?`
      );
      if (!confirmed) {
        console.log("Download canceled by user");
        return;
      }

      console.log("Calling download_file command...");
      const jobId = await invoke<string>("download_file", {
        bucket,
        s3Key: key,
        localPath,
      });

      console.log("Download queued with job ID:", jobId);
      alert(`Download queued! Job ID: ${jobId}\nCheck the Transfers tab to monitor progress.`);

      // Refresh directory to show new file when download completes
      setTimeout(() => loadDirectory(currentPath), 1000);
    } catch (err) {
      console.error("Download error:", err);
      alert(`Download failed: ${err}`);
    }
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

        <div className="flex-1 min-w-0 px-2">
          <div className="text-sm truncate font-mono">{currentPath}</div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedItem || selectedItem.is_directory}
          className="p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 dark:text-blue-400"
          title="Upload selected file to S3"
        >
          <Upload className="w-4 h-4" />
        </button>

        <button
          onClick={handleDelete}
          disabled={!selectedItem}
          className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
          title="Delete selected item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* File list */}
      <div className={`flex-1 overflow-auto p-2 ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 border-dashed" : ""}`}>
        {isDragOver && (
          <div className="p-8 text-center text-blue-600 dark:text-blue-400 font-medium">
            Drop S3 file here to download
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

        {!loading && !error && items.length === 0 && (
          <div className="p-4 text-center text-gray-500">Empty directory</div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-1">
            {items.map((item) => (
              <FileItem
                key={item.path}
                item={item}
                selected={selectedItem?.path === item.path}
                onSelect={handleItemSelect}
                onDoubleClick={handleItemDoubleClick}
                draggable={!item.is_directory}
                onDragStart={(e) => handleItemDragStart(e, item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected item metadata */}
      {selectedItem && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <div className="font-medium mb-1">Selected:</div>
          <div className="text-gray-600 dark:text-gray-400">
            <div>Name: {selectedItem.name}</div>
            <div>
              Type: {selectedItem.is_directory ? "Directory" : selectedItem.file_type || "File"}
            </div>
            {!selectedItem.is_directory && <div>Size: {selectedItem.size} bytes</div>}
            <div className="truncate" title={selectedItem.path}>
              Path: {selectedItem.path}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
