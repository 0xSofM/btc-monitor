"""
BTC Monitor Data Updater - Core Module
Consolidated data fetching and updating logic
"""

import json
import os
import time
from datetime import UTC, datetime
from typing import Dict, List, Optional, Any

import requests


class DataUpdater:
    """Main data updater for BTC indicators"""
    
    def __init__(self):
        self.api_base = "https://bitcoin-data.com/v1"
        self.coinbase_spot_url = "https://api.coinbase.com/v2/prices/BTC-USD/spot"
        self.coingecko_spot_url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        self.timeout = 30
        self.history_file = "data/history/btc_indicators_history.json"
        self.latest_file = "data/latest/btc_indicators_latest.json"
        self.ma200w_days = 1400
        
    def fetch_json(self, endpoint: str, params: Optional[Dict] = None) -> List[Dict]:
        """Fetch data from API with retry logic"""
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
    
    def fetch_backup_btc_price(self) -> Optional[Dict]:
        """Fetch BTC price from backup providers"""
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        
        # Try Coinbase first
        try:
            response = requests.get(self.coinbase_spot_url, timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
            amount = payload.get("data", {}).get("amount")
            if amount is not None:
                return {
                    "d": today,
                    "btcPrice": float(amount),
                    "source": "coinbase",
                }
        except Exception as error:
            print(f"  [fallback] coinbase spot failed: {error}")
        
        # Try CoinGecko
        try:
            headers = {}
            demo_key = os.getenv("COINGECKO_DEMO_API_KEY")
            if demo_key:
                headers["x-cg-demo-api-key"] = demo_key
                
            response = requests.get(self.coingecko_spot_url, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
            amount = payload.get("bitcoin", {}).get("usd")
            if amount is not None:
                return {
                    "d": today,
                    "btcPrice": float(amount),
                    "source": "coingecko",
                }
        except Exception as error:
            print(f"  [fallback] coingecko spot failed: {error}")
            
        return None
    
    def fetch_indicator_data(self, indicator: str) -> List[Dict]:
        """Fetch specific indicator data"""
        endpoints = {
            'btc-price': 'btc-price',
            'mvrv-zscore': 'mvrv-zscore',
            'lth-mvrv': 'lth-mvrv',
            'puell-multiple': 'puell-multiple',
            'nupl': 'nupl'
        }
        
        if indicator not in endpoints:
            raise ValueError(f"Unknown indicator: {indicator}")
            
        return self.fetch_json(endpoints[indicator])
    
    def load_history_data(self) -> List[Dict]:
        """Load existing history data"""
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as e:
            print(f"Error loading history file: {e}")
            return []
    
    def save_history_data(self, data: List[Dict]) -> bool:
        """Save history data to file"""
        try:
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving history file: {e}")
            return False
    
    def load_latest_data(self) -> Optional[Dict]:
        """Load latest summary data"""
        try:
            with open(self.latest_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None
    
    def save_latest_data(self, data: Dict) -> bool:
        """Save latest summary data"""
        try:
            with open(self.latest_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving latest file: {e}")
            return False
