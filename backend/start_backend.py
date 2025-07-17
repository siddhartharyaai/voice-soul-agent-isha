#!/usr/bin/env python3
"""
Production startup script for Isha Voice Assistant backend
Validates environment and starts FastAPI server with proper error handling
"""

import sys
import os
import logging
import asyncio
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import log_environment_status, Settings
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def load_secrets_and_validate():
    """Load secrets from Supabase before starting"""
    try:
        from supabase_secrets import secrets_client
        print("🔑 Loading API keys from Supabase...")
        secrets = await secrets_client.load_all_secrets()
        print(f"✅ Loaded {len(secrets)} secrets from Supabase")
    except Exception as e:
        print(f"⚠️  Warning: Could not load secrets from Supabase: {e}")
        print("   Falling back to environment variables")

def main():
    """Main startup function"""
    print("🎤 Isha Voice Assistant - Production Backend")
    print("=" * 50)
    
    # Load secrets first
    try:
        asyncio.run(load_secrets_and_validate())
    except Exception as e:
        print(f"⚠️  Warning during secret loading: {e}")
    
    # Validate environment
    validation_result = log_environment_status()
    
    if not validation_result.is_valid:
        print("\n❌ STARTUP FAILED - Missing required environment variables:")
        for key in validation_result.missing_keys:
            print(f"   • {key}")
        
        print("\n📝 Please check your .env file and ensure all required keys are set.")
        print("   Copy backend/.env.example to backend/.env and fill in your API keys.")
        sys.exit(1)
    
    # Show warnings for optional missing keys
    if validation_result.optional_missing:
        print("\n⚠️  Optional API keys missing (some features may not work):")
        for key in validation_result.optional_missing:
            print(f"   • {key}")
    
    # Load settings
    settings = Settings()
    
    print(f"\n✅ Environment validation passed")
    print(f"🚀 Starting FastAPI server on {settings.HOST}:{settings.PORT}")
    print(f"🔧 Debug mode: {'ON' if settings.DEBUG else 'OFF'}")
    
    if validation_result.recommendations:
        print("\n💡 Recommendations:")
        for rec in validation_result.recommendations:
            print(f"   {rec}")
    
    print("\n" + "=" * 50)
    
    try:
        # Start the server
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.DEBUG,
            log_level="info" if not settings.DEBUG else "debug",
            access_log=True,
            workers=1  # Single worker for WebSocket support
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()