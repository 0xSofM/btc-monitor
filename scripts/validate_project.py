#!/usr/bin/env python3
"""
Project validation script
Checks project structure and dependencies
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List


def check_project_structure() -> Dict[str, bool]:
    """Check if required project structure exists"""
    base_path = Path(__file__).parent.parent
    
    checks = {
        "src_directory": (base_path / "src").exists(),
        "app_directory": (base_path / "app").exists(),
        "requirements_file": (base_path / "requirements.txt").exists(),
        "package_json": (base_path / "app" / "package.json").exists(),
        "main_tsx": (base_path / "app" / "src" / "main.tsx").exists(),
        "app_tsx": (base_path / "app" / "src" / "App.tsx").exists(),
        "data_updater": (base_path / "src" / "core" / "data_updater.py").exists(),
        "cli_main": (base_path / "src" / "cli" / "main.py").exists(),
    }
    
    return checks


def check_dependencies() -> Dict[str, bool]:
    """Check if dependencies are properly configured"""
    base_path = Path(__file__).parent.parent
    
    # Check Python dependencies
    req_file = base_path / "requirements.txt"
    python_deps = {}
    if req_file.exists():
        with open(req_file, 'r') as f:
            content = f.read()
            python_deps = {
                "has_requests": "requests" in content,
                "has_dev_deps": any(dep in content for dep in ["pytest", "black", "ruff", "mypy"]),
            }
    
    # Check Node.js dependencies
    package_file = base_path / "app" / "package.json"
    node_deps = {}
    if package_file.exists():
        with open(package_file, 'r') as f:
            package_data = json.load(f)
            deps = package_data.get("dependencies", {})
            dev_deps = package_data.get("devDependencies", {})
            
            node_deps = {
                "has_react": "react" in deps,
                "has_typescript": "typescript" in dev_deps,
                "has_vite": "vite" in dev_deps,
                "has_tailwind": "tailwindcss" in dev_deps,
            }
    
    return {**python_deps, **node_deps}


def check_ui_components() -> Dict[str, bool]:
    """Check if essential UI components exist"""
    base_path = Path(__file__).parent.parent
    ui_path = base_path / "app" / "src" / "components" / "ui"
    
    if not ui_path.exists():
        return {"ui_directory": False}
    
    required_components = [
        "button.tsx",
        "card.tsx", 
        "badge.tsx",
        "progress.tsx",
        "tabs.tsx",
        "table.tsx",
        "input.tsx",
        "label.tsx"
    ]
    
    component_checks = {}
    for component in required_components:
        component_name = component.replace(".tsx", "").replace(".ts", "")
        component_checks[f"has_{component_name}"] = (ui_path / component).exists()
    
    component_checks["ui_directory"] = True
    return component_checks


def main():
    """Main validation function"""
    print("🔍 BTC Monitor Project Validation")
    print("=" * 50)
    
    # Check project structure
    print("\n📁 Project Structure:")
    structure_checks = check_project_structure()
    for check_name, passed in structure_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
    
    # Check dependencies
    print("\n📦 Dependencies:")
    dep_checks = check_dependencies()
    for check_name, passed in dep_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
    
    # Check UI components
    print("\n🎨 UI Components:")
    ui_checks = check_ui_components()
    for check_name, passed in ui_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
    
    # Summary
    all_checks = {**structure_checks, **dep_checks, **ui_checks}
    total_checks = len(all_checks)
    passed_checks = sum(all_checks.values())
    
    print("\n📊 Summary:")
    print(f"  Total checks: {total_checks}")
    print(f"  Passed: {passed_checks}")
    print(f"  Failed: {total_checks - passed_checks}")
    print(f"  Success rate: {passed_checks/total_checks*100:.1f}%")
    
    if passed_checks == total_checks:
        print("\n🎉 All checks passed! Project is ready.")
        return 0
    else:
        print("\n⚠️  Some checks failed. Please review the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
