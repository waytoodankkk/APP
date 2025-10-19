import './tailwind.css';

import React, { useState } from 'react';
import { AppModule } from './types';
import { AppContextProvider, useAppContext } from './contexts/AppContext';
import Homepage from './components/Homepage';
import VeoAutomator from './modules/veo/VeoAutomator';
import GeminiPlayground from './modules/gemini/GeminiPlayground';
import SettingsPage from './components/SettingsPage';
import ProfileManager from './components/ProfileManager';
import ToastContainer from './components/Toast';
import { MenuIcon, UserIcon } from './components/IconComponents';

interface MainLayoutProps {
  children: React.ReactNode;
  onNavigateHome: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, onNavigateHome }) => {
  const { activeProfile } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <ProfileManager onNavigateHome={onNavigateHome} />
          </div>
        </div>
      )}

      {/* Sidebar for Desktop */}
      <div className="hidden md:flex">
        <ProfileManager onNavigateHome={onNavigateHome} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-700"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <span className="text-sm font-semibold truncate">
            {activeProfile?.email || 'No Profile Selected'}
          </span>
        </header>

        <main className="flex-1 overflow-hidden">
          {activeProfile ? (
            children
          ) : (
            <div className="flex items-center justify-center h-full text-center text-gray-400">
              <div>
                <UserIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold">No Profile Selected</h2>
                <p>Please create a new profile or select one from the sidebar to begin.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AppModule>('homepage');
  const handleNavigateHome = () => setActiveModule('homepage');

  const renderActiveModule = () => {
    if (activeModule === 'homepage') {
      return <Homepage onSelectModule={setActiveModule} />;
    }

    let ModuleComponent;
    switch (activeModule) {
      case 'veo':
        ModuleComponent = <VeoAutomator />;
        break;
      case 'gemini':
        ModuleComponent = <GeminiPlayground />;
        break;
      case 'settings':
        ModuleComponent = <SettingsPage />;
        break;
      default:
        return <Homepage onSelectModule={setActiveModule} />;
    }

    return <MainLayout onNavigateHome={handleNavigateHome}>{ModuleComponent}</MainLayout>;
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      {renderActiveModule()}
      <ToastContainer />
    </div>
  );
};

const App: React.FC = () => (
  <AppContextProvider>
    <AppContent />
  </AppContextProvider>
);

export default App;
