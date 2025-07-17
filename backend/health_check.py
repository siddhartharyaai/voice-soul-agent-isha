#!/usr/bin/env python3
"""
Health check script to verify backend status and configuration
"""

import asyncio
import httpx
import sys
from pathlib import Path

async def check_backend_health():
    """Check if backend is healthy and properly configured"""
    try:
        print("🏥 Checking backend health...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/health", timeout=5.0)
            
            if response.status_code == 200:
                health_data = response.json()
                print("✅ Backend is running!")
                print(f"   Version: {health_data.get('version', 'Unknown')}")
                print(f"   Status: {health_data.get('status', 'Unknown')}")
                
                services = health_data.get('services', {})
                print("\n🔧 Service Configuration:")
                for service, configured in services.items():
                    status = "✅ Configured" if configured else "❌ Missing"
                    print(f"   {service}: {status}")
                
                mcp_servers = health_data.get('mcp_servers', 0)
                active_sessions = health_data.get('active_sessions', 0)
                print(f"\n📊 Runtime Stats:")
                print(f"   MCP Servers: {mcp_servers}")
                print(f"   Active Sessions: {active_sessions}")
                
                if not services.get('deepgram') or not services.get('gemini') or not services.get('livekit'):
                    print("\n⚠️  Warning: Some required services are not configured")
                    print("   Voice functionality may not work properly")
                    return False
                
                return True
            else:
                print(f"❌ Backend returned status {response.status_code}")
                return False
                
    except httpx.ConnectError:
        print("❌ Cannot connect to backend")
        print("   Make sure the backend is running on port 8000")
        return False
    except httpx.TimeoutException:
        print("❌ Backend request timed out")
        print("   Backend may be starting up or overloaded")
        return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

async def check_environment_validation():
    """Check environment validation endpoint"""
    try:
        print("\n🌍 Checking environment validation...")
        
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/api/environment/validate", timeout=5.0)
            
            if response.status_code == 200:
                env_data = response.json()
                
                if env_data.get('valid'):
                    print("✅ Environment validation passed")
                else:
                    print("❌ Environment validation failed")
                    missing = env_data.get('missing_keys', [])
                    if missing:
                        print(f"   Missing required keys: {', '.join(missing)}")
                    
                    optional_missing = env_data.get('optional_missing', [])
                    if optional_missing:
                        print(f"   Missing optional keys: {', '.join(optional_missing)}")
                    
                    recommendations = env_data.get('recommendations', [])
                    if recommendations:
                        print("\n💡 Recommendations:")
                        for rec in recommendations:
                            print(f"   {rec}")
                
                return env_data.get('valid', False)
            else:
                print(f"❌ Environment validation endpoint returned {response.status_code}")
                return False
                
    except Exception as e:
        print(f"❌ Environment validation check error: {e}")
        return False

async def main():
    """Main health check function"""
    print("🎤 Isha Voice Assistant - Backend Health Check")
    print("=" * 50)
    
    # Check basic health
    health_ok = await check_backend_health()
    
    # Check environment validation
    env_ok = await check_environment_validation()
    
    print("\n" + "=" * 50)
    if health_ok and env_ok:
        print("🎉 Backend is healthy and ready!")
        sys.exit(0)
    elif health_ok:
        print("⚠️  Backend is running but has configuration issues")
        sys.exit(1)
    else:
        print("❌ Backend is not healthy")
        print("\n💡 Try:")
        print("   1. Start the backend: python start_backend.py")
        print("   2. Check the backend logs for errors")
        print("   3. Verify your API keys are configured")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())