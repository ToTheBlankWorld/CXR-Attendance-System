#!/usr/bin/env python3
"""
Face Recognition Attendance System - Startup Script
Automatically starts both backend (FastAPI) and frontend (Vite)
"""

import os
import sys
import subprocess
import time
import threading
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

def start_backend():
    """Start FastAPI backend server"""
    print("\n" + "="*60)
    print("🚀 Starting FastAPI Backend...")
    print("="*60)
    
    os.chdir(BACKEND_DIR)
    
    # Command to start the backend
    cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "8000"
    ]
    
    try:
        subprocess.Popen(cmd)
        print("✅ Backend started on http://0.0.0.0:8000")
        time.sleep(2)
        return True
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        return False

def start_frontend():
    """Start Vite frontend development server"""
    print("\n" + "="*60)
    print("🎨 Starting Vite Frontend...")
    print("="*60)
    
    os.chdir(FRONTEND_DIR)
    
    # Use shell=True and direct npm command for Windows compatibility
    if sys.platform == "win32":
        cmd = "npm run dev"
        try:
            subprocess.Popen(cmd, shell=True)
            print("✅ Frontend started on https://localhost:5173")
            time.sleep(1)
            return True
        except Exception as e:
            print(f"❌ Error starting frontend: {e}")
            print("   Make sure you have Node.js and npm installed")
            print("   Download from: https://nodejs.org/")
            return False
    else:
        cmd = ["npm", "run", "dev"]
        try:
            subprocess.Popen(cmd)
            print("✅ Frontend started on https://localhost:5173")
            return True
        except Exception as e:
            print(f"❌ Error starting frontend: {e}")
            print("   Make sure you have Node.js and npm installed")
            return False

def main():
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*58 + "║")
    print("║  🎓 Face Recognition Attendance System 🎓" + " "*14 + "║")
    print("║" + " "*58 + "║")
    print("╚" + "="*58 + "╝")
    
    # Check if backend directory exists
    if not BACKEND_DIR.exists():
        print(f"\n❌ Backend directory not found: {BACKEND_DIR}")
        return
    
    # Check if frontend directory exists
    if not FRONTEND_DIR.exists():
        print(f"\n❌ Frontend directory not found: {FRONTEND_DIR}")
        return
    
    # Start both servers
    print("\n" + "="*60)
    print("Starting both services...")
    print("="*60)
    
    backend_ok = start_backend()
    frontend_ok = start_frontend()
    
    if backend_ok and frontend_ok:
        print("\n" + "="*60)
        print("✅ Both servers started successfully!")
        print("="*60)
        print("\n📱 Access the application:")
        print("   🌐 Frontend: https://localhost:5173")
        print("   🔌 Backend:  http://localhost:8000")
        print("   📚 API Docs: http://localhost:8000/docs")
        print("\n💡 Login with:")
        print("   👤 Username: admin")
        print("   🔐 Password: admin123")
        print("\n📝 Press Ctrl+C to stop all servers")
        print("="*60 + "\n")
        
        # Keep the script running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n⛔ Shutting down servers...")
            sys.exit(0)
    elif backend_ok and not frontend_ok:
        print("\n" + "="*60)
        print("⚠️  Backend started but frontend failed!")
        print("="*60)
        print("\n📌 Troubleshooting:")
        print("   1. Check if Node.js is installed: node --version")
        print("   2. Check if npm is installed: npm --version")
        print("   3. Download Node.js from: https://nodejs.org/")
        print("   4. After installing, restart this script")
        print("\n📱 Backend is running at: http://localhost:8000")
        print("   API Docs: http://localhost:8000/docs")
        print("\n📝 You can manually start frontend:")
        print("   cd frontend")
        print("   npm run dev")
        print("="*60 + "\n")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n⛔ Shutting down...")
            sys.exit(0)
    else:
        print("\n❌ Failed to start services")
        sys.exit(1)

if __name__ == "__main__":
    main()


