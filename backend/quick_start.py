#!/usr/bin/env python3
"""
QUICK START - Run this to start the voice backend immediately
"""

import os
import sys
import subprocess
import time
import requests
from pathlib import Path

def check_port_8000():
    """Check if port 8000 is already in use"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=2)
        return True
    except:
        return False

def start_backend():
    """Start the backend server"""
    print("🎤 ISHA VOICE BACKEND - QUICK START")
    print("=" * 50)
    
    # Check if already running
    if check_port_8000():
        print("✅ Backend server is already running on port 8000!")
        print("🌐 Health check: http://localhost:8000/health")
        print("🎯 Your voice assistant is ready to use!")
        return
    
    # Change to backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("📁 Working directory:", backend_dir)
    print("🚀 Starting backend server...")
    
    # Start the production server
    try:
        subprocess.run([sys.executable, "start_production.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Failed to start server: {e}")
        print("\n💡 Try running manually:")
        print("   cd backend")
        print("   python start_production.py")

if __name__ == "__main__":
    start_backend()