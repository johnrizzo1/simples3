import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig, Theme } from "../types/models";
import { Save, RefreshCw } from "lucide-react";

export function SettingsPanel() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AppConfig>("get_config");
      setConfig(result);
    } catch (err) {
      setError(`Failed to load config: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await invoke("update_config", { config });
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to save config: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<AppConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load configuration
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-800">
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <select
              value={config.theme}
              onChange={(e) => updateConfig({ theme: e.target.value as Theme })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            >
              <option value="Light">Light</option>
              <option value="Dark">Dark</option>
              <option value="System">System</option>
            </select>
          </div>

          {/* Max concurrent transfers */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Concurrent Transfers
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.max_concurrent_transfers}
              onChange={(e) =>
                updateConfig({ max_concurrent_transfers: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
            <p className="mt-1 text-sm text-gray-500">
              Number of simultaneous uploads/downloads (1-10)
            </p>
          </div>

          {/* Auto validate endpoints */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto-validate"
              checked={config.auto_validate_endpoints}
              onChange={(e) =>
                updateConfig({ auto_validate_endpoints: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label htmlFor="auto-validate" className="text-sm font-medium">
              Auto-validate endpoints on startup
            </label>
          </div>

          {/* Show hidden files */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="show-hidden"
              checked={config.show_hidden_files}
              onChange={(e) => updateConfig({ show_hidden_files: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="show-hidden" className="text-sm font-medium">
              Show hidden files and folders
            </label>
          </div>

          {/* Default local path */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Local Path
            </label>
            <input
              type="text"
              value={config.default_local_path || ""}
              onChange={(e) =>
                updateConfig({
                  default_local_path: e.target.value || null,
                })
              }
              placeholder="/path/to/default/directory"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
            <p className="mt-1 text-sm text-gray-500">
              Starting directory for local file browser
            </p>
          </div>

          {/* Multipart threshold */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Multipart Upload Threshold (MB)
            </label>
            <input
              type="number"
              min="1"
              value={config.multipart_threshold / (1024 * 1024)}
              onChange={(e) =>
                updateConfig({
                  multipart_threshold: parseInt(e.target.value) * 1024 * 1024,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
            <p className="mt-1 text-sm text-gray-500">
              Files larger than this will use multipart upload
            </p>
          </div>

          {/* Multipart chunk size */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Multipart Chunk Size (MB)
            </label>
            <input
              type="number"
              min="5"
              max="100"
              value={config.multipart_chunk_size / (1024 * 1024)}
              onChange={(e) =>
                updateConfig({
                  multipart_chunk_size: parseInt(e.target.value) * 1024 * 1024,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
            <p className="mt-1 text-sm text-gray-500">
              Size of each part in multipart uploads (5-100 MB)
            </p>
          </div>

          {/* Save button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              onClick={loadConfig}
              disabled={loading || saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
