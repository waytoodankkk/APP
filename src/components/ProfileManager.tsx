import React, { useState, useEffect } from "react";
import { useAppContext } from "../contexts/AppContext";
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event'; // ✅ IMPORT TỪ EVENT PACKAGE

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

  // ✅ LẮNG NGHE CHROME MANUAL CLOSED EVENT
  useEffect(() => {
    const setupEventListener = async () => {
      try {
        const unlisten = await listen<number>('chrome-manual-closed', (event) => {
          const closedPid = event.payload;
          console.log(`🔔 Chrome manual closed event - PID: ${closedPid}`);
          
          // Tìm profile nào đang có PID này và update UI
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
      cleanup.then(unlisten => unlisten());
    };
  }, [profiles, chromePids, updateProfile, addToast]);

  const handleAddProfile = () => {
    if (newProfileEmail.trim()) {
      addProfile(newProfileEmail.trim());
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

  // 🎯 MỚI: Manual Login với Monitoring
  const handleOpenChromeManualLogin = async (profile: any) => {
  try {
    const runningProfiles = profiles.filter(p => p.isActive);
    if (runningProfiles.length > 0) {
      addToast(`Close Chrome for ${runningProfiles[0].email} first!`, "error");
      return;
    }

    setLoadingProfileId(profile.id);
    
    // ✅ GỌI COMMAND MỚI VỚI APP_HANDLE (Tauri tự inject)
    const pid = await invoke<number>('open_chrome_manual_login', {
      profileEmail: profile.email,
      userDataDir: `../sessions/${profile.email}`,
      url: "https://workspace.google.com/intl/en-US/gmail/"
    });
    
    setChromePids(prev => ({...prev, [profile.id]: pid}));
    
    profiles.forEach(p => {
      if (p.id === profile.id) {
        updateProfile(p.id, { 
          isActive: true,
          profilePath: `sessions/${p.email}`
        });
      } else if (p.isActive) {
        updateProfile(p.id, { isActive: false });
      }
    });
    
    addToast(`Chrome opened for ${profile.email} - Please login manually`, "success");
    
  } catch (error: any) {
    console.error('Open Chrome error:', error);
    addToast(`Failed to open Chrome: ${error.message || error}`, "error");
  } finally {
    setLoadingProfileId(null);
  }
};

  // 🔄 GIỮ NGUYÊN: Headless Extraction (sau này sẽ update)
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

  // Đóng Chrome - DÙNG PID ĐỂ ĐÓNG CHÍNH XÁC
  const handleCloseChrome = async (profile: any) => {
    try {
      setLoadingProfileId(profile.id);
      
      const pid = chromePids[profile.id];
      if (pid) {
        await invoke('close_chrome_by_pid', { pid });
        
        setChromePids(prev => {
          const newPids = {...prev};
          delete newPids[profile.id];
          return newPids;
        });
        
        addToast(`Chrome (PID: ${pid}) closed for ${profile.email}`, "success");
      } else {
        addToast(`Chrome closed for ${profile.email}`, "success");
      }
      
      updateProfile(profile.id, { isActive: false });
      
    } catch (error: any) {
      addToast(`Failed to close Chrome: ${error.message || error}`, "error");
    } finally {
      setLoadingProfileId(null);
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

      {/* 👤 Header */}
      <div className="flex items-center gap-2 mb-4">
        <UserIcon className="w-8 h-8 text-brand-blue" />
        <h2 className="text-xl font-bold">Profiles</h2>
      </div>

      {/* ➕ Add new profile */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newProfileEmail}
          onChange={(e) => setNewProfileEmail(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleAddProfile()}
          placeholder="New profile email..."
          className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <button
          onClick={handleAddProfile}
          className="p-2 bg-brand-blue text-white rounded-md hover:bg-blue-600 transition-colors"
          title="Add new profile"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 📜 Profile list */}
      <ul className="flex-grow overflow-y-auto space-y-1 pr-1 -mr-2">
        {profiles.map((profile) => (
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
                <span className="truncate flex-grow">{profile.email}</span>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Open Chrome Button */}
                  {!profile.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenChromeManualLogin(profile); // ✅ ĐÃ ĐỔI TÊN
                      }}
                      disabled={loadingProfileId === profile.id}
                      className="p-1 text-blue-400 hover:text-blue-300 rounded-full hover:bg-gray-600 transition-colors"
                      title="Open Chrome for Manual Login"
                    >
                      {loadingProfileId === profile.id ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        <ChromeIcon className="w-4 h-4" />
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
                      deleteProfile(profile.id);
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
        ))}
      </ul>

      {/* 🧠 Active Profile Info */}
      {activeProfile && (
        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-400">Active Profile:</p>
          <p>{activeProfile.email}</p>
          {activeProfile.profilePath && (
            <p className="truncate text-gray-400">Path: {activeProfile.profilePath}</p>
          )}
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileManager;