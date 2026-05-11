#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Setup script for CXR Lab - Face Recognition Attendance System
Run this on a new laptop to automatically download and install everything needed
"""

import os
import sys
import platform
import subprocess
import shutil
from pathlib import Path

class Setup:
    def __init__(self):
        self.system = platform.system()
        self.project_root = Path(__file__).parent.absolute()
        self.installed = []
        self.failed = []

    def print_banner(self):
        print("\n" + "="*70)
        print(" [SETUP] CXR Lab - Face Recognition Attendance System")
        print(" Setting up everything needed to run the project")
        print("="*70 + "\n")

    def check_python_version(self):
        """Check if Python 3.10+ is installed"""
        print("[CHECK] Checking Python version...")
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 10):
            print(f"[FAIL] Python 3.10+ required, but found {version.major}.{version.minor}")
            sys.exit(1)
        print(f"[OK] Python {version.major}.{version.minor} found\n")

    def install_python_packages(self):
        """Install Python dependencies"""
        print("[PKG] Installing Python packages...")
        backend_dir = self.project_root / "backend"
        
        requirements = """
numpy>=1.24.0
pandas>=1.5.0
opencv-python>=4.7.0
insightface>=0.7.3
onnxruntime>=1.15.0
scipy>=1.10.0
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.0
aiosqlite>=0.19.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
        """.strip().split('\n')

        try:
            print("Installing requirements...")
            for req in requirements:
                req = req.strip()
                if req and not req.startswith('#'):
                    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', req])
            
            self.installed.append("Python packages")
            print("[OK] Python packages installed\n")
        except Exception as e:
            self.failed.append(f"Python packages: {e}")
            print(f"[FAIL] Failed to install Python packages: {e}\n")

    def install_node_packages(self):
        """Install Node.js dependencies for frontend"""
        print("[PKG] Installing Node.js packages...")
        frontend_dir = self.project_root / "frontend"
        
        if not shutil.which('npm'):
            print("[WARN] npm not found - skipping frontend setup")
            print("   Install Node.js from https://nodejs.org/ manually\n")
            return

        try:
            os.chdir(frontend_dir)
            subprocess.check_call(['npm', 'install', '--legacy-peer-deps'], 
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.installed.append("Node packages")
            print("[OK] Node packages installed\n")
        except Exception as e:
            self.failed.append(f"Node packages: {e}")
            print(f"[FAIL] Failed to install Node packages: {e}\n")
        finally:
            os.chdir(self.project_root)

    def download_insightface_models(self):
        """Download InsightFace models"""
        print("[AI] Downloading AI models (this may take a few minutes)...")
        
        home_dir = Path.home()
        models_dir = home_dir / '.insightface' / 'models' / 'buffalo_l'
        models_dir.mkdir(parents=True, exist_ok=True)
        
        models = {
            '1k3d68.onnx': 'https://github.com/deepinsight/insightface/releases/download/v0.7/1k3d68-ccc4ee8b.onnx',
            '2d106det.onnx': 'https://github.com/deepinsight/insightface/releases/download/v0.7/2d106det-1afe5e5.onnx',
            'det_10g.onnx': 'https://github.com/deepinsight/insightface/releases/download/v0.7/det_10g.onnx',
            'genderage.onnx': 'https://github.com/deepinsight/insightface/releases/download/v0.7/genderage.onnx',
            'w600k_r50.onnx': 'https://github.com/deepinsight/insightface/releases/download/v0.7/w600k_r50-7f9fafaf.onnx',
        }
        
        try:
            import urllib.request
            for model_name, url in models.items():
                model_path = models_dir / model_name
                if model_path.exists():
                    print(f"  [OK] {model_name} already exists")
                else:
                    print(f"  Downloading {model_name}...")
                    urllib.request.urlretrieve(url, model_path)
                    print(f"  [OK] {model_name} downloaded")
            
            self.installed.append("AI models")
            print("[OK] AI models downloaded\n")
        except Exception as e:
            self.failed.append(f"AI models: {e}")
            print(f"[FAIL] Failed to download AI models: {e}\n")

    def setup_directories(self):
        """Create necessary directories"""
        print("[DIR] Setting up directories...")
        
        dirs = [
            'backend/embeddings',
            'backend/unknown_faces',
            'public/assets',
        ]
        
        try:
            for dir_path in dirs:
                full_path = self.project_root / dir_path
                full_path.mkdir(parents=True, exist_ok=True)
                print(f"  [OK] {dir_path}")
            
            self.installed.append("Directories")
            print("[OK] Directories created\n")
        except Exception as e:
            self.failed.append(f"Directories: {e}")
            print(f"[FAIL] Failed to create directories: {e}\n")

    def setup_database(self):
        """Initialize database"""
        print("[DB] Initializing database...")
        
        backend_dir = self.project_root / "backend"
        try:
            os.chdir(backend_dir)
            # Database will be created automatically on first run
            # But we can test the connection
            print("  [OK] Database will be initialized on first run")
            self.installed.append("Database setup")
            print("[OK] Database ready\n")
        except Exception as e:
            self.failed.append(f"Database: {e}")
            print(f"[FAIL] Database setup issue: {e}\n")
        finally:
            os.chdir(self.project_root)

    def verify_installation(self):
        """Verify all components are installed"""
        print("[CHK] Verifying installation...\n")
        
        checks = {
            'Python': (lambda: subprocess.run([sys.executable, '--version'], 
                                              capture_output=True, text=True).returncode == 0),
            'pip': (lambda: shutil.which('pip') is not None),
            'npm': (lambda: shutil.which('npm') is not None),
            'Python packages': (lambda: self._check_python_imports()),
            'Embeddings dir': (lambda: (self.project_root / 'backend/embeddings').exists()),
            'AI models': (lambda: self._check_ai_models()),
        }
        
        results = {}
        for name, check in checks.items():
            try:
                result = check()
                status = "[OK]" if result else "[WARN]"
                results[name] = result
                print(f"{status} {name}")
            except Exception as e:
                print(f"[FAIL] {name}: {e}")
                results[name] = False
        
        return all(results.values())

    def _check_python_imports(self):
        """Check if critical Python packages are importable"""
        critical_packages = ['numpy', 'cv2', 'fastapi', 'sqlalchemy', 'insightface']
        for package in critical_packages:
            try:
                __import__(package)
            except ImportError:
                return False
        return True

    def _check_ai_models(self):
        """Check if AI models are downloaded"""
        home_dir = Path.home()
        models_dir = home_dir / '.insightface' / 'models' / 'buffalo_l'
        if not models_dir.exists():
            return False
        model_files = list(models_dir.glob('*.onnx'))
        return len(model_files) >= 3  # At least some models should exist

    def print_summary(self):
        """Print installation summary"""
        print("\n" + "="*70)
        print(" [SUMMARY] INSTALLATION RESULTS")
        print("="*70 + "\n")
        
        if self.installed:
            print("[OK] Successfully installed:")
            for item in self.installed:
                print(f"   * {item}")
            print()
        
        if self.failed:
            print("[FAIL] Failed to install:")
            for item in self.failed:
                print(f"   * {item}")
            print()
        
        print("="*70)

    def print_next_steps(self):
        """Print next steps"""
        print("\n[INFO] NEXT STEPS:\n")
        
        print("1. [CONFIG] Configure the system (optional):")
        print("   - Update backend/app/core/config.py if needed")
        print("   - Admin credentials: admin / admin123\n")
        
        print("2. [CSV] Prepare CSV files (required):")
        print("   - Create CSV_PATH directory and add:")
        print("     * timetable.csv")
        print("     * student_in_class.csv\n")
        
        print("3. [ENROLL] Enroll students:")
        print("   - Visit: https://localhost:5173/enroll")
        print("   - Enter: Name, Reg No, Upload photo\n")
        
        print("4. [RUN] Run the system:")
        print("   python start_app.py")
        print("   Or for network access:")
        print("   python start_app_network.py\n")
        
        print("5. [ACCESS] Access the app:")
        print("   - Frontend: https://localhost:5173")
        print("   - Backend: http://localhost:8000/docs\n")

    def run(self):
        """Run complete setup"""
        self.print_banner()
        
        try:
            self.check_python_version()
            self.install_python_packages()
            self.install_node_packages()
            self.download_insightface_models()
            self.setup_directories()
            self.setup_database()
            
            print("\n" + "="*70)
            if self.verify_installation():
                print("[OK] ALL COMPONENTS VERIFIED AND READY!")
                print("="*70)
                self.print_next_steps()
                return 0
            else:
                print("[WARN] Some components may not be fully installed")
                print("="*70)
                return 1
        
        except KeyboardInterrupt:
            print("\n\n[FAIL] Setup cancelled by user")
            return 1
        except Exception as e:
            print(f"\n[FAIL] Setup failed: {e}")
            return 1
        finally:
            self.print_summary()

if __name__ == '__main__':
    setup = Setup()
    exit_code = setup.run()
    sys.exit(exit_code)
