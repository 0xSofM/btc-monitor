"""
BTC Monitor Indicator Calculator
Calculates buy signals and indicator values
"""

import math
from typing import Dict, List, Any


class IndicatorCalculator:
    """Calculates BTC indicators and buy signals"""
    
    def __init__(self):
        self.signal_thresholds = {
            'price_200w_ma': 1.0,      # Price below 200-week MA
            'mvrv_zscore': 0.0,         # MVRV Z-Score below 0
            'lth_mvrv': 1.0,           # LTH-MVRV below 1
            'puell_multiple': 0.5,     # Puell Multiple below 0.5
            'nupl': 0.0                # NUPL below 0
        }
    
    def calculate_price_to_200w_ma(self, price: float, ma200w: float) -> float:
        """Calculate Price / 200-week MA ratio"""
        if ma200w == 0:
            return float('inf')
        return price / ma200w
    
    def calculate_signals(self, data_point: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate buy signals for a data point"""
        signals = {}
        
        # Extract values with fallbacks
        price = float(data_point.get('btcPrice', 0))
        mvrv_zscore = float(data_point.get('mvrvZscore', 0))
        lth_mvrv = float(data_point.get('lthMvrv', 0))
        puell_multiple = float(data_point.get('puellMultiple', 0))
        nupl = float(data_point.get('nupl', 0))
        ma200w = float(data_point.get('ma200w', 0))
        
        # Calculate individual signals
        signals['price_200w_ma_signal'] = (
            ma200w > 0 and self.calculate_price_to_200w_ma(price, ma200w) < self.signal_thresholds['price_200w_ma']
        )
        signals['mvrv_zscore_signal'] = mvrv_zscore < self.signal_thresholds['mvrv_zscore']
        signals['lth_mvrv_signal'] = lth_mvrv < self.signal_thresholds['lth_mvrv']
        signals['puell_multiple_signal'] = puell_multiple < self.signal_thresholds['puell_multiple']
        signals['nupl_signal'] = nupl < self.signal_thresholds['nupl']
        
        # Count total signals
        signal_count = sum(signals.values())
        signals['signal_count'] = signal_count
        signals['signal_strength'] = self._get_signal_strength(signal_count)
        
        return signals
    
    def _get_signal_strength(self, count: int) -> str:
        """Get signal strength description"""
        if count == 5:
            return "MAXIMUM"
        elif count >= 4:
            return "STRONG"
        elif count >= 3:
            return "MODERATE"
        elif count >= 2:
            return "WEAK"
        elif count >= 1:
            return "MINIMAL"
        else:
            return "NONE"
    
    def enrich_data_with_signals(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add signal calculations to all data points"""
        enriched_data = []
        
        for data_point in data:
            enriched_point = data_point.copy()
            signals = self.calculate_signals(data_point)
            enriched_point.update(signals)
            enriched_data.append(enriched_point)
            
        return enriched_data
    
    def get_signal_summary(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get summary statistics for signals in the dataset"""
        if not data:
            return {}
            
        total_days = len(data)
        signal_counts = {
            '5_signals': 0,
            '4_plus_signals': 0,
            '3_plus_signals': 0,
            '2_plus_signals': 0,
            '1_plus_signals': 0
        }
        
        max_signal_dates = []
        
        for data_point in data:
            signal_count = data_point.get('signal_count', 0)
            
            if signal_count == 5:
                signal_counts['5_signals'] += 1
                max_signal_dates.append(data_point.get('d', 'Unknown'))
            if signal_count >= 4:
                signal_counts['4_plus_signals'] += 1
            if signal_count >= 3:
                signal_counts['3_plus_signals'] += 1
            if signal_count >= 2:
                signal_counts['2_plus_signals'] += 1
            if signal_count >= 1:
                signal_counts['1_plus_signals'] += 1
        
        return {
            'total_days': total_days,
            'signal_statistics': signal_counts,
            'max_signal_dates': max_signal_dates[-5:],  # Last 5 maximum signal dates
            'last_max_signal_date': max_signal_dates[-1] if max_signal_dates else None
        }
