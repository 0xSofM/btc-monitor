"""Test cases for data_updater module"""

import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.data_updater import DataUpdater


class TestDataUpdater:
    """Test DataUpdater class"""
    
    def test_init(self):
        """Test DataUpdater initialization"""
        updater = DataUpdater()
        assert updater.api_base == "https://bitcoin-data.com/v1"
        assert updater.timeout == 30
        assert updater.ma200w_days == 1400
    
    def test_load_history_data_empty(self, tmp_path):
        """Test loading history data when file doesn't exist"""
        updater = DataUpdater()
        updater.history_file = str(tmp_path / "nonexistent.json")
        data = updater.load_history_data()
        assert data == []
    
    def test_load_latest_data_empty(self, tmp_path):
        """Test loading latest data when file doesn't exist"""
        updater = DataUpdater()
        updater.latest_file = str(tmp_path / "nonexistent.json")
        data = updater.load_latest_data()
        assert data is None
    
    def test_save_history_data(self, tmp_path):
        """Test saving history data"""
        updater = DataUpdater()
        updater.history_file = str(tmp_path / "test_history.json")
        
        test_data = [
            {"d": "2023-01-01", "btcPrice": 50000},
            {"d": "2023-01-02", "btcPrice": 51000}
        ]
        
        result = updater.save_history_data(test_data)
        assert result is True
        
        # Verify file was created and contains correct data
        loaded_data = updater.load_history_data()
        assert loaded_data == test_data
    
    def test_save_latest_data(self, tmp_path):
        """Test saving latest data"""
        updater = DataUpdater()
        updater.latest_file = str(tmp_path / "test_latest.json")
        
        test_data = {
            "date": "2023-01-01",
            "btcPrice": 50000,
            "signalCount": 2
        }
        
        result = updater.save_latest_data(test_data)
        assert result is True
        
        # Verify file was created and contains correct data
        loaded_data = updater.load_latest_data()
        assert loaded_data == test_data


if __name__ == "__main__":
    pytest.main([__file__])
