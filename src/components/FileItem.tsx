import { LocalFileItem } from "../types/models";
import { Folder, File } from "lucide-react";

interface FileItemProps {
  item: LocalFileItem;
  selected: boolean;
  onSelect: (item: LocalFileItem) => void;
  onDoubleClick: (item: LocalFileItem) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function FileItem({ item, selected, onSelect, onDoubleClick, draggable = false, onDragStart }: FileItemProps) {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:bg-gray-100 dark:hover:bg-gray-800 ${
        selected ? "bg-blue-100 dark:bg-blue-900" : ""
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick(item)}
    >
      <div className="flex-shrink-0">
        {item.is_directory ? (
          <Folder className="w-5 h-5 text-blue-500" />
        ) : (
          <File className="w-5 h-5 text-gray-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.name}</div>
      </div>

      <div className="flex-shrink-0 w-24 text-right text-sm text-gray-500">
        {formatSize(item.size)}
      </div>

      <div className="flex-shrink-0 w-40 text-right text-sm text-gray-500">
        {formatDate(item.modified)}
      </div>
    </div>
  );
}
