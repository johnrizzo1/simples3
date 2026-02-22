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
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
} from "lucide-react";

export function TransferQueue() {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState(false);

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

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDuration = (startIso: string, endIso: string): string => {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (ms < 0) return "—";
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return `${min}m ${sec}s`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hr}h ${remMin}m ${sec}s`;
  };

  const formatTimingLine = (job: TransferJob): string | null => {
    if (job.status === "Queued") {
      return `Queued ${formatTime(job.created_at)}`;
    }
    if (!job.started_at) return null;
    const started = `Started ${formatTime(job.started_at)}`;
    if (job.completed_at) {
      const finished = `Finished ${formatTime(job.completed_at)}`;
      const duration = formatDuration(job.started_at, job.completed_at);
      return `${started} · ${finished} · ${duration}`;
    }
    // Active or Paused — show elapsed so far
    return started;
  };

  // Compute summary counts for the header
  const activeCount = transfers.filter((t) => t.status === "Active").length;
  const queuedCount = transfers.filter((t) => t.status === "Queued").length;
  const completedCount = transfers.filter((t) => t.status === "Completed").length;
  const failedCount = transfers.filter((t) => t.status === "Failed").length;

  const summaryParts: string[] = [];
  if (activeCount > 0) summaryParts.push(`${activeCount} active`);
  if (queuedCount > 0) summaryParts.push(`${queuedCount} queued`);
  if (completedCount > 0) summaryParts.push(`${completedCount} done`);
  if (failedCount > 0) summaryParts.push(`${failedCount} failed`);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col" style={{ maxHeight: expanded ? "40%" : undefined }}>
      {/* Always-visible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex-shrink-0 w-full text-left"
      >
        <ArrowLeftRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="font-semibold">Transfers</span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        ) : (
          <span className="text-gray-500">
            ({transfers.length}{summaryParts.length > 0 ? ` — ${summaryParts.join(", ")}` : ""})
          </span>
        )}
        <div className="flex-1" />
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expandable detail list */}
      {expanded && (
        <div className="overflow-y-auto flex-1 border-t border-gray-200 dark:border-gray-700">
          {transfers.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No transfers yet. Drag files between panes to start.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    {/* Direction icon */}
                    {transfer.transfer_type === "Upload" ? (
                      <Upload className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}

                    {/* File name */}
                    <span className="text-sm font-medium truncate flex-1 min-w-0">
                      {formatFileName(transfer)}
                    </span>

                    {/* Progress bar (inline) */}
                    {(transfer.status === "Active" || transfer.status === "Paused") && (
                      <div className="w-24 flex-shrink-0">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${calculateProgress(transfer)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getStatusIcon(transfer.status)}
                      <span className={`text-xs ${getStatusColor(transfer.status)}`}>
                        {transfer.status === "Active" || transfer.status === "Paused"
                          ? `${calculateProgress(transfer).toFixed(0)}%`
                          : transfer.status}
                      </span>
                    </div>

                    {/* Destination */}
                    <span className="text-xs text-gray-400 truncate max-w-[200px] flex-shrink-0 hidden lg:inline">
                      {formatDestination(transfer)}
                    </span>

                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      {transfer.status === "Active" && transfer.transfer_type === "Download" && (
                        <button
                          onClick={() => handlePause(transfer.id)}
                          className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900"
                          title="Pause"
                        >
                          <Pause className="w-3.5 h-3.5 text-yellow-600" />
                        </button>
                      )}
                      {transfer.status === "Paused" && transfer.transfer_type === "Download" && (
                        <button
                          onClick={() => handleResume(transfer.id)}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
                          title="Resume"
                        >
                          <Play className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      )}
                      {(transfer.status === "Active" ||
                        transfer.status === "Paused" ||
                        transfer.status === "Queued") && (
                        <button
                          onClick={() => handleCancel(transfer.id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timing details */}
                  {formatTimingLine(transfer) && (
                    <div className="text-xs text-gray-400 ml-5 mt-1 tabular-nums">
                      {formatTimingLine(transfer)}
                    </div>
                  )}

                  {/* Error message on its own line */}
                  {transfer.status === "Failed" && transfer.error_message && (
                    <div className="text-xs text-red-600 dark:text-red-400 ml-5 mt-1 truncate">
                      {transfer.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
