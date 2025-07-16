#!/usr/bin/env python3
"""
Startup script for the Isha Voice Assistant backend
Handles environment setup and server initialization
"""

import os
import sys
import subprocess
import signal
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import httpx
        import livekit
        print("✓ Core dependencies found")
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def setup_environment():
    """Setup environment variables"""
    env_file = Path(".env")
    if not env_file.exists():
        print("⚠️  .env file not found. Creating from template...")
        env_example = Path(".env.example")
        if env_example.exists():
            import shutil
            shutil.copy(env_example, env_file)
            print("📝 Please edit .env file with your API keys")
        else:
            print("❌ .env.example not found")
            return False
    
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✓ Environment variables loaded")
    except ImportError:
        print("⚠️  python-dotenv not found, environment variables may not be loaded")
    
    return True

def check_api_keys():
    """Check if required API keys are set"""
    required_keys = [
        "GEMINI_API_KEY",
        "DEEPGRAM_API_KEY",
        "SUPABASE_ANON_KEY"
    ]
    
    missing_keys = []
    for key in required_keys:
        if not os.getenv(key):
            missing_keys.append(key)
    
    if missing_keys:
        print(f"⚠️  Missing required API keys: {', '.join(missing_keys)}")
        print("Please set these in your .env file")
        return False
    
    print("✓ Required API keys found")
    return True

def start_server():
    """Start the FastAPI server"""
    print("🚀 Starting Isha Voice Assistant Backend...")
    print("📡 Server will be available at: http://localhost:8000")
    print("📊 API docs will be available at: http://localhost:8000/docs")
    print("🔄 Press Ctrl+C to stop the server")
    
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info",
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")

def main():
    """Main startup function"""
    print("🎤 Isha Voice Assistant Backend")
    print("=" * 40)
    
    # Check dependencies
    check_dependencies()
    
    # Setup environment
    if not setup_environment():
        sys.exit(1)
    
    # Check API keys
    if not check_api_keys():
        print("\n💡 You can still start the server, but some features may not work")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()