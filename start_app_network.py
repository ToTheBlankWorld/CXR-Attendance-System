#!/usr/bin/env python3
"""
Face Recognition Attendance System - Network Startup Script
Starts backend and frontend accessible over network
Uses 0.0.0.0 to allow connections from other machines
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

def get_local_ip():
    """Get local network IP address"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def start_backend():
    """Start FastAPI backend server on network"""
    print("\n" + "="*60)
    print("🚀 Starting FastAPI Backend (Network Mode)...")
    print("="*60)
    
    os.chdir(BACKEND_DIR)
    
    # Command to start the backend on all network interfaces
    cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--reload",
        "--host", "0.0.0.0",  # Listen on all interfaces
        "--port", "8000"
    ]
    
    try:
        subprocess.Popen(cmd)
        print("✅ Backend started on 0.0.0.0:8000")
        time.sleep(2)
        return True
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        return False

def start_frontend():
    """Start Vite frontend development server on network"""
    print("\n" + "="*60)
    print("🎨 Starting Vite Frontend (Network Mode)...")
    print("="*60)
    
    os.chdir(FRONTEND_DIR)
    
    # Use shell=True and direct npm command for Windows compatibility
    if sys.platform == "win32":
        cmd = "npm run dev -- --host"
        try:
            subprocess.Popen(cmd, shell=True)
            print("✅ Frontend started on 0.0.0.0:5173")
            time.sleep(1)
            return True
        except Exception as e:
            print(f"❌ Error starting frontend: {e}")
            print("   Make sure you have Node.js and npm installed")
            return False
    else:
        cmd = ["npm", "run", "dev", "--", "--host"]
        try:
            subprocess.Popen(cmd)
            print("✅ Frontend started on 0.0.0.0:5173")
            return True
        except Exception as e:
            print(f"❌ Error starting frontend: {e}")
            return False

def main():
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*58 + "║")
    print("║  🎓 Face Recognition Attendance System 🎓" + " "*14 + "║")
    print("║  🌐 Network Mode (Accessible Across Network)" + " "*9 + "║")
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
    
    # Get local IP
    local_ip = get_local_ip()
    
    # Start services
    print("\n" + "="*60)
    print("Starting services on network...")
    print("="*60)
    
    backend_ok = start_backend()
    frontend_ok = start_frontend()
    
    if backend_ok and frontend_ok:
        print("\n" + "="*60)
        print("✅ All services started on network!")
        print("="*60)
        print("\n📱 Local Access (from this machine):")
        print("   🌐 Frontend: https://localhost:5173")
        print("   🔌 Backend:  http://localhost:8000")
        print("   📚 API Docs: http://localhost:8000/docs")
        print("\n🌐 Network Access (from other machines):")
        print(f"   🌐 Frontend: https://{local_ip}:5173")
        print(f"   🔌 Backend:  http://{local_ip}:8000")
        print(f"   📚 API Docs: http://{local_ip}:8000/docs")
        print("\n💡 Login with:")
        print("   👤 Username: admin")
        print("   🔐 Password: admin123")
        print("\n⚠️  Note: Using HTTPS on network may show certificate warning")
        print("   Click 'Proceed' or 'Advanced' to continue")
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
        print("\n📱 Backend is running at:")
        print(f"   Local:   http://localhost:8000")
        print(f"   Network: http://{local_ip}:8000")
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



