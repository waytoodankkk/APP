use tauri::command;
use std::process::Command;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tokens {
    pub session_token: String,
    pub auth_token: String,
    pub cookies: HashMap<String, String>,
    pub user_agent: String,
    pub extracted_at: String,
}

// ✅ THÊM COMMAND MỚI: Tạo session directory
#[command]
pub async fn create_session_directory(profile_email: String) -> Result<(), String> {
    let session_dir = format!("../sessions/{}", profile_email);
    let session_path = PathBuf::from(&session_dir);
    
    if !session_path.exists() {
        std::fs::create_dir_all(&session_path)
            .map_err(|e| format!("Failed to create session directory: {}", e))?;
        println!("✅ Created session directory: {}", session_dir);
    } else {
        println!("📁 Session directory already exists: {}", session_dir);
    }
    
    Ok(())
}

#[command]
pub async fn delete_session_directory(profile_email: String) -> Result<(), String> {
    let session_dir = format!("../sessions/{}", profile_email);
    let session_path = PathBuf::from(&session_dir);
    
    if session_path.exists() {
        std::fs::remove_dir_all(&session_path)
            .map_err(|e| format!("Failed to delete session directory: {}", e))?;
        println!("🗑️ Deleted session directory: {}", session_dir);
    } else {
        println!("📁 Session directory not found: {}", session_dir);
    }
    
    Ok(())
}

// 🎯 COMMAND MỚI: Manual Login với Monitoring - ĐÃ FIX
#[command]
pub async fn open_chrome_manual_login(
    profile_email: String,
    user_data_dir: String,
    url: String,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    let user_data_path = PathBuf::from(&user_data_dir);
    let absolute_path = std::fs::canonicalize(&user_data_path)
        .map_err(|e| format!("Failed to get absolute path: {}", e))?;
    
    println!("🎯 MANUAL LOGIN - Opening Chrome for: {}", profile_email);
    println!("🎯 Absolute data dir: {}", absolute_path.display());

    let chrome_exe = PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe");
    
    // ✅ FIX: DETACH PROCESS - KHÔNG GIỮ CHILD REFERENCE
    let child = Command::new(&chrome_exe)
        .args(&[
            &format!("--user-data-dir={}", absolute_path.display()),
            "--no-first-run",
            &url,
        ])
        .spawn()
        .map_err(|e| format!("Failed to open Chrome: {}", e))?;

    let pid = child.id();
    
    // ✅ FIX: DETACH PROCESS - CHO PHÉP CHROME CHẠY ĐỘC LẬP
    std::mem::forget(child); // 🔥 QUAN TRỌNG: Không drop child
    
    // ✅ MONITOR PROCESS BẰNG PID THAY VÌ CHILD HANDLE
    std::thread::spawn(move || {
        monitor_chrome_process(pid, app_handle);
    });

    println!("✅ Chrome MANUAL LOGIN started with PID: {} for profile: {}", pid, profile_email);
    
    Ok(pid)
}

// ✅ HÀM MONITOR MỚI - THEO DÕI PROCESS BẰNG PID
fn monitor_chrome_process(pid: u32, app_handle: tauri::AppHandle) {
    println!("👀 Monitoring Chrome process: {}", pid);
    
    loop {
        // KIỂM TRA PROCESS CÒN SỐNG KHÔNG
        let output = Command::new("cmd")
            .args(&["/C", "tasklist", "/FI", &format!("PID eq {}", pid)])
            .output();
        
        let is_running = match output {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stdout);
                output_str.contains(&pid.to_string())
            },
            Err(_) => false,
        };
        
        if !is_running {
            println!("🔔 Chrome manual login closed - PID: {}", pid);
            let _ = app_handle.emit("chrome-manual-closed", pid);
            break;
        }
        
        // ĐỢI 2 GIÂY TRƯỚC KHI CHECK LẠI
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
}

// 🔄 GIỮ NGUYÊN COMMAND CŨ (có thể deprecated sau)
#[command]
pub async fn open_real_chrome_with_profile(
    profile_email: String,
    user_data_dir: String,
    url: String,
) -> Result<u32, String> {
    let user_data_path = PathBuf::from(&user_data_dir);
    let absolute_path = std::fs::canonicalize(&user_data_path)
        .map_err(|e| format!("Failed to get absolute path: {}", e))?;
    
    println!("🎯 Opening Chrome with NEW profile: {}", profile_email);
    println!("🎯 Absolute data dir: {}", absolute_path.display());

    let chrome_exe = PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe");
    
    let child = Command::new(&chrome_exe)
        .args(&[
            &format!("--user-data-dir={}", absolute_path.display()),
            "--no-first-run",
            &url,
        ])
        .spawn()
        .map_err(|e| format!("Failed to open Chrome: {}", e))?;

    let pid = child.id();
    println!("✅ Chrome opened with PID: {} for profile: {}", pid, profile_email);
    
    Ok(pid)
}

// 🚀 COMMAND MỚI: Headless Automation (chuẩn bị cho phase 2)
#[command]
pub async fn extract_tokens_headless(
    profile_email: String,
    user_data_dir: String,
) -> Result<Tokens, String> {
    println!("🤖 HEADLESS EXTRACTION for: {}", profile_email);
    println!("🤖 User data dir: {}", user_data_dir);

    // TODO: Implement Playwright/Puppeteer headless extraction
    // Sẽ tự động close sau khi extract xong
    
    let mut cookies = HashMap::new();
    cookies.insert("session_token".to_string(), "headless_token_123".to_string());
    cookies.insert("auth_token".to_string(), "headless_auth_456".to_string());
    
    Ok(Tokens {
        session_token: "headless_token_123".to_string(),
        auth_token: "headless_auth_456".to_string(),
        cookies,
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string(),
        extracted_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[command]
pub async fn extract_tokens_from_profile(
    profile_email: String,
    user_data_dir: String,
) -> Result<Tokens, String> {
    println!("Extracting tokens for profile: {}", profile_email);
    println!("User data dir: {}", user_data_dir);
    
    let mut cookies = HashMap::new();
    cookies.insert("session_token".to_string(), "dummy_session_token_123".to_string());
    cookies.insert("auth_token".to_string(), "dummy_auth_token_456".to_string());
    
    Ok(Tokens {
        session_token: "dummy_session_token_123".to_string(),
        auth_token: "dummy_auth_token_456".to_string(),
        cookies,
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string(),
        extracted_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[command]
pub async fn save_extracted_tokens(
    profile_email: String,
    tokens: Tokens,
) -> Result<(), String> {
    let sessions_dir = PathBuf::from("../sessions");
    if !sessions_dir.exists() {
        std::fs::create_dir_all(&sessions_dir)
            .map_err(|e| format!("Failed to create sessions dir: {}", e))?;
    }

    let profile_dir = sessions_dir.join(&profile_email);
    if !profile_dir.exists() {
        std::fs::create_dir_all(&profile_dir)
            .map_err(|e| format!("Failed to create profile dir: {}", e))?;
    }

    let tokens_path = profile_dir.join("tokens.json");
    let tokens_json = serde_json::to_string_pretty(&tokens)
        .map_err(|e| format!("Failed to serialize tokens: {}", e))?;
    
    std::fs::write(&tokens_path, tokens_json)
        .map_err(|e| format!("Failed to save tokens: {}", e))?;

    println!("Tokens saved for profile: {}", profile_email);
    println!("Tokens path: {}", tokens_path.display());
    
    Ok(())
}

#[command]
pub async fn load_tokens_for_profile(
    profile_email: String,
) -> Result<Option<Tokens>, String> {
    let tokens_path = PathBuf::from("../sessions").join(&profile_email).join("tokens.json");
    
    if !tokens_path.exists() {
        return Ok(None);
    }

    let tokens_content = std::fs::read_to_string(&tokens_path)
        .map_err(|e| format!("Failed to read tokens file: {}", e))?;
    
    let tokens: Tokens = serde_json::from_str(&tokens_content)
        .map_err(|e| format!("Failed to parse tokens: {}", e))?;

    println!("Tokens loaded for profile: {}", profile_email);
    Ok(Some(tokens))
}

#[command]
pub async fn check_chrome_profile_exists(
    profile_email: String,
) -> Result<bool, String> {
    let profile_dir = PathBuf::from("../sessions").join(&profile_email);
    Ok(profile_dir.exists())
}

#[command]
pub async fn close_chrome_by_pid(pid: u32) -> Result<(), String> {
    println!("🛑 Closing Chrome with PID: {}", pid);
    
    let status = Command::new("taskkill")
        .args(&["/PID", &pid.to_string(), "/F"])
        .status()
        .map_err(|e| format!("Failed to kill Chrome process: {}", e))?;
    
    if status.success() {
        println!("✅ Chrome closed successfully (PID: {})", pid);
        Ok(())
    } else {
        Err("Failed to close Chrome process".to_string())
    }
}