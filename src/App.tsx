// Full SimpleS3 Application

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LocalPane } from "./components/LocalPane";
import { EndpointManager } from "./components/EndpointManager";
import { S3Pane } from "./components/S3Pane";
import { TransferQueue } from "./components/TransferQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ClipboardProvider } from "./contexts/ClipboardContext";
import { useTheme } from "./hooks/useTheme";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { AppConfig, AppState, S3Endpoint, Theme, TransferJob } from "./types/models";
import { Server, FolderTree, Sliders, WifiOff } from "lucide-react";

type View = "files" | "endpoints" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("files");
  const [theme, setTheme] = useState<Theme>(Theme.System);
  const [initialLocalPath, setInitialLocalPath] = useState<string | undefined>(undefined);
  const [initialS3Bucket, setInitialS3Bucket] = useState<string | undefined>(undefined);
  const [initialS3Prefix, setInitialS3Prefix] = useState<string | undefined>(undefined);
  const [_stateLoaded, setStateLoaded] = useState(false);
  const [endpoints, setEndpoints] = useState<S3Endpoint[]>([]);
  const [s3RefreshKey, setS3RefreshKey] = useState(0);
  const isOnline = useNetworkStatus();
  const autoPausedRef = useRef<Set<string>>(new Set());
  const currentViewRef = useRef<View>("files");
  currentViewRef.current = currentView;

  const loadEndpoints = useCallback(() => {
    invoke<S3Endpoint[]>("list_endpoints")
      .then(setEndpoints)
      .catch((err) => console.error("Failed to load endpoints:", err));
  }, []);

  // Load config, app state, and endpoints on mount
  useEffect(() => {
    invoke<AppConfig>("get_config")
      .then((config) => setTheme(config.theme))
      .catch((err) => console.error("Failed to load config:", err));

    loadEndpoints();

    invoke<AppState>("get_app_state")
      .then((state) => {
        if (state.current_view === "files" || state.current_view === "endpoints" || state.current_view === "settings") {
          setCurrentView(state.current_view as View);
        }
        if (state.local_path) setInitialLocalPath(state.local_path);
        if (state.s3_bucket) setInitialS3Bucket(state.s3_bucket);
        if (state.s3_prefix) setInitialS3Prefix(state.s3_prefix);
        setStateLoaded(true);
      })
      .catch(() => setStateLoaded(true));
  }, []);

  // Save app state before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state: AppState = {
        current_view: currentViewRef.current,
        local_path: null,
        s3_bucket: null,
        s3_prefix: null,
      };
      // Use sendBeacon-style approach (fire-and-forget)
      invoke("save_app_state", { state }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Apply theme to document
  useTheme(theme);

  // Auto-pause transfers when offline, auto-resume when back online
  useEffect(() => {
    if (!isOnline) {
      // Going offline: pause active transfers
      invoke<TransferJob[]>("get_transfer_queue")
        .then((transfers) => {
          const active = transfers.filter((t) => t.status === "Active");
          for (const t of active) {
            invoke("pause_transfer", { jobId: t.id })
              .then(() => autoPausedRef.current.add(t.id))
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      // Coming back online: resume auto-paused transfers
      const toResume = Array.from(autoPausedRef.current);
      autoPausedRef.current.clear();
      for (const id of toResume) {
        invoke("resume_transfer", { jobId: id }).catch(() => {});
      }
    }
  }, [isOnline]);

  const handleEndpointChange = useCallback(async (endpointId: string) => {
    try {
      await invoke("set_active_endpoint", { endpointId });
      loadEndpoints();
      setS3RefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to switch endpoint:", err);
    }
  }, [loadEndpoints]);

  const handleViewChange = useCallback((view: View) => {
    // Refresh endpoints when leaving the endpoints page (picks up adds/deletes)
    if (currentView === "endpoints" && view !== "endpoints") {
      loadEndpoints();
    }
    setCurrentView(view);
  }, [currentView, loadEndpoints]);

  // Apply theme immediately when user changes selection
  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  // Callback for when settings are saved
  const handleConfigSaved = useCallback(() => {
    invoke<AppConfig>("get_config")
      .then((config) => setTheme(config.theme))
      .catch((err) => console.error("Failed to reload config:", err));
  }, []);

  return (
    <ClipboardProvider>
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" onContextMenu={(e) => e.preventDefault()}>
      <header className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold">SimpleS3</h1>

        {!isOnline && (
          <div className="ml-3 flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </div>
        )}

        <nav className="flex gap-2 ml-auto">
          <button
            onClick={() => handleViewChange("files")}
            className={`p-2 rounded ${
              currentView === "files"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            title="Files"
          >
            <FolderTree className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleViewChange("endpoints")}
            className={`p-2 rounded ${
              currentView === "endpoints"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            title="Endpoints"
          >
            <Server className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleViewChange("settings")}
            className={`p-2 rounded ${
              currentView === "settings"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            title="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </nav>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <div className={`h-full flex ${currentView !== "files" ? "hidden" : ""}`}>
            <div className="flex-1 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
              <ErrorBoundary label="Local Files">
                <LocalPane initialPath={initialLocalPath} />
              </ErrorBoundary>
            </div>

            <div className="flex-1 overflow-hidden">
              <ErrorBoundary label="S3 Storage">
                <S3Pane initialBucket={initialS3Bucket} initialPrefix={initialS3Prefix} refreshKey={s3RefreshKey} endpoints={endpoints} onEndpointChange={handleEndpointChange} />
              </ErrorBoundary>
            </div>
          </div>

          <div className={`h-full ${currentView !== "endpoints" ? "hidden" : ""}`}>
            <ErrorBoundary label="Endpoints">
              <EndpointManager />
            </ErrorBoundary>
          </div>

          <div className={`h-full ${currentView !== "settings" ? "hidden" : ""}`}>
            <ErrorBoundary label="Settings">
              <SettingsPanel onConfigSaved={handleConfigSaved} onThemeChange={handleThemeChange} />
            </ErrorBoundary>
          </div>
        </main>

        {/* Transfer drawer */}
        <ErrorBoundary label="Transfers">
          <TransferQueue />
        </ErrorBoundary>
      </div>
    </div>
    </ClipboardProvider>
  );
}

export default App;
