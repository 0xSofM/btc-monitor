#!/usr/bin/env python3
"""
Development server launcher
Starts both backend data service and frontend development server
"""

import os
import sys
import subprocess
import time
import signal
from pathlib import Path


def check_requirements():
    """Check if required tools are available"""
    missing = []
    
    # Check Node.js
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing.append("Node.js")
    
    # Check npm
    try:
        subprocess.run(["npm", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing.append("npm")
    
    # Check Python
    try:
        subprocess.run(["python", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing.append("Python")
    
    if missing:
        print(f"❌ Missing required tools: {', '.join(missing)}")
        print("Please install the missing tools and try again.")
        return False
    
    return True


def install_dependencies():
    """Install dependencies if needed"""
    base_path = Path(__file__).parent.parent
    
    # Install Python dependencies
    requirements_file = base_path / "requirements.txt"
    if requirements_file.exists():
        print("📦 Installing Python dependencies...")
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], check=True)
    
    # Install Node.js dependencies
    package_file = base_path / "app" / "package.json"
    if package_file.exists():
        app_path = base_path / "app"
        print("📦 Installing Node.js dependencies...")
        subprocess.run(["npm", "install"], cwd=app_path, check=True)


def start_frontend():
    """Start the frontend development server"""
    base_path = Path(__file__).parent.parent
    app_path = base_path / "app"
    
    print("🚀 Starting frontend development server...")
    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=app_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )


def start_data_service():
    """Start the data update service"""
    base_path = Path(__file__).parent.parent
    
    print("🔄 Starting data update service...")
    return subprocess.Popen(
        [sys.executable, "src/cli/main.py", "update", "--daemon", "--interval", "300"],
        cwd=base_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )


def main():
    """Main development launcher"""
    print("🔧 BTC Monitor Development Environment")
    print("=" * 50)
    
    # Check requirements
    if not check_requirements():
        return 1
    
    # Install dependencies
    try:
        install_dependencies()
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return 1
    
    # Start services
    processes = []
    
    try:
        # Start data service
        data_process = start_data_service()
        processes.append(data_process)
        
        # Wait a moment for data service to start
        time.sleep(2)
        
        # Start frontend
        frontend_process = start_frontend()
        processes.append(frontend_process)
        
        print("\n✅ Development environment started!")
        print("📱 Frontend: http://localhost:5173")
        print("📊 Data service: Running in background")
        print("\nPress Ctrl+C to stop all services")
        
        # Wait for interrupt
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Stopping development services...")
        
        # Terminate all processes
        for process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            except:
                pass
        
        print("✅ All services stopped.")
        return 0
    
    except Exception as e:
        print(f"❌ Error starting development environment: {e}")
        
        # Clean up processes
        for process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                pass
        
        return 1


if __name__ == "__main__":
    sys.exit(main())
