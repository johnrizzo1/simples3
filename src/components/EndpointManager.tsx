import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { S3Endpoint } from "../types/models";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Loader2, Power } from "lucide-react";

export function EndpointManager() {
  const [endpoints, setEndpoints] = useState<S3Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<S3Endpoint | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    region: "",
    access_key_id: "",
    secret_access_key: "",
  });

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpointList = await invoke<S3Endpoint[]>("list_endpoints");
      setEndpoints(endpointList);
    } catch (err) {
      setError(`Failed to load endpoints: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      await invoke("add_endpoint", {
        name: formData.name,
        url: formData.url,
        region: formData.region,
        accessKeyId: formData.access_key_id,
        secretAccessKey: formData.secret_access_key,
      });

      // Reset form
      setFormData({
        name: "",
        url: "",
        region: "",
        access_key_id: "",
        secret_access_key: "",
      });
      setShowAddForm(false);

      // Reload endpoints
      await loadEndpoints();
    } catch (err) {
      setError(`Failed to add endpoint: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEndpoint) return;

    try {
      setLoading(true);
      setError(null);

      const accessKeyId = formData.access_key_id || null;
      const secretAccessKey = formData.secret_access_key || null;

      await invoke("update_endpoint", {
        endpoint: {
          ...editingEndpoint,
          name: formData.name,
          url: formData.url,
          region: formData.region,
        },
        accessKeyId,
        secretAccessKey,
      });

      setEditingEndpoint(null);
      setFormData({
        name: "",
        url: "",
        region: "",
        access_key_id: "",
        secret_access_key: "",
      });

      await loadEndpoints();
    } catch (err) {
      setError(`Failed to update endpoint: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      await invoke("delete_endpoint", { endpointId: id });

      setDeleteConfirmId(null);
      await loadEndpoints();
    } catch (err) {
      setError(`Failed to delete endpoint: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateEndpoint = async (id: string) => {
    try {
      setValidatingId(id);
      setError(null);

      await invoke("validate_endpoint", { endpointId: id });

      await loadEndpoints();
    } catch (err) {
      setError(`Failed to validate endpoint: ${err}`);
    } finally {
      setValidatingId(null);
    }
  };

  const handleSetActiveEndpoint = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      await invoke("set_active_endpoint", { endpointId: id });

      await loadEndpoints();
    } catch (err) {
      setError(`Failed to set active endpoint: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (endpoint: S3Endpoint) => {
    setEditingEndpoint(endpoint);
    setFormData({
      name: endpoint.name,
      url: endpoint.url,
      region: endpoint.region,
      access_key_id: "",
      secret_access_key: "",
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingEndpoint(null);
    setFormData({
      name: "",
      url: "",
      region: "",
      access_key_id: "",
      secret_access_key: "",
    });
  };

  const getValidationStatusIcon = (status: S3Endpoint["validation_status"]) => {
    if (typeof status === "string") {
      if (status === "Pending") {
        return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />;
      } else if (status === "Validated") {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      }
    } else if (typeof status === "object" && "Failed" in status) {
      return (
        <span title={status.Failed.reason}>
          <XCircle className="w-4 h-4 text-red-500" />
        </span>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">S3 Endpoints</h2>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingEndpoint(null);
              cancelEdit();
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Endpoint
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingEndpoint) && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-3">
            {editingEndpoint ? "Edit Endpoint" : "Add New Endpoint"}
          </h3>
          <form onSubmit={editingEndpoint ? handleUpdateEndpoint : handleAddEndpoint}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://s3.amazonaws.com or http://localhost:9000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Region</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="us-east-1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Access Key ID {editingEndpoint && "(leave blank to keep current)"}
                </label>
                <input
                  type="text"
                  value={formData.access_key_id}
                  onChange={(e) =>
                    setFormData({ ...formData, access_key_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  required={!editingEndpoint}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Secret Access Key {editingEndpoint && "(leave blank to keep current)"}
                </label>
                <input
                  type="password"
                  value={formData.secret_access_key}
                  onChange={(e) =>
                    setFormData({ ...formData, secret_access_key: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  required={!editingEndpoint}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {editingEndpoint ? "Update" : "Add"} Endpoint
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    cancelEdit();
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Endpoint List */}
      <div className="flex-1 overflow-auto p-4">
        {loading && endpoints.length === 0 && (
          <div className="text-center text-gray-500">Loading...</div>
        )}

        {!loading && endpoints.length === 0 && (
          <div className="text-center text-gray-500">
            No endpoints configured. Add one to get started.
          </div>
        )}

        <div className="space-y-2">
          {endpoints.map((endpoint) => (
            <div
              key={endpoint.id}
              className={`p-4 border rounded ${
                endpoint.is_active
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {deleteConfirmId === endpoint.id ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Delete this endpoint?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteEndpoint(endpoint.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{endpoint.name}</h3>
                        {endpoint.is_active && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded">
                            Active
                          </span>
                        )}
                        {getValidationStatusIcon(endpoint.validation_status)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {endpoint.url}
                      </div>
                      <div className="text-xs text-gray-500">Region: {endpoint.region}</div>
                    </div>

                    <div className="flex gap-1">
                      {!endpoint.is_active && (
                        <button
                          onClick={() => handleSetActiveEndpoint(endpoint.id)}
                          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Set as active"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleValidateEndpoint(endpoint.id)}
                        disabled={validatingId === endpoint.id}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                        title="Validate credentials"
                      >
                        {validatingId === endpoint.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(endpoint)}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(endpoint.id)}
                        className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
