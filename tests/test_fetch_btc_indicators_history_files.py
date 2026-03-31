import unittest

import pandas as pd

from fetch_btc_indicators_history_files import (
    build_latest_json,
    build_light_history_json,
    dataframe_to_history_json,
    enrich_for_frontend,
)


class FetchHistoryPipelineTests(unittest.TestCase):
    def build_base_df(self) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
                "btc_price": [100.0, 95.0, 80.0],
                "ma200w": [120.0, 120.0, 120.0],
                "realized_price": [130.0, None, 90.0],
                "reserve_risk": [0.0030, 0.0020, 0.0010],
                "lth_mvrv": [1.05, 0.98, 0.88],
                "mvrv_zscore": [0.2, -0.1, -0.8],
                "sth_sopr": [1.05, None, 0.96],
                "sth_mvrv": [1.10, 0.95, None],
                "puell_multiple": [0.6, None, 0.4],
            }
        )

    def test_enrich_forward_fill_and_signal_count(self) -> None:
        enriched, thresholds = enrich_for_frontend(self.build_base_df())

        self.assertIn("reserveRisk", thresholds)
        self.assertEqual(str(thresholds["reserveRisk"]["method"]), "rolling_quantile_no_lookahead")
        self.assertEqual(str(thresholds["sthSopr"]["method"]), "rolling_quantile_no_lookahead")
        self.assertAlmostEqual(float(enriched.iloc[1]["realized_price"]), 130.0)
        self.assertAlmostEqual(float(enriched.iloc[2]["sth_mvrv"]), 0.95)

        # realized price on 2024-01-02 is forward-filled from 2024-01-01
        self.assertEqual(enriched.iloc[1]["realized_price_date"].strftime("%Y-%m-%d"), "2024-01-01")
        # sth_sopr on 2024-01-02 is forward-filled from 2024-01-01
        self.assertEqual(enriched.iloc[1]["sth_sopr_date"].strftime("%Y-%m-%d"), "2024-01-01")

        self.assertEqual(int(enriched.iloc[1]["signal_count"]), 3)
        self.assertEqual(int(enriched.iloc[2]["signal_count"]), 5)
        self.assertEqual(int(enriched.iloc[2]["signal_score_v2"]), 10)
        self.assertEqual(int(enriched.iloc[2]["score_sth_group"]), 2)
        self.assertTrue(bool(enriched.iloc[2]["signal_sth_group"]))

    def test_history_json_contains_expected_fields(self) -> None:
        enriched, _ = enrich_for_frontend(self.build_base_df())
        history = dataframe_to_history_json(enriched)

        self.assertEqual(len(history), 3)
        last = history[-1]
        self.assertEqual(last["d"], "2024-01-03")
        self.assertEqual(last["signalCount"], 5)
        self.assertIn("signalScoreV2", last)
        self.assertEqual(last["scoreSthGroup"], 2)
        self.assertTrue(last["signalSthGroup"])
        self.assertIsInstance(last["unixTs"], int)
        self.assertIn("api_data_date", last)
        self.assertEqual(last["api_data_date"]["sth_mvrv"], "2024-01-02")
        self.assertEqual(last["api_data_date"]["price_realized"], "2024-01-03")

    def test_build_latest_json_uses_latest_row(self) -> None:
        enriched, thresholds = enrich_for_frontend(self.build_base_df())
        latest = build_latest_json(enriched, thresholds=thresholds)

        self.assertEqual(latest["date"], "2024-01-03")
        self.assertEqual(latest["signalCount"], 5)
        self.assertEqual(int(latest["signalScoreV2"]), 10)
        self.assertTrue(latest["signals"]["priceMa200w"])
        self.assertTrue(latest["signals"]["priceRealized"])
        self.assertTrue(latest["signals"]["sthMvrv"])
        self.assertTrue(latest["signals"]["sthGroup"])
        self.assertEqual(int(latest["scoreSthGroup"]), 2)
        self.assertEqual(latest["indicatorDates"]["sthMvrv"], "2024-01-02")
        self.assertEqual(latest["indicatorDates"]["priceRealized"], "2024-01-03")

    def test_build_light_history_json_filters_old_rows(self) -> None:
        history = [
            {"d": "2021-01-01", "signalCount": 0},
            {"d": "2023-06-01", "signalCount": 1},
            {"d": "2024-01-01", "signalCount": 2},
        ]
        light = build_light_history_json(history, years=1)

        self.assertEqual([row["d"] for row in light], ["2023-06-01", "2024-01-01"])

    def test_reserve_risk_auto_excluded_when_stale(self) -> None:
        base = self.build_base_df().copy()
        base["reserve_risk"] = [0.003, None, None]

        enriched, _ = enrich_for_frontend(base, reserve_risk_disable_lag_days=1)
        history = dataframe_to_history_json(enriched)
        latest = history[-1]

        self.assertFalse(bool(latest["reserveRiskActive"]))
        self.assertTrue(bool(latest["reserveRiskReplacementActive"]))
        self.assertEqual(str(latest["reserveRiskSourceMode"]), "replacement")
        self.assertEqual(int(latest["activeIndicatorCount"]), 5)
        self.assertEqual(int(latest["maxSignalScoreV2"]), 10)
        self.assertEqual(int(latest["scoreReserveRisk"]), 2)

    def test_reserve_risk_stale_without_replacement_reduces_dimensions(self) -> None:
        base = self.build_base_df().copy()
        base["reserve_risk"] = [0.003, None, None]
        base["lth_mvrv"] = [None, None, None]
        base["mvrv_zscore"] = [None, None, None]

        enriched, _ = enrich_for_frontend(base, reserve_risk_disable_lag_days=1)
        history = dataframe_to_history_json(enriched)
        latest = history[-1]

        self.assertFalse(bool(latest["reserveRiskActive"]))
        self.assertFalse(bool(latest["reserveRiskReplacementActive"]))
        self.assertEqual(str(latest["reserveRiskSourceMode"]), "inactive")
        self.assertEqual(int(latest["activeIndicatorCount"]), 4)
        self.assertEqual(int(latest["maxSignalScoreV2"]), 8)
        self.assertEqual(int(latest["scoreReserveRisk"]), 0)


if __name__ == "__main__":
    unittest.main()
