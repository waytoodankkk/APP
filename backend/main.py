from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import undetected_chromedriver as uc
import os
import time
import threading
import json
import subprocess
from typing import Optional, List

app = FastAPI(
    title="Gemini Creative Suite API",
    description="Multi-user Chrome Session Manager with Undetected Chromedriver",
    version="1.0.0"
)

# CORS - cho phép frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:1420"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class SessionRequest(BaseModel):
    email: str
    url: Optional[str] = "https://labs.google/fx/vi/tools/flow"

class SessionResponse(BaseModel):
    success: bool
    message: str
    email: Optional[str] = None
    logged_in: Optional[bool] = None
    url: Optional[str] = None
    cookies_count: Optional[int] = None
    google_cookies: Optional[int] = None
    pid: Optional[int] = None

class ProfileResponse(BaseModel):
    email: str
    path: str
    exists: bool

# Store active sessions
active_sessions = {}
session_lock = threading.Lock()

def start_chrome_session(email: str, target_url: str) -> dict:
    """Start undetected chromedriver với session persistence"""
    profile_path = os.path.abspath(f"../sessions/{email}")
    
    print(f"🎯 Starting session for: {email}")
    print(f"📁 Profile path: {profile_path}")
    print(f"🎯 Target URL: {target_url}")
    
    if not os.path.exists(profile_path):
        print("❌ Profile path not found!")
        return {"success": False, "message": "Profile directory not found"}
    
    try:
        # Chrome options - DÙNG CODE ĐÃ TEST THÀNH CÔNG
        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={profile_path}")
        options.add_argument("--no-first-run")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--window-size=1200,800")
        # 🚫 KHÔNG headless - để user thấy browser
        
        print("🚀 Starting undetected Chrome driver...")
        driver = uc.Chrome(options=options)
        
        print("✅ Chrome started successfully!")
        print(f"🌐 Current URL: {driver.current_url}")
        
        # Navigate đến target URL
        print(f"🔄 Navigating to: {target_url}")
        driver.get(target_url)
        time.sleep(3)
        
        current_url = driver.current_url
        print(f"🌐 After navigation URL: {current_url}")
        
        # Check session status
        is_logged_in = "accounts.google.com" not in current_url and "signin" not in current_url
        
        # Get session info
        cookies = driver.get_cookies()
        google_cookies = [c for c in cookies if 'google' in c.get('domain', '')]
        
        status_message = "🎉 Session persisted! User is likely logged in!" if is_logged_in else "❌ Redirected to login page"
        
        print(f"🔐 Logged in: {is_logged_in}")
        print(f"🍪 Cookies: {len(cookies)} total, {len(google_cookies)} Google")
        print(status_message)
        
        # Lưu driver và thông tin
        with session_lock:
            active_sessions[email] = {
                'driver': driver,
                'pid': driver.service.process.pid if driver.service and driver.service.process else None,
                'started_at': time.time()
            }
        
        return {
            "success": True,
            "email": email,
            "logged_in": is_logged_in,
            "url": current_url,
            "cookies_count": len(cookies),
            "google_cookies": len(google_cookies),
            "pid": active_sessions[email]['pid'],
            "message": status_message
        }
        
    except Exception as e:
        print(f"❌ Chrome driver error: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

# API Routes
@app.get("/")
async def root():
    return {
        "message": "🚀 Gemini Creative Suite API", 
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "start_session": "/api/session/start",
            "stop_session": "/api/session/stop/{email}",
            "active_sessions": "/api/sessions/active",
            "available_sessions": "/api/sessions/available",
            "create_session": "/api/session/create",
            "kill_process": "/api/process/kill/{pid}"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "Gemini Creative Suite Backend",
        "active_sessions": len(active_sessions),
        "timestamp": time.time()
    }

@app.post("/api/session/start", response_model=SessionResponse)
async def start_session(request: SessionRequest):
    """API endpoint để frontend gọi start session"""
    print(f"📨 Received start session request for: {request.email}")
    result = start_chrome_session(request.email, request.url)
    return SessionResponse(**result)

@app.delete("/api/session/stop/{email}")
async def stop_session(email: str):
    """Dừng session cho user"""
    try:
        with session_lock:
            if email in active_sessions:
                driver_info = active_sessions[email]
                driver_info['driver'].quit()
                del active_sessions[email]
                print(f"✅ Session stopped for: {email}")
                return {"success": True, "message": f"Session stopped for {email}"}
            else:
                return {"success": False, "message": f"No active session for {email}"}
    except Exception as e:
        print(f"❌ Error stopping session for {email}: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@app.get("/api/sessions/active")
async def get_active_sessions():
    """Lấy danh sách sessions đang active"""
    active_list = []
    with session_lock:
        for email, info in active_sessions.items():
            active_list.append({
                "email": email,
                "pid": info['pid'],
                "started_at": info['started_at'],
                "running_time": time.time() - info['started_at']
            })
    
    return {
        "active_sessions": active_list,
        "count": len(active_list)
    }

@app.get("/api/sessions/available", response_model=List[ProfileResponse])
async def get_available_sessions():
    """Lấy danh sách profiles có sẵn"""
    sessions_dir = "../sessions"
    sessions = []
    
    if os.path.exists(sessions_dir):
        for item in os.listdir(sessions_dir):
            profile_path = os.path.join(sessions_dir, item)
            if os.path.isdir(profile_path):
                sessions.append(ProfileResponse(
                    email=item,
                    path=profile_path,
                    exists=True
                ))
    
    return sessions

@app.post("/api/session/create")
async def create_session(request: SessionRequest):
    """Tạo session directory mới"""
    profile_path = f"../sessions/{request.email}"
    
    try:
        if not os.path.exists(profile_path):
            os.makedirs(profile_path, exist_ok=True)
            print(f"✅ Created session directory: {profile_path}")
            return {"success": True, "message": f"Session created for {request.email}"}
        else:
            return {"success": False, "message": "Session already exists"}
    except Exception as e:
        print(f"❌ Error creating session directory: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@app.post("/api/process/kill/{pid}")
async def kill_process(pid: int):
    """Kill process by PID"""
    try:
        if os.name == 'nt':  # Windows
            subprocess.run(['taskkill', '/F', '/PID', str(pid)], check=True, capture_output=True)
        else:  # Unix
            subprocess.run(['kill', '-9', str(pid)], check=True, capture_output=True)
        print(f"✅ Process {pid} killed")
        return {"success": True, "message": f"Process {pid} killed"}
    except subprocess.CalledProcessError as e:
        print(f"❌ Error killing process {pid}: {str(e)}")
        return {"success": False, "message": f"Error killing process: {str(e)}"}
    except Exception as e:
        print(f"❌ Unexpected error killing process {pid}: {str(e)}")
        return {"success": False, "message": f"Unexpected error: {str(e)}"}

@app.get("/api/session/status/{email}")
async def get_session_status(email: str):
    """Check status của session cụ thể"""
    with session_lock:
        if email in active_sessions:
            driver = active_sessions[email]['driver']
            try:
                current_url = driver.current_url
                title = driver.title
                return {
                    "active": True,
                    "email": email,
                    "url": current_url,
                    "title": title,
                    "pid": active_sessions[email]['pid'],
                    "running_time": time.time() - active_sessions[email]['started_at']
                }
            except Exception as e:
                return {
                    "active": False, 
                    "message": "Session exists but driver not responsive",
                    "error": str(e)
                }
        else:
            # Check if profile exists
            profile_path = f"../sessions/{email}"
            exists = os.path.exists(profile_path)
            return {
                "active": False, 
                "email": email,
                "profile_exists": exists,
                "message": "No active session" if exists else "Profile not found"
            }

@app.delete("/api/sessions/cleanup")
async def cleanup_sessions():
    """Dọn dẹp tất cả sessions (for testing)"""
    try:
        count = 0
        with session_lock:
            for email in list(active_sessions.keys()):
                try:
                    active_sessions[email]['driver'].quit()
                    del active_sessions[email]
                    count += 1
                except Exception as e:
                    print(f"Error cleaning up {email}: {e}")
        
        return {"success": True, "message": f"Cleaned up {count} sessions"}
    except Exception as e:
        return {"success": False, "message": f"Error during cleanup: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Gemini Creative Suite API Server...")
    print("📊 Available endpoints:")
    print("   GET  /api/health")
    print("   POST /api/session/start")
    print("   DELETE /api/session/stop/{email}")
    print("   GET  /api/sessions/active")
    print("   GET  /api/sessions/available")
    print("   POST /api/session/create")
    print("   POST /api/process/kill/{pid}")
    print("   GET  /api/session/status/{email}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")