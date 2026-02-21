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

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex-1 overflow-auto p-2">
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
