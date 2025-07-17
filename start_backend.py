#!/usr/bin/env python3
"""
Quick startup script for the Isha Voice Assistant backend
"""

import subprocess
import sys
import os
from pathlib import Path

def main():
    print("🎤 Starting Isha Voice Assistant Backend...")
    
    # Change to backend directory
    backend_dir = Path(__file__).parent / "backend"
    os.chdir(backend_dir)
    
    # Check if virtual environment exists
    venv_path = backend_dir / "venv"
    if not venv_path.exists():
        print("📦 Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", "venv"])
    
    # Use the virtual environment python
    if sys.platform == "win32":
        python_exe = venv_path / "Scripts" / "python.exe"
        pip_exe = venv_path / "Scripts" / "pip.exe"
    else:
        python_exe = venv_path / "bin" / "python"
        pip_exe = venv_path / "bin" / "pip"
    
    # Install dependencies
    print("📦 Installing dependencies...")
    subprocess.run([str(pip_exe), "install", "-r", "requirements.txt"])
    
    # Start the server
    print("🚀 Starting FastAPI server...")
    subprocess.run([str(python_exe), "start_server.py"])

if __name__ == "__main__":
    main()