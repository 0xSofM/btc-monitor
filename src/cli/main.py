"""
BTC Monitor CLI - Main command line interface
Consolidates functionality from multiple scripts into a unified CLI
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.services.auto_update_service import AutoUpdateService
from src.services.data_validator import DataValidator


def create_parser():
    """Create the main argument parser"""
    parser = argparse.ArgumentParser(
        description='BTC Monitor - Bitcoin Investment Indicator Tracker',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s update                    # Single data update
  %(prog)s update --daemon           # Run as daemon
  %(prog)s update --daily 08:00      # Daily update at 8 AM
  %(prog)s validate                   # Validate data integrity
  %(prog)s check-api                  # Check API connectivity
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update BTC indicator data')
    update_parser.add_argument('--daemon', action='store_true', help='Run in daemon mode')
    update_parser.add_argument('--daily', help='Run daily at specified time (e.g., 08:00)')
    update_parser.add_argument('--interval', type=int, default=600, help='Update interval in seconds (daemon mode)')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate data integrity')
    validate_parser.add_argument('--full', action='store_true', help='Run full validation including API comparison')
    
    # Check command
    check_parser = subparsers.add_parser('check-api', help='Check API connectivity')
    
    return parser


def cmd_update(args):
    """Handle update command"""
    service = AutoUpdateService()
    
    if args.check_api:
        return service.check_api()
    elif args.daemon:
        service.run_daemon(args.interval)
    elif args.daily:
        service.run_daily(args.daily)
    else:
        success = service.update_data()
        return 0 if success else 1


def cmd_validate(args):
    """Handle validate command"""
    validator = DataValidator()
    
    if args.full:
        results = validator.run_full_validation()
        validator.print_validation_report(results)
        return 0 if results['overall_status'] != 'error' else 1
    else:
        # Run basic validation
        results = validator.validate_data_consistency()
        print("Data Consistency Check:")
        print(f"Status: {results['status']}")
        if results['issues']:
            print("Issues found:")
            for issue in results['issues']:
                print(f"  - {issue}")
        else:
            print("No issues found")
        return 0 if results['status'] != 'error' else 1


def cmd_check_api(args):
    """Handle check-api command"""
    service = AutoUpdateService()
    accessible = service.check_api()
    return 0 if accessible else 1


def main():
    """Main CLI entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    try:
        if args.command == 'update':
            return cmd_update(args)
        elif args.command == 'validate':
            return cmd_validate(args)
        elif args.command == 'check-api':
            return cmd_check_api(args)
        else:
            print(f"Unknown command: {args.command}")
            return 1
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 130
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
