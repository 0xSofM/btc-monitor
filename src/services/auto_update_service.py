"""
Auto Update Service - Consolidated from auto_update_service.py
Handles automatic data updates with scheduling and daemon mode
Strictly uses bitcoin-data.com API only
"""

import os
import sys
import json
import time
import signal
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.core.data_updater import DataUpdater
from src.core.indicator_calculator import IndicatorCalculator


class AutoUpdateService:
    """Main auto-update service for BTC Monitor - strictly uses bitcoin-data.com API"""
    
    def __init__(self):
        self.data_updater = DataUpdater()
        self.indicator_calculator = IndicatorCalculator()
        self.running = False
        self.setup_logging()
        
    def setup_logging(self):
        """Setup logging configuration"""
        log_level = os.getenv('BTC_LOG_LEVEL', 'INFO')
        logging.basicConfig(
            level=getattr(logging, log_level.upper()),
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('btc_update.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def update_data(self) -> bool:
        """Perform a single data update - fetch only latest data from bitcoin-data.com API"""
        try:
            self.logger.info("Starting data update from bitcoin-data.com API...")
            
            # Fetch latest data (1 day) for all indicators
            indicator_data = self.data_updater.fetch_all_indicators_latest()
            
            if not indicator_data:
                self.logger.error("Failed to fetch indicator data from API")
                return False
            
            # Track actual data dates from API for each indicator
            api_data_dates = {}
            
            # Process and combine data with proper field mapping
            combined_data = {}
            
            # Field mappings for each indicator
            field_mappings = {
                'btc-price': {
                    'fields': {'btcPrice': 'btcPrice', 'price': 'btcPrice', 'ma200w': 'ma200w', 'price_ma200w_ratio': 'price_ma200w_ratio'},
                    'date_field': 'd',
                    'data_date_key': 'btcPrice'
                },
                'mvrv-zscore': {
                    'fields': {'mvrvZscore': 'mvrvZscore', 'mvrv_zscore': 'mvrvZscore'},
                    'date_field': 'd',
                    'data_date_key': 'mvrvZ'
                },
                'lth-mvrv': {
                    'fields': {'lthMvrv': 'lthMvrv', 'lth_mvrv': 'lthMvrv'},
                    'date_field': 'd',
                    'data_date_key': 'lthMvrv'
                },
                'puell-multiple': {
                    'fields': {'puellMultiple': 'puellMultiple', 'puell_multiple': 'puellMultiple'},
                    'date_field': 'd',
                    'data_date_key': 'puell'
                },
                'nupl': {
                    'fields': {'nupl': 'nupl'},
                    'date_field': 'd',
                    'data_date_key': 'nupl'
                }
            }
            
            for indicator, data in indicator_data.items():
                if data and len(data) > 0:
                    latest = data[0]  # API returns latest first
                    config = field_mappings.get(indicator, {})
                    mappings = config.get('fields', {})
                    date_field = config.get('date_field', 'd')
                    data_date_key = config.get('data_date_key')
                    
                    # Record the actual data date from API
                    if data_date_key and date_field in latest:
                        api_data_dates[data_date_key] = latest[date_field]
                    
                    # Extract fields
                    for api_field, our_field in mappings.items():
                        if api_field in latest and latest[api_field] is not None:
                            combined_data[our_field] = latest[api_field]
                    
                    # Also capture the date field for the record
                    if date_field in latest:
                        combined_data['d'] = latest[date_field]
            
            # Add apiDataDate to track when each indicator was actually updated
            combined_data['apiDataDate'] = api_data_dates
            
            self.logger.info(f"Raw data from API: {list(combined_data.keys())}")
            self.logger.info(f"API data dates: {api_data_dates}")
            
            # Validate essential data (btcPrice must be valid)
            btc_price = combined_data.get('btcPrice')
            try:
                btc_price_val = float(btc_price) if btc_price else 0
            except (ValueError, TypeError):
                btc_price_val = 0
                
            if btc_price_val <= 0:
                self.logger.error("Invalid btcPrice from API, skipping update")
                return False
            
            # Validate other critical indicators - all must be present
            required_indicators = ['mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl']
            missing_indicators = []
            
            for indicator in required_indicators:
                val = combined_data.get(indicator)
                try:
                    val_float = float(val) if val is not None else 0
                except (ValueError, TypeError):
                    val_float = 0
                    
                if val_float == 0:
                    missing_indicators.append(indicator)
            
            if missing_indicators:
                self.logger.error(f"Missing or invalid indicators from API: {missing_indicators}. Skipping update.")
                return False
            
            # Load existing history
            history_data = self.data_updater.load_history_data()
            
            # Add signals to the new data point
            enriched_data = self.indicator_calculator.enrich_data_with_signals([combined_data])
            if enriched_data:
                combined_data = enriched_data[0]
            
            data_date = combined_data.get('d', datetime.now().strftime('%Y-%m-%d'))
            
            # Update history - check if we already have this date
            if history_data and history_data[-1].get('d') == data_date:
                # Update today's data
                history_data[-1] = combined_data
                self.logger.info(f"Updated data for {data_date}")
            else:
                # Add new day's data
                history_data.append(combined_data)
                self.logger.info(f"Added new data for {data_date}")
            
            # Save files
            success = (
                self.data_updater.save_history_data(history_data) and
                self.data_updater.save_latest_data(combined_data)
            )
            
            if success:
                signal_count = combined_data.get('signal_count', 0)
                self.logger.info(f"Update completed successfully. Date: {data_date}, Signal count: {signal_count}")
            else:
                self.logger.error("Failed to save data files")
                
            return success
            
        except Exception as e:
            self.logger.error(f"Update failed: {e}")
            return False
    
    def build_full_history(self, days: int = 0) -> bool:
        """
        Build full historical dataset from bitcoin-data.com API.
        If days=0, fetch all available history.
        """
        try:
            self.logger.info(f"Building full history (days={days if days > 0 else 'all'})...")
            
            # Fetch full history for all indicators
            indicator_data = self.data_updater.fetch_all_indicators_history(days=days)
            
            if not indicator_data:
                self.logger.error("Failed to fetch historical data")
                return False
            
            # Build a unified history dataset
            # Create a date-indexed dictionary
            history_by_date = {}
            
            field_mappings = {
                'btc-price': {
                    'fields': {'btcPrice': 'btcPrice', 'price': 'btcPrice', 'ma200w': 'ma200w', 'price_ma200w_ratio': 'price_ma200w_ratio'},
                    'date_field': 'd'
                },
                'mvrv-zscore': {
                    'fields': {'mvrvZscore': 'mvrvZscore', 'mvrv_zscore': 'mvrvZscore'},
                    'date_field': 'd'
                },
                'lth-mvrv': {
                    'fields': {'lthMvrv': 'lthMvrv', 'lth_mvrv': 'lthMvrv'},
                    'date_field': 'd'
                },
                'puell-multiple': {
                    'fields': {'puellMultiple': 'puellMultiple', 'puell_multiple': 'puellMultiple'},
                    'date_field': 'd'
                },
                'nupl': {
                    'fields': {'nupl': 'nupl'},
                    'date_field': 'd'
                }
            }
            
            # Process each indicator's data
            for indicator, data_list in indicator_data.items():
                if not data_list:
                    continue
                    
                config = field_mappings.get(indicator, {})
                mappings = config.get('fields', {})
                date_field = config.get('date_field', 'd')
                
                for record in data_list:
                    date_val = record.get(date_field)
                    if not date_val:
                        continue
                    
                    if date_val not in history_by_date:
                        history_by_date[date_val] = {'d': date_val}
                    
                    # Extract fields
                    for api_field, our_field in mappings.items():
                        if api_field in record and record[api_field] is not None:
                            history_by_date[date_val][our_field] = record[api_field]
            
            # Convert to sorted list
            sorted_dates = sorted(history_by_date.keys())
            history_list = [history_by_date[d] for d in sorted_dates]
            
            # Enrich with signals
            enriched_history = self.indicator_calculator.enrich_data_with_signals(history_list)
            
            # Save history
            success = self.data_updater.save_history_data(enriched_history)
            
            if success:
                self.logger.info(f"Full history built successfully. Total records: {len(enriched_history)}")
                # Also save latest
                if enriched_history:
                    latest = enriched_history[-1]
                    self.data_updater.save_latest_data(latest)
            else:
                self.logger.error("Failed to save history data")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Build history failed: {e}")
            return False
    
    def run_daemon(self, interval: int = 600):
        """Run as daemon with specified interval"""
        self.running = True
        self.logger.info(f"Starting daemon mode with {interval}s interval")
        
        def signal_handler(signum, frame):
            self.logger.info("Received shutdown signal")
            self.running = False
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        while self.running:
            try:
                self.update_data()
                self.logger.info(f"Sleeping for {interval} seconds...")
                time.sleep(interval)
            except KeyboardInterrupt:
                self.logger.info("Interrupted by user")
                break
            except Exception as e:
                self.logger.error(f"Daemon error: {e}")
                time.sleep(60)  # Wait before retrying
        
        self.logger.info("Daemon stopped")
    
    def run_daily(self, time_str: str = "08:00"):
        """Run daily at specified time"""
        self.logger.info(f"Starting daily mode at {time_str}")
        
        target_hour, target_minute = map(int, time_str.split(':'))
        
        while True:
            now = datetime.now()
            target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            
            # If target time has passed today, schedule for tomorrow
            if now > target_time:
                target_time += timedelta(days=1)
            
            sleep_seconds = (target_time - now).total_seconds()
            self.logger.info(f"Next update at {target_time} (in {sleep_seconds:.0f} seconds)")
            
            time.sleep(sleep_seconds)
            
            try:
                self.update_data()
            except Exception as e:
                self.logger.error(f"Daily update failed: {e}")
    
    def check_api(self):
        """Check API connectivity"""
        try:
            data = self.data_updater.fetch_indicator_data('btc-price', days=1)
            if data:
                print("✅ bitcoin-data.com API is accessible")
                return True
            else:
                print("❌ bitcoin-data.com API is not accessible")
                return False
        except Exception as e:
            print(f"❌ API check failed: {e}")
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='BTC Monitor Auto Update Service')
    parser.add_argument('--daemon', action='store_true', help='Run in daemon mode')
    parser.add_argument('--daily', help='Run daily at specified time (e.g., 08:00)')
    parser.add_argument('--interval', type=int, default=600, help='Update interval in seconds (daemon mode)')
    parser.add_argument('--check', action='store_true', help='Check API connectivity')
    parser.add_argument('--build-history', type=int, nargs='?', const=0, metavar='DAYS',
                        help='Build full history. Use --build-history (all history) or --build-history N (last N days)')
    
    args = parser.parse_args()
    
    service = AutoUpdateService()
    
    if args.check:
        service.check_api()
    elif args.build_history is not None:
        success = service.build_full_history(days=args.build_history)
        sys.exit(0 if success else 1)
    elif args.daemon:
        service.run_daemon(args.interval)
    elif args.daily:
        service.run_daily(args.daily)
    else:
        # Single update
        success = service.update_data()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
