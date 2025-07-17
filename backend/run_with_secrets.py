#!/usr/bin/env python3
"""
Development script to run backend with proper API key validation and guidance
"""

import sys
import os
import asyncio
import logging
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import Settings, validate_environment, log_environment_status

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def validate_and_guide_user():
    """Validate environment and guide user to configure missing API keys"""
    print("🎤 Isha Voice Assistant - Environment Validation")
    print("=" * 60)
    
    # Check environment
    result = validate_environment()
    
    if result.is_valid:
        print("✅ All required API keys are configured!")
        print("🚀 Starting backend server...")
        return True
    
    print("❌ Missing required API keys. Here's what you need to configure:")
    print()
    
    # Guide user through missing API keys
    missing_apis = {}
    for key in result.missing_keys:
        if "GEMINI" in key:
            missing_apis["Gemini"] = {
                "description": "Google's Gemini AI for chat responses",
                "url": "https://makersuite.google.com/app/apikey",
                "key_name": "GEMINI_API_KEY"
            }
        elif "DEEPGRAM" in key:
            missing_apis["Deepgram"] = {
                "description": "Speech-to-text and text-to-speech",
                "url": "https://console.deepgram.com/",
                "key_name": "DEEPGRAM_API_KEY"
            }
        elif "LIVEKIT" in key and "API_KEY" in key:
            missing_apis["LiveKit"] = {
                "description": "Real-time voice communication",
                "url": "https://cloud.livekit.io/",
                "key_name": "LIVEKIT_API_KEY"
            }
    
    for i, (service, info) in enumerate(missing_apis.items(), 1):
        print(f"{i}. 🔑 {service} API Key")
        print(f"   Purpose: {info['description']}")
        print(f"   Get it at: {info['url']}")
        print(f"   Add to Supabase secrets as: {info['key_name']}")
        print()
    
    print("📝 To configure API keys:")
    print("1. 🌐 Go to your Supabase dashboard")
    print("2. ⚙️  Navigate to Settings > API") 
    print("3. 🔑 Add each API key as a secret")
    print("4. 🔄 Restart this script")
    print()
    print("💡 Tip: You can also add keys directly to backend/.env file for development")
    
    return False

async def main():
    """Main function"""
    try:
        # Validate environment and guide user
        is_ready = await validate_and_guide_user()
        
        if not is_ready:
            print("⏳ Please configure the missing API keys and try again.")
            print("   Once configured, run: python backend/run_with_secrets.py")
            return
        
        # Import and start the server
        print("🚀 Starting FastAPI server...")
        import uvicorn
        
        # Start the server
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())