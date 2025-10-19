import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Project, LogEntry, LogLevel, Toast } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface GlobalAdvancedImageOptions {
  negativePrompt: string;
  stylization: string;
  quality: 'Standard' | 'HD';
  imageStrength: number;
  numberOfImages: number;
}

export interface Profile {
  id: string;
  email: string;
  path: string;
  created: string;
  isActive?: boolean;
  profilePath?: string; // ✅ ĐÃ THÊM DÒNG NÀY
}

interface AppContextType {
  apiKey: string;
  setApiKey: (key: string) => void;

  // 🧩 Projects
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProject: Project | undefined;
  addProject: (name: string) => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateActiveProject: (updater: (prevProject: Project) => Partial<Project>) => void;

  // 👤 Profiles
  profiles: Profile[];
  setProfiles: (profiles: Profile[]) => void;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  activeProfile: Profile | undefined;
  addProfile: (email: string) => void;
  deleteProfile: (id: string) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;

  // 🧱 Logs & Toasts
  logs: LogEntry[];
  addLog: (message: string, level?: LogLevel) => void;
  toasts: Toast[];
  addToast: (message: string, level: 'success' | 'error' | 'info') => void;

  // 🌄 Global image options
  imageForVeo: string | null;
  setImageForVeo: (image: string | null) => void;
  globalImageOptions: GlobalAdvancedImageOptions;
  setGlobalImageOptions: React.Dispatch<React.SetStateAction<GlobalAdvancedImageOptions>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 🔑 API Key
  const [apiKey, setApiKey] = useLocalStorage<string>('gemini-api-key', '');

  // 🎬 Projects
  const [projects, setProjects] = useLocalStorage<Project[]>('app-projects', []);
  const [activeProjectId, setActiveProjectId] = useLocalStorage<string | null>('active-project-id', null);

  // 👤 Profiles
  const [profiles, setProfiles] = useLocalStorage<Profile[]>('app-profiles', []);
  const [activeProfileId, setActiveProfileId] = useLocalStorage<string | null>('active-profile-id', null);

  // 🔔 Logs & Toasts
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 🌄 Global image data
  const [imageForVeo, setImageForVeo] = useState<string | null>(null);
  const [globalImageOptions, setGlobalImageOptions] = useLocalStorage<GlobalAdvancedImageOptions>(
    'global-image-options',
    {
      negativePrompt:
        'low quality, blurry, bad anatomy, worst quality, text, watermark, cgi, 3d, anime, cartoon, illustration',
      stylization: 'Photography',
      quality: 'Standard',
      imageStrength: 80,
      numberOfImages: 1,
    }
  );

  // 🎯 Active Project / Profile
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // 🩺 Sync IDs when deleted
  useEffect(() => {
    if (projects.length > 0 && (!activeProjectId || !projects.find((p) => p.id === activeProjectId))) {
      setActiveProjectId(projects[0].id);
    }
    if (projects.length === 0 && activeProjectId) {
      setActiveProjectId(null);
    }

    if (profiles.length > 0 && (!activeProfileId || !profiles.find((p) => p.id === activeProfileId))) {
      setActiveProfileId(profiles[0].id);
    }
    if (profiles.length === 0 && activeProfileId) {
      setActiveProfileId(null);
    }
  }, [projects, profiles, activeProjectId, activeProfileId, setActiveProjectId, setActiveProfileId]);

  // 🧾 Logs
  const addLog = useCallback((message: string, level: LogLevel = LogLevel.INFO) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
    };
    setLogs((prevLogs) => [...prevLogs, newLog].slice(-200));
  }, []);

  // 🔔 Toasts
  const addToast = (message: string, level: 'success' | 'error' | 'info') => {
    const newToast: Toast = { id: uuidv4(), message, level };
    setToasts((prevToasts) => [...prevToasts, newToast]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  // 🎬 Project CRUD
  const addProject = (name: string) => {
    const newProject: Project = { id: uuidv4(), name, veoJobs: [], geminiJobs: [], geminiChat: [] };
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    setActiveProjectId(newProject.id);
    addToast(`Project "${name}" created.`, 'success');
  };

  const deleteProject = (id: string) => {
    if (window.confirm('Are you sure you want to delete this project and all its data?')) {
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) setActiveProjectId(remaining[0]?.id || null);
      addToast('Project deleted.', 'success');
    }
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const updateActiveProject = useCallback(
    (updater: (prevProject: Project) => Partial<Project>) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, ...updater(p) } : p))
      );
    },
    [activeProjectId, setProjects]
  );

  // 👤 Profile CRUD
const addProfile = (email: string) => {
  // ✅ KIỂM TRA EMAIL ĐÃ TỒN TẠI
  const emailExists = profiles.some(profile => 
    profile.email.toLowerCase() === email.toLowerCase()
  );
  
  if (emailExists) {
    addToast(`Profile "${email}" already exists!`, "error");
    return;
  }

  // ✅ KIỂM TRA EMAIL FORMAT
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    addToast("Please enter a valid email address!", "error");
    return;
  }

  console.log("🔄 START addProfile for:", email);

  const newProfile: Profile = {
    id: uuidv4(),
    email,
    path: `profiles/${email}`,
    created: new Date().toISOString(),
    isActive: false,
    profilePath: `sessions/${email}`
  };

  // ✅ GỌI COMMAND TẠO FOLDER SESSION
  const createSessionFolder = async () => {
    try {
      console.log("📞 Calling create_session_directory...");
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('create_session_directory', { profileEmail: email });
      console.log("✅ Command result:", result);
    } catch (err) {
      console.log("❌ Command error:", err);
    }
  };

  createSessionFolder();

  const updatedProfiles = [...profiles, newProfile];
  setProfiles(updatedProfiles);
  setActiveProfileId(newProfile.id);
  addToast(`Profile "${email}" created.`, "success");
  console.log("🏁 FINISHED addProfile");
};

// ✅ XÓA FOLDER SESSION KHI XÓA PROFILE  

  const deleteProfile = (id: string) => {
    if (window.confirm('Are you sure you want to delete this profile?')) {
      const profileToDelete = profiles.find(p => p.id === id);
      
      if (profileToDelete) {
        // ✅ GỌI COMMAND XÓA FOLDER SESSION
        const deleteSessionFolder = async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('delete_session_directory', { profileEmail: profileToDelete.email });
            console.log(`🗑️ Deleted session folder for: ${profileToDelete.email}`);
          } catch (err) {
            console.log('⚠️ Directory deletion warning:', err);
          }
        };
        deleteSessionFolder();
      }

      const remaining = profiles.filter((p) => p.id !== id);
      setProfiles(remaining);
      if (activeProfileId === id) setActiveProfileId(remaining[0]?.id || null);
      addToast('Profile deleted.', 'success');
    }
  };

  const updateProfile = (id: string, updates: Partial<Profile>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  // 💡 Context value
  const contextValue: AppContextType = {
    apiKey,
    setApiKey,

    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    addProject,
    deleteProject,
    updateProject,
    updateActiveProject,

    profiles,
    setProfiles,
    activeProfileId,
    setActiveProfileId,
    activeProfile,
    addProfile,
    deleteProfile,
    updateProfile,

    logs,
    addLog,
    toasts,
    addToast,

    imageForVeo,
    setImageForVeo,
    globalImageOptions,
    setGlobalImageOptions,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within an AppContextProvider');
  return ctx;
};