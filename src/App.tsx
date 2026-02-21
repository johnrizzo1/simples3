// Full SimpleS3 Application

import { useState } from "react";
import { LocalPane } from "./components/LocalPane";
import { EndpointManager } from "./components/EndpointManager";
import { S3Pane } from "./components/S3Pane";
import { TransferQueue } from "./components/TransferQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { Settings, FolderTree, ArrowLeftRight, Sliders } from "lucide-react";

type View = "files" | "endpoints" | "transfers" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("files");

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold">SimpleS3</h1>

        <nav className="flex gap-2">
          <button
            onClick={() => setCurrentView("files")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              currentView === "files"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Files
          </button>
          <button
            onClick={() => setCurrentView("endpoints")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              currentView === "endpoints"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <Settings className="w-4 h-4" />
            Endpoints
          </button>
          <button
            onClick={() => setCurrentView("transfers")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              currentView === "transfers"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfers
          </button>
          <button
            onClick={() => setCurrentView("settings")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              currentView === "settings"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Settings
          </button>
        </nav>

        <div className="text-sm text-gray-500">S3 Client Desktop Application</div>
      </header>

      <main className="flex-1 overflow-hidden">
        {currentView === "files" && (
          <div className="h-full flex">
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
        )}

        {currentView === "endpoints" && (
          <div className="h-full">
            <EndpointManager />
          </div>
        )}

        {currentView === "transfers" && (
          <div className="h-full">
            <TransferQueue />
          </div>
        )}

        {currentView === "settings" && (
          <div className="h-full">
            <SettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
