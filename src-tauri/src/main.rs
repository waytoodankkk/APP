// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{
    create_session_directory,
    delete_session_directory,
    open_real_chrome_with_profile,
    open_chrome_manual_login,        // ✅ THÊM COMMAND MỚI
    extract_tokens_from_profile,
    extract_tokens_headless,         // ✅ THÊM COMMAND MỚI
    save_extracted_tokens,
    load_tokens_for_profile,
    check_chrome_profile_exists,
    close_chrome_by_pid,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_session_directory,
            delete_session_directory,
            open_real_chrome_with_profile,
            open_chrome_manual_login,        // ✅ THÊM VÀO HANDLER
            extract_tokens_from_profile,
            extract_tokens_headless,         // ✅ THÊM VÀO HANDLER
            save_extracted_tokens,
            load_tokens_for_profile,
            check_chrome_profile_exists,
            close_chrome_by_pid,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}