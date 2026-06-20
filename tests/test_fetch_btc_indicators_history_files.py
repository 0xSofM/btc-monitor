import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd

from fetch_btc_indicators_history_files import (
    _classify_score_band,
    archive_existing_outputs,
    build_light_history_json,
    build_manifest_json,
    build_reserve_risk_source_diagnostics,
    build_signal_events_v4_json,
    build_latest_json,
    dataframe_to_history_json,
    enrich_for_frontend,
    merge_reserve_risk_history_sources,
    patch_reserve_risk_tail,
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
                "lth_sopr": [0.99, 0.97, 1.02],
                "mvrv_zscore": [0.2, -0.1, -0.8],
                "nupl": [0.35, 0.20, -0.10],
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
        self.assertAlmostEqual(float(enriched.iloc[2]["sth_mvrv_trigger"]), 1.0)
        self.assertAlmostEqual(float(enriched.iloc[2]["sth_mvrv_deep"]), 0.85)

        # realized price on 2024-01-02 is forward-filled from 2024-01-01
        self.assertEqual(enriched.iloc[1]["realized_price_date"].strftime("%Y-%m-%d"), "2024-01-01")
        # sth_sopr on 2024-01-02 is forward-filled from 2024-01-01
        self.assertEqual(enriched.iloc[1]["sth_sopr_date"].strftime("%Y-%m-%d"), "2024-01-01")

        self.assertEqual(int(enriched.iloc[1]["signal_count"]), 3)
        self.assertEqual(int(enriched.iloc[2]["signal_count"]), 5)
        self.assertAlmostEqual(float(enriched.iloc[2]["sth_sopr_ma3"]), 1.02)
        self.assertAlmostEqual(float(enriched.iloc[2]["lth_sopr_ma3"]), 0.9933333333333333)
        self.assertEqual(int(enriched.iloc[2]["signal_score_v2"]), 9)
        self.assertEqual(int(enriched.iloc[2]["score_sth_group"]), 1)
        self.assertTrue(bool(enriched.iloc[2]["signal_sth_group"]))
        self.assertEqual(int(enriched.iloc[2]["signal_count_v4"]), 6)
        self.assertEqual(int(enriched.iloc[2]["active_indicator_count_v4"]), 7)
        self.assertEqual(int(enriched.iloc[2]["total_score_v4"]), 11)
        self.assertEqual(str(enriched.iloc[2]["signal_band_v4"]), "accumulate")
        self.assertAlmostEqual(float(enriched.iloc[2]["signal_confidence"]), 0.6875)
        self.assertEqual(enriched.iloc[2]["nupl_date"].strftime("%Y-%m-%d"), "2024-01-03")
        self.assertEqual(int(enriched.iloc[2]["score_nupl_core"]), 2)
        self.assertEqual(int(enriched.iloc[2]["valuation_blend_score_v6"]), 2)
        self.assertEqual(int(enriched.iloc[2]["signal_count_v6"]), 6)
        self.assertEqual(int(enriched.iloc[2]["active_indicator_count_v6"]), 8)
        self.assertEqual(int(enriched.iloc[2]["total_score_v6"]), 11)
        self.assertEqual(str(enriched.iloc[2]["signal_band_v6"]), "accumulate")
        self.assertAlmostEqual(float(enriched.iloc[2]["signal_confidence_v6"]), 0.6875)

    def test_history_json_contains_expected_fields(self) -> None:
        enriched, _ = enrich_for_frontend(self.build_base_df())
        history = dataframe_to_history_json(enriched)

        self.assertEqual(len(history), 3)
        last = history[-1]
        self.assertEqual(last["d"], "2024-01-03")
        self.assertEqual(last["signalCount"], 5)
        self.assertIn("signalScoreV2", last)
        self.assertAlmostEqual(float(last["sthSoprMa3"]), 1.02)
        self.assertAlmostEqual(float(last["lthSoprMa3"]), 0.9933333333333333)
        self.assertEqual(last["scoreSthGroup"], 1)
        self.assertTrue(last["signalSthGroup"])
        self.assertIsInstance(last["unixTs"], int)
        self.assertIn("api_data_date", last)
        self.assertEqual(last["api_data_date"]["sth_mvrv"], "2024-01-02")
        self.assertEqual(last["api_data_date"]["price_realized"], "2024-01-03")
        self.assertIn("thresholds", last)
        self.assertAlmostEqual(float(last["thresholds"]["sthMvrv"]["trigger"]), 1.0)
        self.assertAlmostEqual(float(last["thresholds"]["sthMvrv"]["deep"]), 0.85)
        self.assertIn("lthSopr", last["thresholds"])
        self.assertAlmostEqual(float(last["thresholds"]["lthSopr"]["trigger"]), 0.9)
        self.assertAlmostEqual(float(last["thresholds"]["lthSopr"]["deep"]), 0.75)
        self.assertEqual(last["signalCountV4"], 6)
        self.assertEqual(last["activeIndicatorCountV4"], 7)
        self.assertEqual(last["totalScoreV4"], 11)
        self.assertTrue(last["signalMvrvZscoreCore"])
        self.assertEqual(int(last["scoreMvrvZscoreCore"]), 2)
        self.assertAlmostEqual(float(last["nupl"]), -0.1)
        self.assertTrue(last["signalNuplCore"])
        self.assertEqual(int(last["scoreNuplCore"]), 2)
        self.assertEqual(last["signalCountV6"], 6)
        self.assertEqual(last["activeIndicatorCountV6"], 8)
        self.assertEqual(last["valuationBlendScoreV6"], 2)
        self.assertEqual(last["totalScoreV6"], 11)
        self.assertTrue(last["signalsV6"]["nupl"])
        self.assertTrue(last["signalsV6"]["valuationBlend"])
        self.assertEqual(last["indicatorDates"]["nupl"], "2024-01-03")
        self.assertTrue(last["signalLthMvrv"])
        self.assertEqual(last["indicatorDates"]["lthMvrv"], "2024-01-03")

    def test_light_history_keeps_recent_rows_and_compacts_fields(self) -> None:
        history = [
            {
                "d": f"2024-01-{day:02d}",
                "unixTs": 1704067200 + (day * 86400),
                "btcPrice": 100 + day,
                "priceMa200wRatio": 1.0,
                "signalCountV6": day % 8,
                "reserveRiskDiagnostics": {"debug": True},
                "raw": "debug",
            }
            for day in range(1, 13)
        ]
        history.extend(
            [
                {
                    "d": f"2025-01-{day:02d}",
                    "unixTs": 1735689600 + (day * 86400),
                    "btcPrice": 200 + day,
                    "priceMa200wRatio": 1.1,
                    "signalCountV6": day % 8,
                    "indicatorDates": {"priceMa200w": f"2025-01-{day:02d}"},
                }
                for day in range(1, 6)
            ]
        )

        light = build_light_history_json(history, recent_days=3)

        self.assertLess(len(light), len(history))
        self.assertEqual(light[0]["d"], "2024-01-01")
        self.assertEqual(light[-1]["d"], "2025-01-05")
        self.assertTrue(any(row["d"] == "2025-01-03" for row in light))
        self.assertNotIn("reserveRiskDiagnostics", light[0])
        self.assertNotIn("raw", light[0])
        self.assertIn("signalCountV6", light[-1])

    def test_build_latest_json_uses_latest_row(self) -> None:
        enriched, thresholds = enrich_for_frontend(self.build_base_df())
        latest = build_latest_json(enriched, thresholds=thresholds)

        self.assertEqual(latest["date"], "2024-01-03")
        self.assertEqual(latest["signalCount"], 5)
        self.assertEqual(int(latest["signalScoreV2"]), 9)
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
        self.assertAlmostEqual(float(latest["sthSoprMa3"]), 1.02)
        self.assertAlmostEqual(float(latest["lthSoprMa3"]), 0.9933333333333333)
        self.assertEqual(int(latest["scoreSthGroup"]), 1)
        self.assertEqual(latest["indicatorDates"]["sthMvrv"], "2024-01-02")
        self.assertEqual(latest["indicatorDates"]["priceRealized"], "2024-01-03")
        self.assertEqual(latest["indicatorDates"]["lthMvrv"], "2024-01-03")
        self.assertEqual(latest["indicatorDates"]["lthSopr"], "2024-01-03")
        self.assertEqual(int(latest["signalCountV4"]), 6)
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 7)
        self.assertEqual(int(latest["totalScoreV4"]), 11)
        self.assertEqual(int(latest["signalCountV6"]), 6)
        self.assertEqual(int(latest["activeIndicatorCountV6"]), 8)
        self.assertEqual(int(latest["valuationBlendScoreV6"]), 2)
        self.assertEqual(int(latest["totalScoreV6"]), 11)
        self.assertTrue(bool(latest["signalsV4"]["mvrvZscore"]))
        self.assertTrue(bool(latest["signalsV6"]["nupl"]))
        self.assertTrue(bool(latest["signalsV6"]["valuationBlend"]))
        self.assertTrue(bool(latest["signalMvrvZscoreCore"]))
        self.assertTrue(bool(latest["signalNuplCore"]))
        self.assertTrue(bool(latest["signalsV4"]["lthMvrv"]))
        self.assertFalse(bool(latest["signalsV4"]["lthSopr"]))
        self.assertEqual(str(latest["indicatorDates"]["nupl"]), "2024-01-03")
        self.assertEqual(str(latest["scoringModelVersion"]), "core8_independent_valuation_current")
        self.assertEqual(str(latest["legacyScoringModelVersion"]), "v3_no_lookahead_replacement")
        self.assertEqual(str(latest["canonical"]["model"]), "core8_independent_valuation")
        self.assertEqual(
            latest["canonical"]["displayIndicators"],
            [
                "priceMa200w",
                "mvrvZscore",
                "nupl",
                "puell",
                "sthMvrv",
                "sthSopr",
                "lthMvrv",
                "lthSopr",
            ],
        )
        self.assertNotIn("priceRealized", latest["canonical"]["signals"])
        self.assertNotIn("valuationBlend", latest["canonical"]["signals"])
        self.assertIn("reserveRiskDiagnostics", latest)

    def test_manifest_includes_light_history_and_data_health_contract(self) -> None:
        enriched, thresholds = enrich_for_frontend(self.build_base_df())
        history = dataframe_to_history_json(enriched)
        light = build_light_history_json(history)
        latest = build_latest_json(enriched, thresholds=thresholds)

        manifest = build_manifest_json(
            latest_json=latest,
            history_rows=len(history),
            history_light_rows=len(light),
            thresholds=thresholds,
        )

        self.assertEqual(manifest["historyRows"], len(history))
        self.assertEqual(manifest["historyLightRows"], len(light))
        self.assertEqual(manifest["historyFiles"]["light"], "btc_indicators_history_light.json")
        self.assertIn("historyRequiredFields", manifest["schemaContract"])
        self.assertEqual(manifest["schemaContract"]["canonicalModel"], "core8_independent_valuation")
        self.assertEqual(len(manifest["schemaContract"]["displayIndicators"]), 8)
        self.assertIn("reserveRisk", manifest["schemaContract"]["compatibilityFields"])
        self.assertIn("indicatorLagDays", manifest["dataHealth"])

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
        self.assertFalse(bool(latest["reserveRiskSoftFallbackActive"]))
        self.assertEqual(str(latest["reserveRiskSourceModeV4"]), "compat_mvrv_zscore")
        self.assertEqual(int(latest["scoreReserveRiskV4"]), 2)
        self.assertEqual(int(latest["scoreMvrvZscoreCore"]), 2)
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 7)
        self.assertEqual(int(latest["maxTotalScoreV4"]), 14)
        self.assertEqual(int(latest["activeIndicatorCountV6"]), 8)
        self.assertEqual(int(latest["maxTotalScoreV6"]), 14)

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
        self.assertEqual(int(latest["activeIndicatorCountV4"]), 6)
        self.assertEqual(int(latest["maxTotalScoreV4"]), 12)
        self.assertEqual(str(latest["fallbackMode"]), "mvrv_zscore_inactive")
        self.assertEqual(str(latest["fallbackModeV6"]), "none")
        self.assertEqual(int(latest["activeIndicatorCountV6"]), 8)
        self.assertEqual(int(latest["maxTotalScoreV6"]), 14)

    def test_patch_reserve_risk_tail_prefers_freshest_point_source(self) -> None:
        reserve_df = pd.DataFrame(
            {
                "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
                "reserve_risk": [0.003, None],
            }
        )
        point_candidates = {
            "older_source": {
                "key": "older_source",
                "displayName": "Older Source",
                "mode": "point",
                "priority": 1,
                "available": True,
                "selectedUrl": "https://example.com/older",
                "date": pd.Timestamp("2024-01-02"),
                "value": 0.0025,
            },
            "fresher_source": {
                "key": "fresher_source",
                "displayName": "Fresher Source",
                "mode": "point",
                "priority": 2,
                "available": True,
                "selectedUrl": "https://example.com/fresher",
                "date": pd.Timestamp("2024-01-03"),
                "value": 0.0020,
            },
        }

        patched, patch_info = patch_reserve_risk_tail(
            reserve_df, point_candidates=point_candidates
        )

        self.assertIsNotNone(patch_info)
        assert patch_info is not None
        self.assertEqual(str(patch_info["key"]), "fresher_source")
        self.assertEqual(patched.iloc[-1]["date"].strftime("%Y-%m-%d"), "2024-01-03")
        self.assertAlmostEqual(float(patched.iloc[-1]["reserve_risk"]), 0.0020)

    def test_patch_reserve_risk_tail_skips_identical_same_day_value(self) -> None:
        reserve_df = pd.DataFrame(
            {
                "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
                "reserve_risk": [0.003, 0.002],
            }
        )
        point_candidates = {
            "bitcoin_data_latest": {
                "key": "bitcoin_data_latest",
                "displayName": "bitcoin-data Reserve Risk latest",
                "mode": "point",
                "priority": 1,
                "available": True,
                "selectedUrl": "https://bitcoin-data.com/v1/reserve-risk/1",
                "date": pd.Timestamp("2024-01-02"),
                "value": 0.002,
            }
        }

        patched, patch_info = patch_reserve_risk_tail(
            reserve_df, point_candidates=point_candidates
        )

        self.assertIsNone(patch_info)
        self.assertEqual(len(patched), 2)
        self.assertAlmostEqual(float(patched.iloc[-1]["reserve_risk"]), 0.002)

    def test_merge_reserve_risk_history_sources_prefers_recent_non_null_values(self) -> None:
        legacy_df = pd.DataFrame(
            {
                "date": pd.to_datetime(["2022-04-14", "2022-04-15", "2022-04-16"]),
                "reserve_risk": [0.0025, 0.0024, 0.0023],
            }
        )
        recent_df = pd.DataFrame(
            {
                "date": pd.to_datetime(["2022-04-16", "2022-04-17", "2022-04-18"]),
                "reserve_risk": [0.0019, 0.0018, 0.0017],
            }
        )

        merged = merge_reserve_risk_history_sources(legacy_df, recent_df)

        self.assertEqual(
            [value.strftime("%Y-%m-%d") for value in merged["date"]],
            ["2022-04-14", "2022-04-15", "2022-04-16", "2022-04-17", "2022-04-18"],
        )
        self.assertAlmostEqual(float(merged.iloc[2]["reserve_risk"]), 0.0019)

    def test_reserve_risk_diagnostics_report_null_tail_and_shadow_status(self) -> None:
        reserve_df = pd.DataFrame(
            {
                "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
                "reserve_risk": [0.003, None, None],
            }
        )
        point_candidates = {
            "bitcoin_data_latest": {
                "key": "bitcoin_data_latest",
                "displayName": "bitcoin-data Reserve Risk latest",
                "mode": "point",
                "priority": 1,
                "available": True,
                "selectedUrl": "https://bitcoin-data.com/v1/reserve-risk/1",
                "date": pd.Timestamp("2024-01-03"),
                "value": 0.0012,
            }
        }

        diagnostics = build_reserve_risk_source_diagnostics(
            primary_df=reserve_df,
            point_candidates=point_candidates,
            applied_point_source=point_candidates["bitcoin_data_latest"],
        )

        primary = diagnostics["primarySeries"]
        shadow = diagnostics["shadowCompare"]
        self.assertEqual(primary["healthStatus"], "null_tail")
        self.assertEqual(primary["latestNonNullDate"], "2024-01-01")
        self.assertEqual(int(primary["trailingNullDays"]), 2)
        self.assertEqual(shadow["candidateKey"], "bitcoin_data_latest")
        self.assertEqual(shadow["status"], "primary_same_day_missing")
        self.assertFalse(bool(shadow["sameDayComparable"]))

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
        self.assertEqual(events[0]["signalBandV4"], "accumulate")
        self.assertEqual(events[0]["maxTotalScoreV4"], 14)

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
