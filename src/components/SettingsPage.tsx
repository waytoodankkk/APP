
import React, { useState, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { KeyIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from './IconComponents';
import { Project } from '../types';

const SettingsPage: React.FC = () => {
  const { apiKey, setApiKey, projects, setProjects, addToast } = useAppContext();
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleSaveKey = () => {
    setApiKey(tempApiKey);
    addToast("API Key saved successfully.", 'success');
  };

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify({ projects }, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `gemini-suite-backup-${new Date().toISOString().slice(0,10)}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      addToast("Projects exported successfully.", 'success');
    } catch (error) {
      console.error("Export failed:", error);
      addToast("Failed to export projects.", 'error');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("File is not valid text.");
        }
        const data = JSON.parse(text);
        if (data && Array.isArray(data.projects)) {
          // Basic validation for project structure
          const isValid = data.projects.every((p: any) => p.id && p.name);
          if (isValid) {
            setProjects(data.projects as Project[]);
            addToast("Projects imported successfully.", 'success');
          } else {
            throw new Error("Imported file has invalid project structure.");
          }
        } else {
          throw new Error("Invalid import file format.");
        }
      } catch (error: any) {
        console.error("Import failed:", error);
        addToast(`Import failed: ${error.message}`, 'error');
      } finally {
        // Reset file input
        if (importFileRef.current) {
            importFileRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };


  return (
    <div className="flex flex-col h-full">
      <header className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-10">

          {/* API Key Section */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3"><KeyIcon className="w-6 h-6 text-brand-blue" /> API Key Management</h2>
            <p className="text-gray-400 mb-4 text-sm">
                Your Gemini API Key is stored locally in your browser and is required for all AI features.
                You can get your key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Google AI Studio</a>.
                Also, ensure you have enabled billing for your project at <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">ai.google.dev</a>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <button
                    onClick={handleSaveKey}
                    className="px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
                >
                    Save Key
                </button>
            </div>
          </div>

          {/* Data Management Section */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">Data Management</h2>
            <p className="text-gray-400 mb-4 text-sm">
                Export all your projects, including VEO jobs and Gemini chats, into a single JSON file for backup. You can import this file later to restore your work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={handleExport}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors"
                >
                    <ArrowUpTrayIcon className="w-5 h-5"/>
                    Export Data
                </button>
                <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors"
                >
                    <ArrowDownTrayIcon className="w-5 h-5"/>
                    Import Data
                </button>
                <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImport}
                    className="hidden"
                    accept=".json"
                />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
