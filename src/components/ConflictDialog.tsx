import { useState } from "react";
import { ConflictItem, ConflictResolution } from "../types/models";
import { AlertTriangle } from "lucide-react";

interface ConflictDialogProps {
  conflicts: ConflictItem[];
  onResolve: (resolved: ConflictItem[]) => void;
  onCancel: () => void;
}

export function ConflictDialog({ conflicts, onResolve, onCancel }: ConflictDialogProps) {
  const [items, setItems] = useState<ConflictItem[]>(
    conflicts.map((c) => ({ ...c, resolution: "overwrite" }))
  );
  const [applyToAll, setApplyToAll] = useState(false);

  const updateResolution = (index: number, resolution: ConflictResolution) => {
    setItems((prev) => {
      const updated = [...prev];
      if (applyToAll) {
        return updated.map((item) => ({ ...item, resolution, newName: resolution === "rename" ? item.newName : undefined }));
      }
      updated[index] = { ...updated[index], resolution, newName: resolution === "rename" ? updated[index].newName : undefined };
      return updated;
    });
  };

  const updateNewName = (index: number, newName: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], newName };
      return updated;
    });
  };

  const handleConfirm = () => {
    // Validate rename entries have names
    const valid = items.every(
      (item) => item.resolution !== "rename" || (item.newName && item.newName.trim() !== "")
    );
    if (!valid) return;
    onResolve(items);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 w-[480px] max-h-[80vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold">
            {conflicts.length} file{conflicts.length !== 1 ? "s" : ""} already exist
          </h3>
        </div>

        <p className="px-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
          Choose how to handle each conflicting file.
        </p>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto px-4 divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item, idx) => (
            <div key={item.path} className="py-2">
              <div className="text-sm font-medium truncate mb-1" title={item.name}>
                {item.name}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={item.resolution}
                  onChange={(e) => updateResolution(idx, e.target.value as ConflictResolution)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                >
                  <option value="overwrite">Overwrite</option>
                  <option value="skip">Skip</option>
                  <option value="rename">Rename</option>
                </select>
                {item.resolution === "rename" && (
                  <input
                    type="text"
                    value={item.newName || ""}
                    onChange={(e) => updateNewName(idx, e.target.value)}
                    placeholder="New name..."
                    className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    autoFocus
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
          {conflicts.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="rounded"
              />
              Apply to all
            </label>
          )}
          <div className="flex-1" />
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
