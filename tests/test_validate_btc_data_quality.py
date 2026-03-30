import unittest

from validate_btc_data_quality import validate_current_pair


class ValidateDataQualityTests(unittest.TestCase):
    def build_history(self):
        return [
            {
                "d": "2026-03-27",
                "priceMa200wRatio": 0.95,
                "priceRealizedRatio": 0.98,
                "reserveRisk": 0.0012,
                "sthSopr": 0.98,
                "sthMvrv": 0.95,
                "puellMultiple": 0.4,
                "signalPriceMa200w": True,
                "signalPriceRealized": True,
                "signalReserveRisk": True,
                "signalSthSopr": True,
                "signalSthMvrv": True,
                "signalPuell": True,
                "signalCount": 6,
                "api_data_date": {
                    "price_ma200w": "2026-03-27",
                    "price_realized": "2026-03-27",
                    "reserve_risk": "2026-03-27",
                    "sth_sopr": "2026-03-27",
                    "sth_mvrv": "2026-03-27",
                    "puell": "2026-03-27",
                },
            },
            {
                "d": "2026-03-28",
                "priceMa200wRatio": 0.96,
                "priceRealizedRatio": 0.97,
                "reserveRisk": 0.0011,
                "sthSopr": 0.97,
                "sthMvrv": 0.92,
                "puellMultiple": 0.45,
                "signalPriceMa200w": True,
                "signalPriceRealized": True,
                "signalReserveRisk": True,
                "signalSthSopr": True,
                "signalSthMvrv": True,
                "signalPuell": True,
                "signalCount": 6,
                "api_data_date": {
                    "price_ma200w": "2026-03-28",
                    "price_realized": "2026-03-28",
                    "reserve_risk": "2026-03-28",
                    "sth_sopr": "2026-03-28",
                    "sth_mvrv": "2026-03-28",
                    "puell": "2026-03-28",
                },
            },
        ]

    def build_latest(self):
        return {
            "date": "2026-03-28",
            "priceMa200wRatio": 0.96,
            "priceRealizedRatio": 0.97,
            "reserveRisk": 0.0011,
            "sthSopr": 0.97,
            "sthMvrv": 0.92,
            "puellMultiple": 0.45,
            "signalCount": 6,
            "signals": {
                "priceMa200w": True,
                "priceRealized": True,
                "reserveRisk": True,
                "sthSopr": True,
                "sthMvrv": True,
                "puell": True,
            },
            "indicatorDates": {
                "priceMa200w": "2026-03-28",
                "priceRealized": "2026-03-28",
                "reserveRisk": "2026-03-28",
                "sthSopr": "2026-03-28",
                "sthMvrv": "2026-03-28",
                "puell": "2026-03-28",
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
        latest["indicatorDates"]["sthSopr"] = "2026-02-20"

        ok, errors = validate_current_pair(
            self.build_history(),
            latest,
            lookback_rows=30,
            max_indicator_lag_days=7,
        )

        self.assertFalse(ok)
        self.assertTrue(any("stale" in error and "sthSopr" in error for error in errors))

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
