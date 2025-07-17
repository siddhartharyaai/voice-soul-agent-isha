#!/usr/bin/env python3
"""
Production startup script that WILL work - simplified and robust
"""

import sys
import os
import logging
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Simplified startup that works"""
    print("🎤 Isha Voice Assistant - PRODUCTION BACKEND")
    print("=" * 50)
    
    # Set environment variables directly from Supabase secrets
    # (User has already added them via the secret forms)
    os.environ.setdefault("SUPABASE_URL", "https://nlxpyaeufqabcyimlohn.supabase.co")
    os.environ.setdefault("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seHB5YWV1ZnFhYmN5aW1sb2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY4NzAsImV4cCI6MjA2ODI3Mjg3MH0.w57pURCdwaMeJycaQdVkQ--2KnbC8cxeB3yA6KMUbag")
    
    print("✅ Starting server with environment configuration")
    print("🚀 Server will be available at: http://localhost:8000")
    print("🔧 Health check at: http://localhost:8000/health")
    
    try:
        import uvicorn
        from main import app
        
        # Start the server with minimal configuration
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info",
            access_log=True,
            workers=1
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        print(f"\n❌ Server startup failed: {e}")
        print("\n💡 Troubleshooting:")
        print("   1. Make sure you've installed dependencies: pip install -r requirements.txt")
        print("   2. Make sure port 8000 is not already in use")
        print("   3. Run the simple test: python simple_backend_test.py")
        sys.exit(1)

if __name__ == "__main__":
    main()