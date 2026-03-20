"""
Unit tests for BTC Monitor core modules
"""

import unittest
import sys
import os
from pathlib import Path

# Add parent directory to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.core.indicator_calculator import IndicatorCalculator
from src.core.data_updater import DataUpdater


class TestIndicatorCalculator(unittest.TestCase):
    """Test indicator calculation logic"""
    
    def setUp(self):
        self.calculator = IndicatorCalculator()
    
    def test_calculate_signals_all_triggered(self):
        """Test when all 5 signals are triggered"""
        data_point = {
            'btcPrice': 50000,
            'ma200w': 60000,  # Price below MA
            'mvrvZscore': -0.5,  # Below 0
            'lthMvrv': 0.8,  # Below 1
            'puellMultiple': 0.3,  # Below 0.5
            'nupl': -0.1  # Below 0
        }
        
        signals = self.calculator.calculate_signals(data_point)
        
        self.assertEqual(signals['signal_count'], 5)
        self.assertEqual(signals['signal_strength'], 'MAXIMUM')
        self.assertTrue(signals['price_200w_ma_signal'])
        self.assertTrue(signals['mvrv_zscore_signal'])
        self.assertTrue(signals['lth_mvrv_signal'])
        self.assertTrue(signals['puell_multiple_signal'])
        self.assertTrue(signals['nupl_signal'])
    
    def test_calculate_signals_none_triggered(self):
        """Test when no signals are triggered"""
        data_point = {
            'btcPrice': 70000,
            'ma200w': 50000,  # Price above MA
            'mvrvZscore': 1.5,  # Above 0
            'lthMvrv': 2.0,  # Above 1
            'puellMultiple': 1.0,  # Above 0.5
            'nupl': 0.5  # Above 0
        }
        
        signals = self.calculator.calculate_signals(data_point)
        
        self.assertEqual(signals['signal_count'], 0)
        self.assertEqual(signals['signal_strength'], 'NONE')
        self.assertFalse(signals['price_200w_ma_signal'])
        self.assertFalse(signals['mvrv_zscore_signal'])
        self.assertFalse(signals['lth_mvrv_signal'])
        self.assertFalse(signals['puell_multiple_signal'])
        self.assertFalse(signals['nupl_signal'])
    
    def test_calculate_price_to_200w_ma(self):
        """Test price to MA ratio calculation"""
        # Normal case
        ratio = self.calculator.calculate_price_to_200w_ma(50000, 60000)
        self.assertAlmostEqual(ratio, 0.8333, places=2)
        
        # Equal case
        ratio = self.calculator.calculate_price_to_200w_ma(60000, 60000)
        self.assertEqual(ratio, 1.0)
        
        # Zero MA case
        ratio = self.calculator.calculate_price_to_200w_ma(50000, 0)
        self.assertEqual(ratio, float('inf'))
    
    def test_signal_strength_levels(self):
        """Test signal strength classification"""
        test_cases = [
            (5, 'MAXIMUM'),
            (4, 'STRONG'),
            (3, 'MODERATE'),
            (2, 'WEAK'),
            (1, 'MINIMAL'),
            (0, 'NONE')
        ]
        
        for count, expected_strength in test_cases:
            strength = self.calculator._get_signal_strength(count)
            self.assertEqual(strength, expected_strength)


class TestDataUpdater(unittest.TestCase):
    """Test data updater functionality"""
    
    def setUp(self):
        self.updater = DataUpdater()
    
    def test_file_paths(self):
        """Test that file paths are correctly set"""
        self.assertEqual(self.updater.history_file, "data/history/btc_indicators_history.json")
        self.assertEqual(self.updater.latest_file, "data/latest/btc_indicators_latest.json")
    
    def test_load_history(self):
        """Test loading history file"""
        history = self.updater.load_history_data()
        # Should return a list (may be empty or contain data)
        self.assertIsInstance(history, list)
    
    def test_load_latest(self):
        """Test loading latest file"""
        latest = self.updater.load_latest_data()
        # Should return dict or None
        self.assertTrue(isinstance(latest, dict) or latest is None)


if __name__ == '__main__':
    unittest.main()
