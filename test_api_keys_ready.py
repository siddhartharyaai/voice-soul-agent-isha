#!/usr/bin/env python3
"""
Test script to verify API keys are properly configured and voice pipeline is ready
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

async def test_api_keys():
    """Test that API keys are properly loaded from Supabase"""
    try:
        from supabase_secrets import secrets_client
        
        print("🔑 Testing API key configuration...")
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
            print("\n🎉 All API keys are configured! Voice functionality should work.")
            print("📝 Next steps:")
            print("   1. Run: python start_backend.py")
            print("   2. Click the voice button in the app")
            print("   3. Say 'Hello' to test the complete voice pipeline")
            return True
        else:
            print(f"\n⚠️  Missing keys: {', '.join(missing_keys)}")
            print("   Please add them in Supabase secrets and try again.")
            return False
            
    except Exception as e:
        print(f"❌ Error testing API keys: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_api_keys())
    sys.exit(0 if success else 1)