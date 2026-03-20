"""
Integration tests for BTC Monitor CLI
"""

import unittest
import sys
import subprocess
from pathlib import Path

# Add parent directory to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.cli.main import create_parser


class TestCLI(unittest.TestCase):
    """Test CLI interface"""
    
    def setUp(self):
        self.parser = create_parser()
    
    def test_parser_help(self):
        """Test parser help functionality"""
        with self.assertRaises(SystemExit):
            self.parser.parse_args(['--help'])
    
    def test_parser_update_command(self):
        """Test update command parsing"""
        args = self.parser.parse_args(['update'])
        self.assertEqual(args.command, 'update')
        self.assertFalse(args.daemon)
        self.assertIsNone(args.daily)
    
    def test_parser_update_daemon(self):
        """Test update daemon command parsing"""
        args = self.parser.parse_args(['update', '--daemon'])
        self.assertEqual(args.command, 'update')
        self.assertTrue(args.daemon)
        self.assertEqual(args.interval, 600)
    
    def test_parser_update_daily(self):
        """Test update daily command parsing"""
        args = self.parser.parse_args(['update', '--daily', '08:00'])
        self.assertEqual(args.command, 'update')
        self.assertEqual(args.daily, '08:00')
    
    def test_parser_validate_command(self):
        """Test validate command parsing"""
        args = self.parser.parse_args(['validate'])
        self.assertEqual(args.command, 'validate')
        self.assertFalse(args.full)
    
    def test_parser_validate_full(self):
        """Test validate full command parsing"""
        args = self.parser.parse_args(['validate', '--full'])
        self.assertEqual(args.command, 'validate')
        self.assertTrue(args.full)
    
    def test_parser_check_api_command(self):
        """Test check-api command parsing"""
        args = self.parser.parse_args(['check-api'])
        self.assertEqual(args.command, 'check-api')


class TestCLIIntegration(unittest.TestCase):
    """Test CLI integration with actual commands"""
    
    def test_cli_help_exit_code(self):
        """Test that CLI help exits with code 0"""
        result = subprocess.run([
            sys.executable, 'src/cli/main.py', '--help'
        ], capture_output=True, text=True, cwd=Path(__file__).parent.parent.parent)
        
        self.assertEqual(result.returncode, 0)
        self.assertIn('BTC Monitor', result.stdout)
    
    def test_cli_invalid_command(self):
        """Test that invalid command exits with error code"""
        result = subprocess.run([
            sys.executable, 'src/cli/main.py', 'invalid-command'
        ], capture_output=True, text=True, cwd=Path(__file__).parent.parent.parent)
        
        # Should exit with error code (could be 1 or 2)
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
