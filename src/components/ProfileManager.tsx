import React, { useState, useEffect } from "react";
import { useAppContext } from "../contexts/AppContext";
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  UserIcon,
  HomeIcon,
  PlayIcon,
  XCircleIcon,
  ChromeIcon,
  KeyIcon,
  CheckIcon,
} from "./IconComponents";

interface ProfileManagerProps {
  onNavigateHome: () => void;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ onNavigateHome }) => {
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    addProfile,
    deleteProfile,
    updateProfile,
    activeProfile,
    addToast,
  } = useAppContext();

  const [newProfileEmail, setNewProfileEmail] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileEmail, setEditingProfileEmail] = useState("");
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [extractingSessionId, setExtractingSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<{[key: string]: string}>({});
  const [chromePids, setChromePids] = useState<{[key: string]: number}>({});
  const [availableSessions, setAvailableSessions] = useState<string[]>([]);
  const [backendHealth, setBackendHealth] = useState<boolean>(false);

  // ✅ KIỂM TRA BACKEND HEALTH
  useEffect(() => {
    checkBackendHealth();
  }, []);

  // ✅ LẤY DANH SÁCH SESSIONS CÓ SẴN
  useEffect(() => {
    if (backendHealth) {
      loadAvailableSessions();
    }
  }, [backendHealth]);

  const checkBackendHealth = async () => {
    try {
      const health = await invoke('check_backend_health');
      setBackendHealth(true);
      console.log('✅ Backend is healthy:', health);
    } catch (error) {
      setBackendHealth(false);
      console.error('❌ Backend not available:', error);
      addToast("Backend not available - Please start FastAPI server", "error");
    }
  };

  const loadAvailableSessions = async () => {
    try {
      const sessions = await invoke('get_available_sessions');
      if (sessions && (sessions as any).available_sessions) {
        setAvailableSessions((sessions as any).available_sessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // ✅ LẮNG NGHE CHROME CLOSED EVENT
  useEffect(() => {
    const setupEventListener = async () => {
      try {
        const unlisten = await listen<number>('chrome-closed', (event) => {
          const closedPid = event.payload;
          console.log(`🔔 Chrome closed event - PID: ${closedPid}`);
          
          const closedProfile = profiles.find(profile => 
            chromePids[profile.id] === closedPid
          );
          
          if (closedProfile) {
            updateProfile(closedProfile.id, { isActive: false });
            setChromePids(prev => {
              const newPids = {...prev};
              delete newPids[closedProfile.id];
              return newPids;
            });
            addToast(`Chrome closed for ${closedProfile.email}`, "info");
          }
        });
        
        return unlisten;
      } catch (error) {
        console.error('Event listener error:', error);
      }
    };

    const cleanup = setupEventListener();
    
    return () => {
      cleanup.then(unlisten => unlisten?.());
    };
  }, [profiles, chromePids, updateProfile, addToast]);

  const handleAddProfile = async () => {
    if (newProfileEmail.trim()) {
      const email = newProfileEmail.trim();
      
      // Tạo session directory trước
      try {
        await invoke('create_session_directory', {
          profileEmail: email
        });
        addToast(`Session directory created for ${email}`, "success");
      } catch (error) {
        console.error('Failed to create session directory:', error);
      }
      
      addProfile(email);
      setNewProfileEmail("");
    }
  };

  const handleStartEdit = (id: string, email: string) => {
    setEditingProfileId(id);
    setEditingProfileEmail(email);
  };

  const handleCancelEdit = () => {
    setEditingProfileId(null);
    setEditingProfileEmail("");
  };

  const handleSaveEdit = () => {
    if (editingProfileId && editingProfileEmail.trim()) {
      updateProfile(editingProfileId, { email: editingProfileEmail.trim() });
      handleCancelEdit();
    }
  };

  // 🚀 MỚI: Mở undetected chromedriver qua FastAPI
  const handleStartUndetectedSession = async (profile: any) => {
    try {
      if (!backendHealth) {
        addToast("Backend not available - Please start FastAPI server", "error");
        await checkBackendHealth();
        return;
      }

      const runningProfiles = profiles.filter(p => p.isActive);
      if (runningProfiles.length > 0) {
        addToast(`Close Chrome for ${runningProfiles[0].email} first!`, "error");
        return;
      }

      setLoadingProfileId(profile.id);
      
      console.log(`🚀 Starting undetected session for: ${profile.email}`);
      
      // ✅ GỌI FASTAPI BACKEND ĐỂ MỞ UNDETECTED CHROMEDRIVER
      const result = await invoke<any>('start_undetected_session', {
        profileEmail: profile.email,
        url: "https://labs.google/fx/vi/tools/flow"
      });
      
      console.log('✅ FastAPI response:', result);
      
      if (result.success) {
        // Cập nhật UI với thông tin từ FastAPI
        updateProfile(profile.id, { 
          isActive: true,
          profilePath: `sessions/${profile.email}`,
          loggedIn: result.logged_in,
          url: result.url
        });
        
        if (result.pid) {
          setChromePids(prev => ({...prev, [profile.id]: result.pid}));
        }
        
        const statusMsg = result.logged_in 
          ? `✅ Session persisted! ${profile.email} is logged in` 
          : `⚠️ Please login manually for ${profile.email}`;
          
        addToast(statusMsg, result.logged_in ? "success" : "warning");
        
        // Cập nhật session status
        setSessionStatus(prev => ({
          ...prev, 
          [profile.id]: result.logged_in ? 'logged_in' : 'needs_login'
        }));
        
      } else {
        addToast(`Failed to start session: ${result.message}`, "error");
      }
      
    } catch (error: any) {
      console.error('Start undetected session error:', error);
      addToast(`Failed to start session: ${error.message || error}`, "error");
    } finally {
      setLoadingProfileId(null);
    }
  };

  // 🔄 Headless Extraction (giữ nguyên)
  const handleExtractTokens = async (profile: any) => {
    try {
      setExtractingSessionId(profile.id);
      setSessionStatus(prev => ({...prev, [profile.id]: 'extracting'}));
      
      const tokens = await invoke('extract_tokens_from_profile', {
        profileEmail: profile.email,
        userDataDir: profile.profilePath || `sessions/${profile.email}`
      });
      
      await invoke('save_extracted_tokens', {
        profileEmail: profile.email,
        tokens: tokens
      });
      
      setSessionStatus(prev => ({...prev, [profile.id]: 'success'}));
      addToast(`Tokens extracted for ${profile.email}`, "success");
      
    } catch (error: any) {
      console.error('Extract tokens error:', error);
      setSessionStatus(prev => ({...prev, [profile.id]: 'error'}));
      addToast(`Failed to extract tokens: ${error.message || error}`, "error");
    } finally {
      setExtractingSessionId(null);
    }
  };

  // Đóng Chrome qua FastAPI
  const handleCloseChrome = async (profile: any) => {
    try {
      setLoadingProfileId(profile.id);
      
      if (backendHealth) {
        // Thử đóng qua FastAPI trước
        const result = await invoke('stop_session_via_api', {
          profileEmail: profile.email
        });
        console.log('Stop session result:', result);
      }
      
      // Fallback: đóng bằng PID nếu có
      const pid = chromePids[profile.id];
      if (pid) {
        await invoke('close_chrome_by_pid', { pid });
        setChromePids(prev => {
          const newPids = {...prev};
          delete newPids[profile.id];
          return newPids;
        });
      }
      
      updateProfile(profile.id, { isActive: false, loggedIn: false });
      setSessionStatus(prev => ({...prev, [profile.id]: 'closed'}));
      
      addToast(`Chrome closed for ${profile.email}`, "success");
      
    } catch (error: any) {
      console.error('Close Chrome error:', error);
      addToast(`Failed to close Chrome: ${error.message || error}`, "error");
    } finally {
      setLoadingProfileId(null);
    }
  };

  // Xóa profile + session directory
  const handleDeleteProfile = async (profileId: string, profileEmail: string) => {
    try {
      // Xóa session directory
      await invoke('delete_session_directory', {
        profileEmail: profileEmail
      });
      
      // Xóa profile từ UI
      deleteProfile(profileId);
      
      addToast(`Profile ${profileEmail} deleted`, "success");
    } catch (error) {
      console.error('Delete profile error:', error);
      // Vẫn xóa profile khỏi UI nếu có lỗi
      deleteProfile(profileId);
      addToast(`Profile ${profileEmail} deleted`, "success");
    }
  };

  return (
    <div className="bg-gray-800 w-full max-w-xs flex-shrink-0 p-4 flex flex-col h-full border-r border-gray-700">
      {/* 🏠 Return to homepage */}
      <button
        onClick={onNavigateHome}
        className="w-full flex items-center gap-3 p-3 mb-4 rounded-lg text-lg font-semibold text-gray-200 border border-gray-700 hover:bg-gray-700 hover:text-white transition-colors"
      >
        <HomeIcon className="w-6 h-6" />
        <span>Homepage</span>
      </button>

      {/* Backend Status */}
      <div className="flex items-center gap-2 mb-4 p-2 rounded-md bg-gray-700">
        <div className={`w-3 h-3 rounded-full ${backendHealth ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-sm text-gray-300">
          Backend: {backendHealth ? 'Connected' : 'Disconnected'}
        </span>
        <button 
          onClick={checkBackendHealth}
          className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
        >
          Refresh
        </button>
      </div>

      {/* 👤 Header */}
      <div className="flex items-center gap-2 mb-4">
        <UserIcon className="w-8 h-8 text-brand-blue" />
        <h2 className="text-xl font-bold">Profiles</h2>
        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
          {availableSessions.length} sessions
        </span>
      </div>

      {/* ➕ Add new profile */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newProfileEmail}
          onChange={(e) => setNewProfileEmail(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleAddProfile()}
          placeholder="user@gmail.com"
          className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <button
          onClick={handleAddProfile}
          disabled={!backendHealth}
          className="p-2 bg-brand-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          title="Add new profile"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 📜 Profile list */}
      <ul className="flex-grow overflow-y-auto space-y-1 pr-1 -mr-2">
        {profiles.map((profile) => {
          const sessionExists = availableSessions.includes(profile.email);
          const isLoggedIn = sessionStatus[profile.id] === 'logged_in';
          
          return (
            <li key={profile.id}>
              {editingProfileId === profile.id ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-gray-900">
                  <input
                    type="text"
                    value={editingProfileEmail}
                    onChange={(e) => setEditingProfileEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSaveEdit()}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="text-green-400 hover:text-green-300 text-sm font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-400 hover:text-gray-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setActiveProfileId(profile.id)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors group ${
                    activeProfileId === profile.id
                      ? "bg-brand-blue/30 text-white"
                      : "hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex flex-col flex-grow min-w-0">
                    <span className="truncate text-sm">{profile.email}</span>
                    <div className="flex items-center gap-1 mt-1">
                      {sessionExists && (
                        <span className="text-xs text-green-400">✓ Session</span>
                      )}
                      {isLoggedIn && (
                        <span className="text-xs text-blue-400">✓ Logged in</span>
                      )}
                      {profile.isActive && (
                        <span className="text-xs text-yellow-400">● Running</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Start Undetected Chrome Button */}
                    {!profile.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartUndetectedSession(profile);
                        }}
                        disabled={loadingProfileId === profile.id || !backendHealth}
                        className="p-1 text-green-400 hover:text-green-300 rounded-full hover:bg-gray-600 transition-colors disabled:opacity-50"
                        title="Start Undetected Chrome Session"
                      >
                        {loadingProfileId === profile.id ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          <PlayIcon className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Extract Tokens Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExtractTokens(profile);
                      }}
                      disabled={extractingSessionId === profile.id}
                      className={`p-1 rounded-full hover:bg-gray-600 transition-colors ${
                        sessionStatus[profile.id] === 'success' 
                          ? 'text-green-400' 
                          : sessionStatus[profile.id] === 'error'
                          ? 'text-red-400'
                          : 'text-yellow-400 hover:text-yellow-300'
                      }`}
                      title="Extract Session Tokens"
                    >
                      {extractingSessionId === profile.id ? (
                        <div className="loading-spinner"></div>
                      ) : sessionStatus[profile.id] === 'success' ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        <KeyIcon className="w-4 h-4" />
                      )}
                    </button>

                    {/* Close Chrome Button */}
                    {profile.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseChrome(profile);
                        }}
                        disabled={loadingProfileId === profile.id}
                        className="p-1 text-red-400 hover:text-red-300 rounded-full hover:bg-gray-600 transition-colors"
                        title="Close Chrome"
                      >
                        {loadingProfileId === profile.id ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          <XCircleIcon className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(profile.id, profile.email);
                      }}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-600 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(profile.id, profile.email);
                      }}
                      className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-gray-600 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* 🧠 Active Profile Info */}
      {activeProfile && (
        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-400">Active Profile:</p>
          <p>{activeProfile.email}</p>
          {activeProfile.profilePath && (
            <p className="truncate text-gray-400">Path: {activeProfile.profilePath}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${
              activeProfile.isActive ? "text-green-400" : "text-gray-500"
            }`}>
              {activeProfile.isActive ? "🟢 Chrome Running" : "🔴 Chrome Closed"}
            </span>
            {chromePids[activeProfile.id] && (
              <span className="text-blue-400 text-xs">PID: {chromePids[activeProfile.id]}</span>
            )}
            {sessionStatus[activeProfile.id] === 'success' && (
              <span className="text-green-400 text-xs">✓ Tokens Ready</span>
            )}
            {sessionStatus[activeProfile.id] === 'logged_in' && (
              <span className="text-blue-400 text-xs">✓ Logged In</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileManager;