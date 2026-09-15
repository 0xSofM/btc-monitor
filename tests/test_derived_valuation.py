import math
import unittest
from datetime import date, timedelta
from unittest import mock

import pandas as pd

from pipeline import fetcher

DAYS = 80
START = date(2026, 1, 1)


def _pairs(values, start_value):
    """[timestamp_ms, value] rows for a deterministic synthetic series."""
    return [
        [
            int(pd.Timestamp(START + timedelta(days=index)).timestamp() * 1000),
            start_value + step,
        ]
        for index, step in enumerate(values)
    ]


PRICE_STEPS = [index * 100.0 for index in range(DAYS)]
REALIZED_STEPS = [index * 10.0 for index in range(DAYS)]
MARKET_CAP_STEPS = [index * 1e10 for index in range(DAYS)]
SUPPLY_STEPS = [index * 450.0 for index in range(DAYS)]

PRICE_BASE = 60000.0
REALIZED_BASE = 30000.0
MARKET_CAP_BASE = 1.20e12
SUPPLY_BASE = 20_000_000.0


class DerivedValuationTests(unittest.TestCase):
    def _frames(self):
        dates = [START + timedelta(days=index) for index in range(DAYS)]
        price_df = pd.DataFrame(
            {
                "date": pd.to_datetime(dates),
                "btc_price": [PRICE_BASE + step for step in PRICE_STEPS],
            }
        )
        # Realized price intentionally stops one day early: the pipeline must
        # carry it forward so the newest date still gets a value.
        realized_df = pd.DataFrame(
            {
                "date": pd.to_datetime(dates[:-1]),
                "realized_price": [REALIZED_BASE + step for step in REALIZED_STEPS[:-1]],
            }
        )
        return price_df, realized_df

    def _build(self):
        price_df, realized_df = self._frames()

        def fake_fetch_json(url):
            if "market_cap" in url:
                return _pairs(MARKET_CAP_STEPS, MARKET_CAP_BASE)
            if "supply" in url:
                return _pairs(SUPPLY_STEPS, SUPPLY_BASE)
            raise AssertionError(f"unexpected url: {url}")

        with mock.patch.object(fetcher, "fetch_json", side_effect=fake_fetch_json):
            return fetcher.build_derived_valuation_frame(price_df, realized_df)

    def test_extends_to_latest_price_date(self):
        frame = self._build()
        self.assertEqual(frame["date"].max().date(), START + timedelta(days=DAYS - 1))
        self.assertEqual(len(frame), DAYS)

    def test_nupl_is_one_minus_realized_over_price(self):
        frame = self._build()
        by_date = {row["date"].date(): row for _, row in frame.iterrows()}
        last = START + timedelta(days=DAYS - 1)

        expected = 1 - (REALIZED_BASE + REALIZED_STEPS[-2]) / (PRICE_BASE + PRICE_STEPS[-1])
        self.assertAlmostEqual(by_date[last]["nupl"], expected, places=12)

    def test_mvrv_zscore_matches_market_cap_stdev(self):
        frame = self._build()
        by_date = {row["date"].date(): row for _, row in frame.iterrows()}
        last = START + timedelta(days=DAYS - 1)

        market_caps = [MARKET_CAP_BASE + step for step in MARKET_CAP_STEPS]
        mean = sum(market_caps) / len(market_caps)
        sigma = math.sqrt(sum((x - mean) ** 2 for x in market_caps) / len(market_caps))

        market_cap = market_caps[-1]
        realized_price = REALIZED_BASE + REALIZED_STEPS[-2]
        price = PRICE_BASE + PRICE_STEPS[-1]
        expected = (market_cap - market_cap * realized_price / price) / sigma

        self.assertAlmostEqual(by_date[last]["mvrv_zscore"], expected, places=9)

    def test_puell_is_issuance_over_trailing_mean(self):
        frame = self._build()
        by_date = {row["date"].date(): row for _, row in frame.iterrows()}
        last = START + timedelta(days=DAYS - 1)

        issuance = [450.0 * (PRICE_BASE + step) for step in PRICE_STEPS[1:]]
        expected = issuance[-1] / (sum(issuance) / len(issuance))
        self.assertAlmostEqual(by_date[last]["puell_multiple"], expected, places=9)

    def test_missing_inputs_yield_empty_frame(self):
        empty = fetcher.build_derived_valuation_frame(
            pd.DataFrame(columns=["date", "btc_price"]),
            pd.DataFrame(columns=["date", "realized_price"]),
        )
        self.assertTrue(empty.empty)


if __name__ == "__main__":
    unittest.main()
