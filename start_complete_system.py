#!/usr/bin/env python3
"""
Complete system startup script for Isha Voice Assistant
- Validates API keys from Supabase
- Starts backend server
- Provides clear error messages and guidance
"""

import asyncio
import sys
import os
import subprocess
import time
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

def check_python_version():
    """Check Python version is 3.8+"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")

async def test_api_keys():
    """Test that API keys are properly loaded from Supabase"""
    try:
        from supabase_secrets import secrets_client
        
        print("\n🔑 Testing API key configuration...")
        print("=" * 50)
        
        # Test loading all secrets
        secrets = await secrets_client.load_all_secrets()
        
        required_keys = [
            "GEMINI_API_KEY",
            "DEEPGRAM_API_KEY", 
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
            "LIVEKIT_WS_URL"
        ]
        
        missing_keys = []
        configured_keys = []
        
        for key in required_keys:
            if key in secrets and secrets[key]:
                configured_keys.append(key)
                print(f"✅ {key}: Configured")
            else:
                missing_keys.append(key)
                print(f"❌ {key}: Missing")
        
        print("\n" + "=" * 50)
        print(f"✅ Configured: {len(configured_keys)}")
        print(f"❌ Missing: {len(missing_keys)}")
        
        if not missing_keys:
            print("\n🎉 All API keys are configured!")
            return True
        else:
            print(f"\n⚠️  Missing keys: {', '.join(missing_keys)}")
            print("\n📝 To add missing keys:")
            print("   1. Go to Supabase Dashboard > Settings > Edge Functions")
            print("   2. Add the missing secrets with their values")
            print("   3. Run this script again")
            return False
            
    except Exception as e:
        print(f"❌ Error testing API keys: {e}")
        return False

def start_backend_server():
    """Start the backend server"""
    print("\n🚀 Starting backend server...")
    print("=" * 50)
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    try:
        # Start the server
        subprocess.run([
            sys.executable, "start_backend.py"
        ], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start server: {e}")
        sys.exit(1)

async def main():
    """Main startup function"""
    print("🎤 Isha Voice Assistant - Complete System Startup")
    print("=" * 60)
    
    # Check Python version
    check_python_version()
    
    # Test API keys
    api_keys_ready = await test_api_keys()
    
    if not api_keys_ready:
        print("\n❌ Cannot start system - API keys missing")
        print("   Please configure the missing API keys and try again")
        sys.exit(1)
    
    # Start backend
    print("\n✅ API keys verified - starting backend server...")
    start_backend_server()

if __name__ == "__main__":
    asyncio.run(main())