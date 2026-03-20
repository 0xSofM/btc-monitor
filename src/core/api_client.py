"""
BTC Monitor API Client
Handles API communication and rate limiting
"""

import time
from typing import Dict, List, Optional, Any
import requests


class APIClient:
    """Handles API communication with rate limiting and error handling"""
    
    def __init__(self, base_url: str = "https://bitcoin-data.com/v1", timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()
        self.last_request_time = {}
        self.min_request_interval = 450  # 450 seconds between requests for rate limiting (8 requests/hour)
        
    def _enforce_rate_limit(self, endpoint: str) -> None:
        """Enforce rate limiting between requests"""
        current_time = time.time()
        last_time = self.last_request_time.get(endpoint, 0)
        
        time_since_last = current_time - last_time
        if time_since_last < self.min_request_interval:
            wait_time = self.min_request_interval - time_since_last
            print(f"Rate limiting: waiting {wait_time:.1f} seconds before requesting {endpoint}")
            time.sleep(wait_time)
            
        self.last_request_time[endpoint] = time.time()
    
    def get(self, endpoint: str, params: Optional[Dict] = None, enforce_rate_limit: bool = True) -> List[Dict]:
        """Make GET request with error handling and optional rate limiting"""
        if enforce_rate_limit:
            self._enforce_rate_limit(endpoint)
            
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            payload = response.json()
            
            if isinstance(payload, list):
                return payload
            elif isinstance(payload, dict):
                if "d" in payload:
                    return [payload]
                for key in ("data", "result", "items"):
                    value = payload.get(key)
                    if isinstance(value, list):
                        return value
                        
            print(f"Unexpected response format from {endpoint}")
            return []
            
        except requests.exceptions.RequestException as e:
            print(f"Request failed for {endpoint}: {e}")
            return []
        except ValueError as e:
            print(f"JSON decode error for {endpoint}: {e}")
            return []
    
    def get_indicator_data(self, indicator: str, days: int = 1) -> List[Dict]:
        """Get specific indicator data"""
        endpoints = {
            'btc-price': 'btc-price',
            'mvrv-zscore': 'mvrv-zscore',
            'lth-mvrv': 'lth-mvrv',
            'puell-multiple': 'puell-multiple',
            'nupl': 'nupl'
        }
        
        if indicator not in endpoints:
            raise ValueError(f"Unknown indicator: {indicator}")
            
        params = {'days': days} if days > 1 else None
        return self.get(endpoints[indicator], params)
    
    def check_api_status(self) -> bool:
        """Check if API is accessible"""
        try:
            response = self.session.get(f"{self.base_url}/btc-price", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def get_all_indicators(self, days: int = 1) -> Dict[str, List[Dict]]:
        """Get all indicator data"""
        indicators = ['btc-price', 'mvrv-zscore', 'lth-mvrv', 'puell-multiple', 'nupl']
        results = {}
        
        for indicator in indicators:
            print(f"Fetching {indicator}...")
            data = self.get_indicator_data(indicator, days)
            results[indicator] = data
            
            # Add delay between requests to respect rate limits
            if indicator != indicators[-1]:
                time.sleep(1)
                
        return results
