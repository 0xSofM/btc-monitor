import unittest

from validate_btc_data_quality import validate_current_pair


class ValidateDataQualityTests(unittest.TestCase):
    def build_history(self):
        return [
            {
                "d": "2026-03-27",
                "priceMa200wRatio": 0.95,
                "mvrvZscore": -0.2,
                "lthMvrv": 0.9,
                "puellMultiple": 0.4,
                "nupl": -0.1,
                "signalPriceMa": True,
                "signalMvrvZ": True,
                "signalLthMvrv": True,
                "signalPuell": True,
                "signalNupl": True,
                "signalCount": 5,
                "api_data_date": {
                    "price_ma200w": "2026-03-27",
                    "mvrv_z": "2026-03-27",
                    "lth_mvrv": "2026-03-27",
                    "puell": "2026-03-27",
                    "nupl": "2026-03-27",
                },
            },
            {
                "d": "2026-03-28",
                "priceMa200wRatio": 0.96,
                "mvrvZscore": -0.1,
                "lthMvrv": 0.95,
                "puellMultiple": 0.45,
                "nupl": -0.05,
                "signalPriceMa": True,
                "signalMvrvZ": True,
                "signalLthMvrv": True,
                "signalPuell": True,
                "signalNupl": True,
                "signalCount": 5,
                "api_data_date": {
                    "price_ma200w": "2026-03-28",
                    "mvrv_z": "2026-03-28",
                    "lth_mvrv": "2026-03-28",
                    "puell": "2026-03-28",
                    "nupl": "2026-03-28",
                },
            },
        ]

    def build_latest(self):
        return {
            "date": "2026-03-28",
            "priceMa200wRatio": 0.96,
            "mvrvZscore": -0.1,
            "lthMvrv": 0.95,
            "puellMultiple": 0.45,
            "nupl": -0.05,
            "signalCount": 5,
            "signals": {
                "priceMa200w": True,
                "mvrvZ": True,
                "lthMvrv": True,
                "puell": True,
                "nupl": True,
            },
            "indicatorDates": {
                "priceMa200w": "2026-03-28",
                "mvrvZ": "2026-03-28",
                "lthMvrv": "2026-03-28",
                "puell": "2026-03-28",
                "nupl": "2026-03-28",
            },
        }

    def test_validate_current_pair_passes_with_recent_indicator_dates(self):
        ok, errors = validate_current_pair(
            self.build_history(),
            self.build_latest(),
            lookback_rows=30,
            max_indicator_lag_days=7,
        )

        self.assertTrue(ok)
        self.assertEqual(errors, [])

    def test_validate_current_pair_fails_when_indicator_dates_are_stale(self):
        latest = self.build_latest()
        latest["indicatorDates"]["mvrvZ"] = "2026-02-20"

        ok, errors = validate_current_pair(
            self.build_history(),
            latest,
            lookback_rows=30,
            max_indicator_lag_days=7,
        )

        self.assertFalse(ok)
        self.assertTrue(any("stale" in error and "mvrvZ" in error for error in errors))

    def test_validate_current_pair_uses_history_api_data_date_as_fallback(self):
        latest = self.build_latest()
        latest.pop("indicatorDates")

        ok, errors = validate_current_pair(
            self.build_history(),
            latest,
            lookback_rows=30,
            max_indicator_lag_days=7,
        )

        self.assertTrue(ok)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
