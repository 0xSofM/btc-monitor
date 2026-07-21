import unittest
from datetime import datetime, timezone

from pipeline.strategy_mnav import (
    build_strategy_mnav_snapshot,
    classify_mnav_band,
    merge_strategy_mnav_history,
    normalize_strategy_mnav_timeseries,
)
from validate_strategy_mnav import validate_strategy_mnav_pair


class StrategyMnavTests(unittest.TestCase):
    def bitcoin_payload(self):
        return {
            "timestamp": "2026-06-20T13:08:00",
            "results": {
                "latestPrice": 63576,
                "btcHoldings": "846,842",
                "btcNav": "53,839",
                "btcNavNumber": 53839,
                "prevBtcNav": "53,705",
                "satsPerShare": 219359.5681,
                "msTimestamp": 1781960901241,
            },
        }

    def mstr_payload(self):
        return [
            {
                "company": "MSTR",
                "price": "112.53",
                "sharesVolume": 35115068,
                "timeStampUtc": "2026-06-18T20:00:00",
                "marketCap": "40,097",
                "entVal": "61,225",
                "prevEntVal": "62,661",
                "debt": "6,754",
                "pref": "15,475",
                "debtPrefByMC": 55,
            }
        ]

    def test_build_strategy_mnav_snapshot_uses_official_ev_over_btc_reserve_formula(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )

        self.assertEqual(snapshot["source"], "strategy_official_api")
        self.assertEqual(snapshot["formula"], "enterpriseValueUsd / btcReserveUsd")
        self.assertAlmostEqual(snapshot["mnav"]["value"], 61225 / 53839, places=4)
        self.assertEqual(snapshot["mnav"]["band"], "low_premium")
        self.assertEqual(snapshot["btcReserve"]["btcHoldings"], 846842)
        self.assertEqual(snapshot["mstr"]["enterpriseValueUsdM"], 61225)

    def test_build_strategy_mnav_snapshot_accepts_direct_mstr_object(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload()[0],
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )

        self.assertEqual(snapshot["mstr"]["enterpriseValueUsdM"], 61225)
        self.assertAlmostEqual(snapshot["mnav"]["value"], 61225 / 53839, places=4)

    def test_normalize_strategy_mnav_timeseries_filters_and_sorts(self):
        history = normalize_strategy_mnav_timeseries(
            [
                {
                    "ticker": "MSTR",
                    "values": [
                        {"date": "2026-01-03T00:00:00", "mNav": None},
                        {"date": "2026-01-02T00:00:00", "mNav": 1.24},
                        {"date": "invalid", "mNav": 1.2},
                        {"date": "2026-01-01T00:00:00", "mNav": 0.98},
                    ],
                }
            ]
        )

        self.assertEqual([row["d"] for row in history], ["2026-01-01", "2026-01-02"])
        self.assertEqual(history[0]["mnavBand"], "discount")
        self.assertEqual(history[1]["mnavBand"], "low_premium")
        self.assertEqual(history[0]["source"], "strategy_official_timeseries")
        self.assertEqual(history[0]["observationType"], "official_daily_close")

    def test_merge_strategy_mnav_history_replaces_same_day_and_sorts(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )
        existing = [
            {"d": "2026-06-20", "mnav": 0.9},
            {"d": "2026-06-19", "mnav": 1.2},
        ]

        history = merge_strategy_mnav_history(existing, snapshot)

        self.assertEqual([row["d"] for row in history], ["2026-06-19", "2026-06-20"])
        self.assertAlmostEqual(history[-1]["mnav"], snapshot["mnav"]["value"])

    def test_merge_strategy_mnav_history_prefers_official_then_latest(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )
        existing = [
            {"d": "2026-06-18", "mnav": 1.3, "source": "existing"},
            {"d": "2026-06-19", "mnav": 1.2, "source": "existing"},
        ]
        official = [
            {"d": "2026-06-19", "mnav": 1.1, "source": "strategy_official_timeseries"},
            {"d": "2026-06-20", "mnav": 1.0, "source": "strategy_official_timeseries"},
        ]

        history = merge_strategy_mnav_history(existing, snapshot, official)

        self.assertEqual(
            [row["d"] for row in history],
            ["2026-06-18", "2026-06-19", "2026-06-20"],
        )
        self.assertEqual(history[1]["mnav"], 1.1)
        self.assertEqual(history[1]["source"], "strategy_official_timeseries")
        self.assertAlmostEqual(history[2]["mnav"], snapshot["mnav"]["value"])
        self.assertEqual(history[2]["source"], "strategy_official_api")

    def test_validate_strategy_mnav_pair_passes_for_fresh_snapshot(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )
        history = merge_strategy_mnav_history([], snapshot)

        ok, errors = validate_strategy_mnav_pair(
            snapshot,
            history,
            now=datetime(2026, 6, 20, 14, 0, tzinfo=timezone.utc),
        )

        self.assertTrue(ok)
        self.assertEqual(errors, [])

    def test_validate_strategy_mnav_pair_fails_on_formula_mismatch(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )
        snapshot["mnav"]["value"] = 9.0
        history = merge_strategy_mnav_history([], snapshot)

        ok, errors = validate_strategy_mnav_pair(
            snapshot,
            history,
            now=datetime(2026, 6, 20, 14, 0, tzinfo=timezone.utc),
        )

        self.assertFalse(ok)
        self.assertTrue(any("does not match EV/BTC reserve" in error for error in errors))

    def test_validate_strategy_mnav_pair_can_skip_freshness_for_checked_in_data(self):
        snapshot = build_strategy_mnav_snapshot(
            self.bitcoin_payload(),
            self.mstr_payload(),
            generated_at=datetime(2026, 6, 20, 13, 20, tzinfo=timezone.utc),
        )
        history = merge_strategy_mnav_history([], snapshot)

        ok, errors = validate_strategy_mnav_pair(
            snapshot,
            history,
            check_freshness=False,
            now=datetime(2026, 7, 20, 14, 0, tzinfo=timezone.utc),
        )

        self.assertTrue(ok)
        self.assertEqual(errors, [])

    def test_classify_mnav_band(self):
        self.assertEqual(classify_mnav_band(0.95), "discount")
        self.assertEqual(classify_mnav_band(1.1), "low_premium")
        self.assertEqual(classify_mnav_band(1.6), "normal_premium")
        self.assertEqual(classify_mnav_band(2.3), "elevated_premium")
        self.assertEqual(classify_mnav_band(3.2), "overheated")


if __name__ == "__main__":
    unittest.main()
