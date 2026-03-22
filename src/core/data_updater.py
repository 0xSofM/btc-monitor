"""
BTC Monitor Data Updater - Core Module
Consolidated data fetching and updating logic
"""

import json
import os
import time
from datetime import UTC, datetime
from typing import Dict, List, Optional, Any, Union

import requests


class DataUpdater:
    """Main data updater for BTC indicators - strictly uses bitcoin-data.com API"""
    
    def __init__(self):
        self.api_base = "https://bitcoin-data.com/v1"
        self.timeout = 30
        self.history_file = "data/history/btc_indicators_history.json"
        self.latest_file = "data/latest/btc_indicators_latest.json"
        self.ma200w_days = 1400
        
    def fetch_json(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Fetch data from bitcoin-data.com API with retry logic"""
        url = f"{self.api_base}/{endpoint}"
        
        for attempt in range(3):
            try:
                response = requests.get(url, params=params, timeout=self.timeout)
                response.raise_for_status()
                payload = response.json()
                
                if isinstance(payload, list):
                    return payload
                if isinstance(payload, dict):
                    if "d" in payload:
                        return [payload]
                    for key in ("data", "result", "items"):
                        value = payload.get(key)
                        if isinstance(value, list):
                            return value
                            
                print(f" [attempt {attempt + 1}] {endpoint} unexpected response shape")
                return []
                
            except Exception as error:
                print(f" [attempt {attempt + 1}] {endpoint} failed: {error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    
        return []
    
    def fetch_indicator_data(self, indicator: str, days: int = 1) -> List[Dict[str, Any]]:
        """Fetch specific indicator data from bitcoin-data.com API"""
        endpoints = {
            'btc-price': 'btc-price',
            'mvrv-zscore': 'mvrv-zscore',
            'lth-mvrv': 'lth-mvrv',
            'puell-multiple': 'puell-multiple',
            'nupl': 'nupl'
        }
        
        if indicator not in endpoints:
            raise ValueError(f"Unknown indicator: {indicator}")
            
        endpoint = f"{endpoints[indicator]}/{days}"
        return self.fetch_json(endpoint)
    
    def fetch_all_indicators_latest(self) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch latest data (1 day) for all indicators - used for daily updates"""
        indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
        results = {}
        
        for indicator in indicators:
            print(f"Fetching {indicator} (latest)...")
            data = self.fetch_indicator_data(indicator, days=1)
            results[indicator] = data
            
            # Add delay between requests to respect rate limits
            if indicator != indicators[-1]:
                print(f"  Waiting 5s before next request...")
                time.sleep(5)
                
        return results
    
    def fetch_all_indicators_history(self, days: int = 0) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch full historical data for all indicators.
        If days=0, fetch all available history.
        """
        indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
        results = {}
        
        days_param = days if days > 0 else 'all'
        
        for indicator in indicators:
            print(f"Fetching {indicator} (history: {days_param})...")
            data = self.fetch_indicator_data(indicator, days=days_param if isinstance(days_param, int) else 0)
            results[indicator] = data
            
            # Add delay between requests to respect rate limits
            if indicator != indicators[-1]:
                print(f"  Waiting 5s before next request...")
                time.sleep(5)
                
        return results
    
    def load_history_data(self) -> List[Dict[str, Any]]:
        """Load existing history data"""
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as e:
            print(f"Error loading history file: {e}")
            return []
    
    def save_history_data(self, data: List[Dict[str, Any]]) -> bool:
        """Save history data to file"""
        try:
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving history file: {e}")
            return False
    
    def load_latest_data(self) -> Optional[Dict[str, Any]]:
        """Load latest summary data"""
        try:
            with open(self.latest_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None
    
    def save_latest_data(self, data: Dict[str, Any]) -> bool:
        """Save latest summary data"""
        try:
            with open(self.latest_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving latest file: {e}")
            return False

