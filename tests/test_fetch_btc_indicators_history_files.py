import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd

from fetch_btc_indicators_history_files import (
    _classify_score_band,
    archive_existing_outputs,
    build_signal_events_v4_json,
    build_latest_json,
    build_light_history_json,
    dataframe_to_history_json,
    enrich_for_frontend,
    restore_outputs_from_archive,
    write_json,
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
        self.assertEqual(int(enriched.iloc[2]["signal_count_v4"]), 6)
        self.assertEqual(int(enriched.iloc[2]["active_indicator_count_v4"]), 6)
        self.assertEqual(int(enriched.iloc[2]["total_score_v4"]), 11)
        self.assertEqual(str(enriched.iloc[2]["signal_band_v4"]), "extreme_bottom")
        self.assertGreaterEqual(float(enriched.iloc[2]["signal_confidence"]), 0.8)

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
        self.assertEqual(last["signalCountV4"], 6)
        self.assertEqual(last["activeIndicatorCountV4"], 6)
        self.assertEqual(last["totalScoreV4"], 11)
        self.assertTrue(last["signalLthMvrv"])
        self.assertEqual(last["indicatorDates"]["lthMvrv"], "2024-01-03")

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
        self.assertIn("scorePriceMa200w", latest)
        self.assertIn("scorePriceRealized", latest)
        self.assertIn("scoreReserveRisk", latest)
        self.assertIn("scoreSthSopr", latest)
        self.assertIn("scoreSthMvrv", latest)
        self.assertIn("scorePuell", latest)
        self.assertEqual(int(latest["scoreSthGroup"]), 2)
        self.assertEqual(latest["indicatorDates"]["sthMvrv"], "2024-01-02")
        self.assertEqual(latest["indicatorDates"]["priceRealized"], "2024-01-03")
        self.assertEqual(latest["indicatorDates"]["lthMvrv"], "2024-01-03")
        self.assertEqual(int(latest["signalCountV4"]), 6)
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 6)
        self.assertEqual(int(latest["totalScoreV4"]), 11)
        self.assertTrue(bool(latest["signalsV4"]["lthMvrv"]))
        self.assertEqual(str(latest["scoringModelVersion"]), "v4_layered_core6")
        self.assertEqual(str(latest["legacyScoringModelVersion"]), "v3_no_lookahead_replacement")

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
        self.assertTrue(bool(latest["reserveRiskSoftFallbackActive"]))
        self.assertEqual(str(latest["reserveRiskSourceModeV4"]), "soft_fallback")
        self.assertEqual(int(latest["scoreReserveRiskV4"]), 1)
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 6)
        self.assertEqual(int(latest["maxTotalScoreV4"]), 11)

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
        self.assertFalse(bool(latest["reserveRiskSoftFallbackActive"]))
        self.assertEqual(str(latest["reserveRiskSourceModeV4"]), "inactive")
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 5)
        self.assertEqual(int(latest["maxTotalScoreV4"]), 10)

    def test_classify_score_band_handles_dynamic_gaps(self) -> None:
        self.assertEqual(_classify_score_band(8, 10), "accumulate")
        self.assertEqual(_classify_score_band(6, 8), "accumulate")
        self.assertEqual(_classify_score_band(7, 8), "extreme_bottom")

    def test_build_signal_events_v4_returns_confirmed_event_windows(self) -> None:
        enriched, _ = enrich_for_frontend(self.build_base_df())
        enriched.loc[:, "signal_confirmed_3d_v4"] = [False, False, True]
        events = build_signal_events_v4_json(enriched)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["startDate"], "2024-01-03")
        self.assertEqual(events[0]["signalBandV4"], "extreme_bottom")
        self.assertEqual(events[0]["maxTotalScoreV4"], 12)

    def test_archive_and_restore_outputs(self) -> None:
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            output_paths = {
                "latest": root / "btc_indicators_latest.json",
                "manifest": root / "btc_indicators_manifest.json",
            }
            write_json(output_paths["latest"], {"date": "2024-01-01", "value": 1})
            write_json(
                output_paths["manifest"],
                {"schemaVersion": "v3", "scoringModelVersion": "v3_no_lookahead_replacement"},
            )

            snapshot_dir = archive_existing_outputs(output_paths, root / "archive", "test")
            self.assertIsNotNone(snapshot_dir)
            self.assertTrue((snapshot_dir / "btc_indicators_latest.json").exists())

            write_json(output_paths["latest"], {"date": "2024-01-02", "value": 2})
            restored = restore_outputs_from_archive(snapshot_dir, output_paths)
            self.assertIn("latest", restored)
            self.assertIn("2024-01-01", Path(restored["latest"]).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
