#!/usr/bin/env python3
"""
Quick startup script for the Isha Voice Assistant backend
Enhanced with better error handling and dependency management
"""

import subprocess
import sys
import os
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")

def install_dependencies(pip_exe, requirements_file):
    """Install dependencies with error handling"""
    try:
        print("📦 Installing dependencies...")
        result = subprocess.run([str(pip_exe), "install", "-r", str(requirements_file)], 
                              capture_output=True, text=True, check=True)
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        print(f"   Error output: {e.stderr}")
        return False

def main():
    print("🎤 Starting Isha Voice Assistant Backend...")
    print("=" * 50)
    
    # Check Python version
    check_python_version()
    
    # Get script directory and backend directory
    script_dir = Path(__file__).parent
    backend_dir = script_dir / "backend"
    
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        sys.exit(1)
    
    print(f"📁 Backend directory: {backend_dir}")
    
    # Change to backend directory
    original_cwd = os.getcwd()
    os.chdir(backend_dir)
    
    try:
        # Check if virtual environment exists
        venv_path = backend_dir / "venv"
        if not venv_path.exists():
            print("📦 Creating virtual environment...")
            subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
            print("✅ Virtual environment created")
        
        # Use the virtual environment python
        if sys.platform == "win32":
            python_exe = venv_path / "Scripts" / "python.exe"
            pip_exe = venv_path / "Scripts" / "pip.exe"
        else:
            python_exe = venv_path / "bin" / "python"
            pip_exe = venv_path / "bin" / "pip"
        
        # Check if executables exist
        if not python_exe.exists():
            print(f"❌ Python executable not found: {python_exe}")
            sys.exit(1)
        
        if not pip_exe.exists():
            print(f"❌ Pip executable not found: {pip_exe}")
            sys.exit(1)
        
        # Install dependencies
        requirements_file = backend_dir / "requirements.txt"
        if requirements_file.exists():
            if not install_dependencies(pip_exe, requirements_file):
                print("⚠️ Continuing despite dependency installation issues...")
        else:
            print(f"⚠️ Requirements file not found: {requirements_file}")
        
        # Start the server directly with uvicorn
        print("\n🚀 Starting FastAPI server...")
        print("=" * 50)
        print(f"🌐 Server will be available at: http://localhost:8000")
        print(f"📊 Health check: http://localhost:8000/health")
        print(f"📋 API docs: http://localhost:8000/docs")
        print("=" * 50)
        
        subprocess.run([
            str(python_exe), "-m", "uvicorn", "main:app",
            "--host", "0.0.0.0",
            "--port", "8000", 
            "--reload",
            "--log-level", "info"
        ])
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        sys.exit(1)
    finally:
        os.chdir(original_cwd)

if __name__ == "__main__":
    main()