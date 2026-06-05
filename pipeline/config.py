"""Constants shared across the BTC data pipeline."""

from typing import Dict, List, Tuple

SERIES_CONFIG: Dict[str, Dict[str, object]] = {
    "btc_price": {
        "display_name": "BTC Price",
        "url": "https://charts.bgeometrics.com/files/moving_average_price.json",
        "live_urls": [
            "https://api.blockchain.info/stats",
            "https://api.coinbase.com/v2/prices/BTC-USD/spot",
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        ],
    },
    "ma200w": {
        "display_name": "200-Week MA",
        "url": "https://charts.bgeometrics.com/files/200wma.json",
        "compute_from": "btc_price",
    },
    "realized_price": {
        "display_name": "Realized Price",
        "url": "https://charts.bgeometrics.com/files/realized_price.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/realized_price_mvrv.json",
        ],
    },
    "lth_mvrv": {
        "display_name": "LTH-MVRV",
        "url": "https://charts.bgeometrics.com/files/lth_mvrv.json",
    },
    "mvrv_zscore": {
        "display_name": "MVRV Z-Score",
        "url": "https://charts.bgeometrics.com/files/mvrv_zscore_data.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/mvrv_zscore.json",
        ],
    },
    "nupl": {
        "display_name": "NUPL",
        "url": "https://charts.bgeometrics.com/files/nupl_data.json",
        "history_urls": [
            "https://bitcoin-data.com/v1/nupl",
        ],
        "latest_urls": [
            "https://bitcoin-data.com/v1/nupl/1",
            "https://r.jina.ai/http://bitcoin-data.com/v1/nupl/1",
        ],
    },
    "sth_sopr": {
        "display_name": "STH-SOPR",
        "url": "https://charts.bgeometrics.com/files/sth_sopr.json",
    },
    "sth_mvrv": {
        "display_name": "STH-MVRV",
        "url": "https://charts.bgeometrics.com/files/sth_mvrv.json",
    },
    "lth_sopr": {
        "display_name": "LTH-SOPR",
        "url": "https://charts.bgeometrics.com/files/lth_sopr.json",
    },
    "puell_multiple": {
        "display_name": "Puell Multiple",
        "url": "https://charts.bgeometrics.com/files/puell_multiple_data.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/puell_multiple_7dma.json",
        ],
    },
}

# Real-time BTC price sources, tried in order. Each entry maps to a parser.
LIVE_BTC_PRICE_SOURCES: List[Dict[str, object]] = [
    {
        "name": "blockchain_info_stats",
        "url": "https://api.blockchain.info/stats",
        "parser": "blockchain_stats",
    },
    {
        "name": "coinbase_spot",
        "url": "https://api.coinbase.com/v2/prices/BTC-USD/spot",
        "parser": "coinbase_spot",
    },
    {
        "name": "coingecko_simple",
        "url": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        "parser": "coingecko_simple",
    },
]

REQUEST_TIMEOUT = 45
MAX_RETRIES = 4
RETRY_BACKOFF_SEC = 2.0

RESERVE_RISK_SOURCE_REGISTRY: Dict[str, Dict[str, object]] = {
    "bitcoin_data_history": {
        "display_name": "bitcoin-data Reserve Risk history",
        "mode": "series",
        "priority": 0,
        "urls": [
            "https://bitcoin-data.com/v1/reserve-risk",
        ],
    },
    "bgeometrics_primary": {
        "display_name": "BGeometrics Reserve Risk legacy bridge",
        "mode": "series",
        "priority": 1,
        "urls": [
            "https://charts.bgeometrics.com/files/reserve_risk.json",
        ],
    },
    "bitcoin_data_latest": {
        "display_name": "bitcoin-data Reserve Risk latest",
        "mode": "point",
        "priority": 2,
        "urls": [
            "https://bitcoin-data.com/v1/reserve-risk/1",
            "https://r.jina.ai/http://bitcoin-data.com/v1/reserve-risk/1",
        ],
    },
}

SCORE_BANDS: List[Tuple[int, int, str]] = [
    (0, 3, "watch"),
    (4, 6, "focus"),
    (7, 9, "accumulate"),
    (10, 12, "extreme_bottom"),
]

LEGACY_SCORING_INDICATOR_COUNT = 5
SCORING_INDICATOR_COUNT_V4 = 7
SCORE_CONFIRM_RATIO = 7 / 12
DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS = 30
LEGACY_SCORING_MODEL_VERSION = "v3_no_lookahead_replacement"
SCORING_MODEL_VERSION = "v6_core8_nupl_valuation_blend"
SCHEMA_VERSION = "v6"
INDICATOR_SET = "core8_bottom_v6_nupl_valuation_blend"
ARCHIVE_ROOT_DEFAULT = "archive/releases"
SIGNAL_EVENTS_V4_JSON_PATH_DEFAULT = "app/public/btc_signal_events_v4.json"
ROLLBACK_METADATA_FILE = "release_metadata.json"

ROLLING_THRESHOLD_WINDOW_DAYS = 1460
ROLLING_THRESHOLD_MIN_HISTORY_DAYS = 365
RESERVE_RISK_TRIGGER_QUANTILE = 0.20
RESERVE_RISK_DEEP_QUANTILE = 0.10
STH_TRIGGER_QUANTILE = 0.27
STH_DEEP_QUANTILE = 0.135

INDICATOR_FRESHNESS_MAX_LAG_DAYS: Dict[str, int] = {
    "btc_price": 2,
    "ma200w": 7,
    "realized_price": 7,
    "reserve_risk": DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
    "lth_mvrv": 7,
    "lth_sopr": 7,
    "mvrv_zscore": 7,
    "nupl": 7,
    "sth_sopr": 7,
    "sth_mvrv": 7,
    "puell_multiple": 7,
}

THRESHOLD_STATIC: Dict[str, Dict[str, float]] = {
    "price_ma200w_ratio": {"trigger": 1.0, "deep": 0.85},
    "price_realized_ratio": {"trigger": 1.0, "deep": 0.90},
    "sth_sopr": {"trigger": 1.0, "deep": 0.97},
    "sth_mvrv": {"trigger": 1.0, "deep": 0.85},
    "puell_multiple": {"trigger": 0.6, "deep": 0.5},
    "lth_mvrv": {"trigger": 1.0, "deep": 0.9},
    "lth_sopr": {"trigger": 1.0, "deep": 0.98},
    "mvrv_zscore": {"trigger": 0.0, "deep": -0.5},
    "nupl": {"trigger": 0.15, "deep": 0.0},
}

GROUPED_SIGNAL_COLUMNS = [
    "signal_price_ma200w",
    "signal_price_realized",
    "signal_reserve_risk",
    "signal_sth_group",
    "signal_puell",
]

GROUPED_SCORE_COLUMNS = [
    "score_price_ma200w",
    "score_price_realized",
    "score_reserve_risk",
    "score_sth_group",
    "score_puell",
]
