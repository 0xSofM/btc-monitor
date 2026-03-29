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
                "ma200w": [100.0, 100.0, 100.0],
                "mvrv_z_score": [1.0, None, -0.2],
                "lth_mvrv": [1.2, 0.8, None],
                "puell_multiple": [0.6, None, 0.4],
                "nupl": [0.2, -0.1, None],
            }
        )

    def test_enrich_forward_fill_and_signal_count(self) -> None:
        enriched = enrich_for_frontend(self.build_base_df())

        self.assertAlmostEqual(float(enriched.iloc[1]["mvrv_z_score"]), 1.0)
        self.assertAlmostEqual(float(enriched.iloc[2]["lth_mvrv"]), 0.8)
        self.assertAlmostEqual(float(enriched.iloc[2]["nupl"]), -0.1)

        # mvrv on 2024-01-02 is forward-filled from 2024-01-01
        self.assertEqual(enriched.iloc[1]["mvrv_z_score_date"].strftime("%Y-%m-%d"), "2024-01-01")
        # lth_mvrv on 2024-01-03 is forward-filled from 2024-01-02
        self.assertEqual(enriched.iloc[2]["lth_mvrv_date"].strftime("%Y-%m-%d"), "2024-01-02")

        self.assertEqual(int(enriched.iloc[1]["signal_count"]), 3)
        self.assertEqual(int(enriched.iloc[2]["signal_count"]), 5)

    def test_history_json_contains_expected_fields(self) -> None:
        enriched = enrich_for_frontend(self.build_base_df())
        history = dataframe_to_history_json(enriched)

        self.assertEqual(len(history), 3)
        last = history[-1]
        self.assertEqual(last["d"], "2024-01-03")
        self.assertEqual(last["signalCount"], 5)
        self.assertIsInstance(last["unixTs"], int)
        self.assertIn("api_data_date", last)
        self.assertEqual(last["api_data_date"]["lth_mvrv"], "2024-01-02")
        self.assertEqual(last["api_data_date"]["mvrv_z"], "2024-01-03")

    def test_build_latest_json_uses_latest_row(self) -> None:
        enriched = enrich_for_frontend(self.build_base_df())
        latest = build_latest_json(enriched)

        self.assertEqual(latest["date"], "2024-01-03")
        self.assertEqual(latest["signalCount"], 5)
        self.assertTrue(latest["signals"]["priceMa200w"])
        self.assertTrue(latest["signals"]["mvrvZ"])
        self.assertTrue(latest["signals"]["lthMvrv"])
        self.assertEqual(latest["indicatorDates"]["lthMvrv"], "2024-01-02")
        self.assertEqual(latest["indicatorDates"]["mvrvZ"], "2024-01-03")

    def test_build_light_history_json_filters_old_rows(self) -> None:
        history = [
            {"d": "2021-01-01", "signalCount": 0},
            {"d": "2023-06-01", "signalCount": 1},
            {"d": "2024-01-01", "signalCount": 2},
        ]
        light = build_light_history_json(history, years=1)

        self.assertEqual([row["d"] for row in light], ["2023-06-01", "2024-01-01"])


if __name__ == "__main__":
    unittest.main()
