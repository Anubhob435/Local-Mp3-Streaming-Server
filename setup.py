#!/usr/bin/env python3
"""
Setup script for YouTube Music Streaming App
This script helps users configure their YouTube API key and set up the application.
"""

import os
import sys
from dotenv import load_dotenv, set_key

def print_banner():
    print("""
🎵 YouTube Music Streaming App Setup
=====================================

This setup will help you configure your YouTube API key
and get the application running.
""")

def get_youtube_api_key():
    print("""
📋 Getting Your YouTube API Key:

1. Go to: https://console.developers.google.com/
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3:
   - Click "Enable APIs and Services"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" > "API Key"
   - Copy your API key

5. (Optional) Restrict your API key:
   - Click on your API key name
   - Under "API restrictions", select "YouTube Data API v3"
   - Save
""")

def setup_env_file():
    """Setup the .env file with YouTube API key"""
    env_file = '.env'
    
    # Check if .env exists
    if os.path.exists(env_file):
        load_dotenv()
        current_key = os.getenv('YOUTUBE_API_KEY')
        if current_key and current_key != 'your_youtube_api_key_here':
            print(f"✅ YouTube API key is already configured.")
            response = input("Do you want to update it? (y/n): ").lower().strip()
            if response != 'y':
                return True
    
    print("\n🔑 Please enter your YouTube API key:")
    while True:
        api_key = input("API Key: ").strip()
        
        if not api_key:
            print("❌ API key cannot be empty. Please try again.")
            continue
        
        if api_key == 'your_youtube_api_key_here':
            print("❌ Please enter your actual API key, not the placeholder.")
            continue
        
        # Validate API key format (basic check)
        if len(api_key) < 30:
            print("⚠️  This doesn't look like a valid API key. API keys are usually longer.")
            response = input("Do you want to continue anyway? (y/n): ").lower().strip()
            if response != 'y':
                continue
        
        break
    
    # Save to .env file
    set_key(env_file, 'YOUTUBE_API_KEY', api_key)
    print(f"✅ API key saved to {env_file}")
    return True

def check_dependencies():
    """Check if all required packages are installed"""
    print("\n📦 Checking dependencies...")
    
    try:
        import flask
        import flask_socketio
        import googleapiclient
        import requests
        from dotenv import load_dotenv
        print("✅ All required packages are installed.")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_music_files():
    """Check for local MP3 files"""
    print("\n🎵 Checking for local music files...")
    
    mp3_files = [f for f in os.listdir('.') if f.endswith('.mp3')]
    
    if mp3_files:
        print(f"✅ Found {len(mp3_files)} MP3 file(s):")
        for file in mp3_files[:5]:  # Show first 5 files
            print(f"   - {file}")
        if len(mp3_files) > 5:
            print(f"   ... and {len(mp3_files) - 5} more")
    else:
        print("ℹ️  No MP3 files found in the current directory.")
        print("   You can add MP3 files later to stream local music.")
    
    return True

def test_youtube_api():
    """Test the YouTube API connection"""
    print("\n🧪 Testing YouTube API connection...")
    
    try:
        from googleapiclient.discovery import build
        from dotenv import load_dotenv
        
        load_dotenv()
        api_key = os.getenv('YOUTUBE_API_KEY')
        
        if not api_key or api_key == 'your_youtube_api_key_here':
            print("⚠️  YouTube API key not configured. YouTube features will be disabled.")
            return False
        
        # Test API connection
        youtube = build('youtube', 'v3', developerKey=api_key)
        
        # Simple test query
        search_response = youtube.search().list(
            q='test',
            part='id,snippet',
            maxResults=1,
            type='video'
        ).execute()
        
        print("✅ YouTube API connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ YouTube API test failed: {e}")
        print("   Please check your API key and internet connection.")
        return False

def main():
    print_banner()
    
    # Check dependencies first
    if not check_dependencies():
        sys.exit(1)
    
    # Setup environment file
    get_youtube_api_key()
    if not setup_env_file():
        sys.exit(1)
    
    # Check music files
    check_music_files()
    
    # Test YouTube API
    test_youtube_api()
    
    print("""
🎉 Setup Complete!

To start the application, run:
    python app.py

Then open your browser and go to:
    http://localhost:8000

Enjoy your music streaming experience! 🎵

📘 For more information, check the README.md file.
""")

if __name__ == '__main__':
    main()
