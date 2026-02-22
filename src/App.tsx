// Full SimpleS3 Application

import { useState } from "react";
import { LocalPane } from "./components/LocalPane";
import { EndpointManager } from "./components/EndpointManager";
import { S3Pane } from "./components/S3Pane";
import { TransferQueue } from "./components/TransferQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { ClipboardProvider } from "./contexts/ClipboardContext";
import { Server, FolderTree, Sliders } from "lucide-react";

type View = "files" | "endpoints" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("files");

  return (
    <ClipboardProvider>
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" onContextMenu={(e) => e.preventDefault()}>
      <header className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold">SimpleS3</h1>

        <nav className="flex gap-2 ml-auto">
          <button
            onClick={() => setCurrentView("files")}
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
            onClick={() => setCurrentView("endpoints")}
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
            onClick={() => setCurrentView("settings")}
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
            <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
              <div className="h-full flex flex-col">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold">Local Files</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LocalPane />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="h-full flex flex-col">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold">S3 Storage</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <S3Pane />
                </div>
              </div>
            </div>
          </div>

          <div className={`h-full ${currentView !== "endpoints" ? "hidden" : ""}`}>
            <EndpointManager />
          </div>

          <div className={`h-full ${currentView !== "settings" ? "hidden" : ""}`}>
            <SettingsPanel />
          </div>
        </main>

        {/* Transfer drawer */}
        <TransferQueue />
      </div>
    </div>
    </ClipboardProvider>
  );
}

export default App;
