import undetected_chromedriver as uc
import time
import os

def test_session_persistence():
    profile_path = r"D:\gemini-creative-suite\frontend\sessions\test@gmail.com"
    
    print(f"🎯 Testing session persistence for: {profile_path}")
    print(f"📁 Profile exists: {os.path.exists(profile_path)}")
    
    if not os.path.exists(profile_path):
        print("❌ Profile path not found!")
        return
    
    # Chrome options - GIỐNG HỆT COMMAND MANUAL
    options = uc.ChromeOptions()
    options.add_argument(f"--user-data-dir={profile_path}")
    options.add_argument("--no-first-run")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    
    # 🎯 QUAN TRỌNG: KHÔNG headless để thấy rõ
    # options.add_argument("--headless=new")  # COMMENT DÒNG NÀY ĐỂ XEM CHROME
    
    print("🚀 Starting Chrome driver...")
    
    try:
        driver = uc.Chrome(options=options)
        
        print("✅ Chrome started successfully!")
        print(f"🌐 Current URL: {driver.current_url}")
        print(f"📄 Page title: {driver.title}")
        
        # Test navigate đến Google Flow
        print("🔄 Navigating to Google Flow...")
        driver.get("https://labs.google/fx/vi/tools/flow")
        
        time.sleep(3)
        
        print(f"🌐 After navigation URL: {driver.current_url}")
        print(f"📄 After navigation title: {driver.title}")
        
        # Check nếu đã login
        current_url = driver.current_url
        if "accounts.google.com" not in current_url and "signin" not in current_url:
            print("🎉 SUCCESS: Session persisted! User is likely logged in!")
        else:
            print("❌ Session NOT persisted: Redirected to login page")
        
        # Extract thông tin cơ bản
        try:
            cookies = driver.get_cookies()
            print(f"🍪 Number of cookies: {len(cookies)}")
            
            # Check specific Google cookies
            google_cookies = [c for c in cookies if 'google' in c.get('domain', '')]
            print(f"🔍 Google-related cookies: {len(google_cookies)}")
            
        except Exception as e:
            print(f"⚠️ Cookie extraction error: {e}")
        
        print("⏳ Keeping browser open for 10 seconds for manual inspection...")
        time.sleep(10)
        
        driver.quit()
        print("✅ Test completed!")
        
    except Exception as e:
        print(f"❌ Chrome driver error: {e}")

if __name__ == "__main__":
    test_session_persistence()