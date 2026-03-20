"""
Auto Update Service - Consolidated from auto_update_service.py
Handles automatic data updates with scheduling and daemon mode
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
from src.core.api_client import APIClient


class AutoUpdateService:
    """Main auto-update service for BTC Monitor"""
    
    def __init__(self):
        self.data_updater = DataUpdater()
        self.indicator_calculator = IndicatorCalculator()
        self.api_client = APIClient()
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
        """Perform a single data update"""
        try:
            self.logger.info("Starting data update...")
            
            # Get all indicator data
            indicator_data = self.api_client.get_all_indicators()
            
            if not indicator_data:
                self.logger.error("Failed to fetch indicator data")
                return False
            
            # Process and combine data
            today = datetime.now().strftime('%Y-%m-%d')
            combined_data = {'d': today}
            
            # Extract latest values from each indicator
            for indicator, data in indicator_data.items():
                if data and len(data) > 0:
                    latest = data[0]  # API returns latest first
                    field_mapping = {
                        'btc-price': 'btcPrice',
                        'mvrv-zscore': 'mvrvZscore',
                        'lth-mvrv': 'lthMvrv',
                        'puell-multiple': 'puellMultiple',
                        'nupl': 'nupl'
                    }
                    
                    field_name = field_mapping.get(indicator)
                    if field_name and field_name in latest:
                        combined_data[field_name] = latest[field_name]
            
            # Load existing history
            history_data = self.data_updater.load_history_data()
            
            # Add signals to the new data point
            enriched_data = self.indicator_calculator.enrich_data_with_signals([combined_data])
            if enriched_data:
                combined_data = enriched_data[0]
            
            # Update history
            if history_data and history_data[-1].get('d') == today:
                # Update today's data
                history_data[-1] = combined_data
                self.logger.info("Updated today's data")
            else:
                # Add new day's data
                history_data.append(combined_data)
                self.logger.info("Added new day's data")
            
            # Save files
            success = (
                self.data_updater.save_history_data(history_data) and
                self.data_updater.save_latest_data(combined_data)
            )
            
            if success:
                signal_count = combined_data.get('signal_count', 0)
                self.logger.info(f"Update completed successfully. Signal count: {signal_count}")
            else:
                self.logger.error("Failed to save data files")
                
            return success
            
        except Exception as e:
            self.logger.error(f"Update failed: {e}")
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
        if self.api_client.check_api_status():
            print("✅ API is accessible")
            return True
        else:
            print("❌ API is not accessible")
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='BTC Monitor Auto Update Service')
    parser.add_argument('--daemon', action='store_true', help='Run in daemon mode')
    parser.add_argument('--daily', help='Run daily at specified time (e.g., 08:00)')
    parser.add_argument('--interval', type=int, default=600, help='Update interval in seconds (daemon mode)')
    parser.add_argument('--check', action='store_true', help='Check API connectivity')
    
    args = parser.parse_args()
    
    service = AutoUpdateService()
    
    if args.check:
        service.check_api()
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
