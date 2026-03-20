"""
Data Validation Service - Consolidated from multiple validation scripts
Validates data consistency and integrity
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.core.data_updater import DataUpdater
from src.core.indicator_calculator import IndicatorCalculator
from src.core.api_client import APIClient


class DataValidator:
    """Validates data consistency and integrity"""
    
    def __init__(self):
        self.data_updater = DataUpdater()
        self.indicator_calculator = IndicatorCalculator()
        self.api_client = APIClient()
    
    def load_data_files(self) -> Tuple[Optional[List[Dict]], Optional[Dict]]:
        """Load history and latest data files"""
        history_data = self.data_updater.load_history_data()
        latest_data = self.data_updater.load_latest_data()
        
        return history_data, latest_data
    
    def validate_data_consistency(self) -> Dict[str, Any]:
        """Validate consistency between history and latest files"""
        history_data, latest_data = self.load_data_files()
        
        result = {
            'status': 'success',
            'issues': [],
            'summary': {}
        }
        
        if not history_data:
            result['issues'].append("History file is empty or missing")
            result['status'] = 'error'
            return result
        
        if not latest_data:
            result['issues'].append("Latest file is empty or missing")
            result['status'] = 'error'
            return result
        
        # Check if latest date matches last history date
        last_history = history_data[-1]
        history_date = last_history.get('d')
        latest_date = latest_data.get('d')
        
        if history_date != latest_date:
            result['issues'].append(f"Date mismatch: history={history_date}, latest={latest_date}")
        
        # Check data consistency
        fields_to_check = ['btcPrice', 'mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl']
        
        for field in fields_to_check:
            history_value = last_history.get(field)
            latest_value = latest_data.get(field)
            
            if history_value != latest_value:
                result['issues'].append(f"Field mismatch {field}: history={history_value}, latest={latest_value}")
        
        # Check signal consistency
        history_signals = self.indicator_calculator.calculate_signals(last_history)
        latest_signals = latest_data.get('signal_count')
        
        if history_signals['signal_count'] != latest_signals:
            result['issues'].append(f"Signal count mismatch: calculated={history_signals['signal_count']}, latest={latest_signals}")
        
        result['summary'] = {
            'history_records': len(history_data),
            'latest_date': latest_date,
            'issues_found': len(result['issues'])
        }
        
        if result['issues']:
            result['status'] = 'warning'
        
        return result
    
    def validate_api_data_consistency(self) -> Dict[str, Any]:
        """Compare local data with live API data"""
        print("Fetching live API data...")
        
        try:
            api_data = self.api_client.get_all_indicators()
        except Exception as e:
            return {
                'status': 'error',
                'message': f"Failed to fetch API data: {e}"
            }
        
        _, latest_data = self.load_data_files()
        
        if not latest_data:
            return {
                'status': 'error',
                'message': "No local data to compare"
            }
        
        result = {
            'status': 'success',
            'comparisons': [],
            'summary': {}
        }
        
        field_mapping = {
            'btc-price': 'btcPrice',
            'mvrv-zscore': 'mvrvZscore',
            'lth-mvrv': 'lthMvrv',
            'puell-multiple': 'puellMultiple',
            'nupl': 'nupl'
        }
        
        for api_indicator, field_name in field_mapping.items():
            api_values = api_data.get(api_indicator, [])
            local_value = latest_data.get(field_name)
            
            if api_values:
                api_value = api_values[0].get(field_name)
                
                comparison = {
                    'indicator': api_indicator,
                    'field': field_name,
                    'local_value': local_value,
                    'api_value': api_value,
                    'match': local_value == api_value
                }
                
                result['comparisons'].append(comparison)
        
        matches = sum(1 for comp in result['comparisons'] if comp['match'])
        result['summary'] = {
            'total_indicators': len(result['comparisons']),
            'matches': matches,
            'mismatches': len(result['comparisons']) - matches
        }
        
        if result['summary']['mismatches'] > 0:
            result['status'] = 'warning'
        
        return result
    
    def check_data_completeness(self) -> Dict[str, Any]:
        """Check for missing or incomplete data"""
        history_data, _ = self.load_data_files()
        
        if not history_data:
            return {
                'status': 'error',
                'message': "No history data found"
            }
        
        result = {
            'status': 'success',
            'completeness': {},
            'summary': {}
        }
        
        total_records = len(history_data)
        fields_to_check = ['btcPrice', 'mvrvZscore', 'lthMvrv', 'puellMultiple', 'nupl']
        
        for field in fields_to_check:
            missing_count = sum(1 for record in history_data if record.get(field) is None)
            completeness = ((total_records - missing_count) / total_records) * 100 if total_records > 0 else 0
            
            result['completeness'][field] = {
                'total_records': total_records,
                'missing_records': missing_count,
                'completeness_percentage': round(completeness, 2)
            }
        
        # Calculate overall completeness
        avg_completeness = sum(
            comp['completeness_percentage'] for comp in result['completeness'].values()
        ) / len(fields_to_check)
        
        result['summary'] = {
            'total_records': total_records,
            'average_completeness': round(avg_completeness, 2),
            'fields_checked': len(fields_to_check)
        }
        
        if avg_completeness < 90:
            result['status'] = 'warning'
        
        return result
    
    def run_full_validation(self) -> Dict[str, Any]:
        """Run all validation checks"""
        print("Running full data validation...")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'checks': {}
        }
        
        # Data consistency check
        print("Checking data consistency...")
        results['checks']['consistency'] = self.validate_data_consistency()
        
        # API data comparison
        print("Comparing with API data...")
        results['checks']['api_comparison'] = self.validate_api_data_consistency()
        
        # Data completeness check
        print("Checking data completeness...")
        results['checks']['completeness'] = self.check_data_completeness()
        
        # Overall status
        error_count = sum(1 for check in results['checks'].values() if check.get('status') == 'error')
        warning_count = sum(1 for check in results['checks'].values() if check.get('status') == 'warning')
        
        if error_count > 0:
            results['overall_status'] = 'error'
        elif warning_count > 0:
            results['overall_status'] = 'warning'
        else:
            results['overall_status'] = 'success'
        
        results['summary'] = {
            'total_checks': len(results['checks']),
            'errors': error_count,
            'warnings': warning_count
        }
        
        return results
    
    def print_validation_report(self, results: Dict[str, Any]):
        """Print formatted validation report"""
        print("\n" + "="*60)
        print("DATA VALIDATION REPORT")
        print("="*60)
        print(f"Timestamp: {results['timestamp']}")
        print(f"Overall Status: {results['overall_status'].upper()}")
        print(f"Summary: {results['summary']['errors']} errors, {results['summary']['warnings']} warnings")
        print()
        
        for check_name, check_result in results['checks'].items():
            print(f"--- {check_name.upper()} ---")
            print(f"Status: {check_result.get('status', 'unknown').upper()}")
            
            if 'message' in check_result:
                print(f"Message: {check_result['message']}")
            
            if 'issues' in check_result and check_result['issues']:
                print("Issues:")
                for issue in check_result['issues']:
                    print(f"  - {issue}")
            
            if 'summary' in check_result:
                print("Summary:", check_result['summary'])
            
            print()


def main():
    """Main entry point for validation"""
    validator = DataValidator()
    results = validator.run_full_validation()
    validator.print_validation_report(results)
    
    # Exit with error code if validation failed
    if results['overall_status'] == 'error':
        sys.exit(1)


if __name__ == "__main__":
    main()
