import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TransferJob } from "../types/models";
import {
  Upload,
  Download,
  Pause,
  Play,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";

export function TransferQueue() {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load transfers periodically
  useEffect(() => {
    loadTransfers();
    const interval = setInterval(loadTransfers, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  const loadTransfers = async () => {
    try {
      const result = await invoke<TransferJob[]>("get_transfer_queue");
      setTransfers(result);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load transfers:", err);
      setLoading(false);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await invoke("pause_transfer", { jobId });
      await loadTransfers();
    } catch (err) {
      console.error("Failed to pause transfer:", err);
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await invoke("resume_transfer", { jobId });
      await loadTransfers();
    } catch (err) {
      console.error("Failed to resume transfer:", err);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await invoke("cancel_transfer", { jobId });
      await loadTransfers();
    } catch (err) {
      console.error("Failed to cancel transfer:", err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Queued":
        return <Clock className="w-4 h-4 text-gray-500" />;
      case "Active":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "Paused":
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case "Completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "Failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "Cancelled":
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "text-blue-600 dark:text-blue-400";
      case "Completed":
        return "text-green-600 dark:text-green-400";
      case "Failed":
        return "text-red-600 dark:text-red-400";
      case "Paused":
        return "text-yellow-600 dark:text-yellow-400";
      case "Cancelled":
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-gray-500";
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatFileName = (job: TransferJob): string => {
    if (job.source.Local) {
      return job.source.Local.path.split("/").pop() || job.source.Local.path;
    } else if (job.source.S3) {
      return job.source.S3.key.split("/").pop() || job.source.S3.key;
    }
    return "Unknown";
  };

  const formatDestination = (job: TransferJob): string => {
    if (job.destination.S3) {
      return `s3://${job.destination.S3.bucket}/${job.destination.S3.key}`;
    } else if (job.destination.Local) {
      return job.destination.Local.path;
    }
    return "Unknown";
  };

  const calculateProgress = (job: TransferJob): number => {
    if (job.file_size === 0) return 0;
    return (job.progress_bytes / job.file_size) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No transfers yet</p>
        <p className="text-sm mt-1">
          Select files to upload or download to get started
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">
          Transfers ({transfers.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {transfer.transfer_type === "Upload" ? (
                    <Upload className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="font-medium">
                    {formatFileName(transfer)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(transfer.status)}
                  <span
                    className={`text-sm ${getStatusColor(transfer.status)}`}
                  >
                    {transfer.status}
                  </span>
                </div>
              </div>

              {/* Destination */}
              <div className="text-sm text-gray-500 mb-2 truncate">
                {formatDestination(transfer)}
              </div>

              {/* Progress bar */}
              {(transfer.status === "Active" || transfer.status === "Paused") && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${calculateProgress(transfer)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>
                      {formatBytes(transfer.progress_bytes)} /{" "}
                      {formatBytes(transfer.file_size)}
                    </span>
                    <span>{calculateProgress(transfer).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {transfer.status === "Failed" && transfer.error_message && (
                <div className="text-sm text-red-600 dark:text-red-400 mb-2">
                  {transfer.error_message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {transfer.status === "Active" && (
                  <button
                    onClick={() => handlePause(transfer.id)}
                    className="px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 flex items-center gap-1"
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </button>
                )}
                {transfer.status === "Paused" && (
                  <button
                    onClick={() => handleResume(transfer.id)}
                    className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Resume
                  </button>
                )}
                {(transfer.status === "Active" ||
                  transfer.status === "Paused" ||
                  transfer.status === "Queued") && (
                  <button
                    onClick={() => handleCancel(transfer.id)}
                    className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
