#!/usr/bin/env python3
"""
Fetch BTC indicator history from BGeometrics chart JSON files (V2).

Data sources:
  - https://charts.bgeometrics.com/files/*.json

Outputs:
  1. Tabular files (CSV/XLSX) for offline analysis
  2. Frontend static files used by the Vite app:
     - app/public/btc_indicators_history.json
     - app/public/btc_indicators_history_light.json
     - app/public/btc_indicators_latest.json
     - app/public/btc_indicators_manifest.json

Core-6 bottom indicators:
  - BTC Price / 200W-MA (calculated)
  - BTC Price / Realized Price (calculated)
  - Reserve Risk
  - STH-SOPR
  - STH-MVRV
  - Puell Multiple
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
import requests


SERIES_CONFIG: Dict[str, Dict[str, object]] = {
    "btc_price": {
        "display_name": "BTC Price",
        "url": "https://charts.bgeometrics.com/files/moving_average_price.json",
    },
    "ma200w": {
        "display_name": "200-Week MA",
        "url": "https://charts.bgeometrics.com/files/200wma.json",
    },
    "realized_price": {
        "display_name": "Realized Price",
        "url": "https://charts.bgeometrics.com/files/realized_price.json",
    },
    "reserve_risk": {
        "display_name": "Reserve Risk",
        "url": "https://charts.bgeometrics.com/files/reserve_risk.json",
    },
    "lth_mvrv": {
        "display_name": "LTH-MVRV",
        "url": "https://charts.bgeometrics.com/files/lth_mvrv.json",
    },
    "mvrv_zscore": {
        "display_name": "MVRV Z-Score",
        "url": "https://charts.bgeometrics.com/files/mvrv_zscore_data.json",
    },
    "sth_sopr": {
        "display_name": "STH-SOPR",
        "url": "https://charts.bgeometrics.com/files/sth_sopr.json",
    },
    "sth_mvrv": {
        "display_name": "STH-MVRV",
        "url": "https://charts.bgeometrics.com/files/sth_mvrv.json",
    },
    "puell_multiple": {
        "display_name": "Puell Multiple",
        "url": "https://charts.bgeometrics.com/files/puell_multiple_data.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/puell_multiple_7dma.json",
        ],
    },
}

REQUEST_TIMEOUT = 45
MAX_RETRIES = 4
RETRY_BACKOFF_SEC = 2.0
RESERVE_RISK_BACKUP_URLS = [
    "https://bitcoin-data.com/v1/reserve-risk/1",
    "https://r.jina.ai/http://bitcoin-data.com/v1/reserve-risk/1",
]


SCORE_BANDS: List[Tuple[int, int, str]] = [
    (0, 3, "watch"),
    (4, 6, "focus"),
    (7, 9, "accumulate"),
    (10, 12, "extreme_bottom"),
]

SCORING_INDICATOR_COUNT = 5
SCORE_CONFIRM_RATIO = 7 / 12
DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS = 30
SCORING_MODEL_VERSION = "v3_no_lookahead_replacement"

ROLLING_THRESHOLD_WINDOW_DAYS = 1460
ROLLING_THRESHOLD_MIN_HISTORY_DAYS = 365
RESERVE_RISK_TRIGGER_QUANTILE = 0.20
RESERVE_RISK_DEEP_QUANTILE = 0.10
STH_TRIGGER_QUANTILE = 0.27
STH_DEEP_QUANTILE = 0.135

THRESHOLD_STATIC: Dict[str, Dict[str, float]] = {
    "price_ma200w_ratio": {"trigger": 1.0, "deep": 0.85},
    "price_realized_ratio": {"trigger": 1.0, "deep": 0.90},
    "sth_sopr": {"trigger": 1.0, "deep": 0.97},
    "sth_mvrv": {"trigger": 1.0, "deep": 0.85},
    "puell_multiple": {"trigger": 0.6, "deep": 0.5},
    "lth_mvrv": {"trigger": 1.0, "deep": 0.9},
    "mvrv_zscore": {"trigger": 0.0, "deep": -0.5},
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


def _safe_float(value: object) -> float | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return float(value)

    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed == "":
            return None
        try:
            parsed = float(trimmed)
            if math.isnan(parsed):
                return None
            return parsed
        except ValueError:
            return None

    try:
        parsed = float(value)
        if math.isnan(parsed):
            return None
        return parsed
    except (TypeError, ValueError):
        return None


def _safe_iso_date(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed == "":
            return None
        return trimmed
    return None


def fetch_json(url: str) -> List[List[object]]:
    """Fetch a `[timestamp_ms, value]` list from URL with retry."""
    headers = {"User-Agent": "btc-monitor-history-fetcher/1.1"}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError(f"Unexpected JSON type from {url}: {type(payload)}")
            return payload
        except Exception:
            if attempt == MAX_RETRIES:
                raise
            wait_sec = RETRY_BACKOFF_SEC * attempt
            time.sleep(wait_sec)

    return []


def parse_series(metric_key: str, raw_rows: Iterable[object]) -> pd.DataFrame:
    """Convert raw rows to a normalized DataFrame: date, <metric_key>."""
    parsed: List[Dict[str, object]] = []

    for row in raw_rows:
        if not isinstance(row, list) or len(row) < 2:
            continue

        ts_raw, value_raw = row[0], row[1]
        if ts_raw is None:
            continue

        try:
            ts_int = int(ts_raw)
        except (TypeError, ValueError):
            continue

        # Handle second-level timestamps defensively.
        if ts_int < 10**11:
            ts_int *= 1000

        timestamp = pd.to_datetime(ts_int, unit="ms", utc=True)
        date = timestamp.tz_convert("UTC").date()
        value = _safe_float(value_raw)
        parsed.append({"date": date, metric_key: value})

    if not parsed:
        return pd.DataFrame(columns=["date", metric_key])

    df = pd.DataFrame(parsed)
    df["date"] = pd.to_datetime(df["date"])
    # Keep last row per date if duplicates exist.
    return df.sort_values("date").groupby("date", as_index=False).last()


def fetch_metric(metric_key: str, config: Dict[str, object]) -> Tuple[pd.DataFrame, str]:
    """Fetch one metric; try primary URL then fallback URLs."""
    urls = [str(config["url"])] + [str(x) for x in config.get("fallback_urls", [])]
    last_error: Exception | None = None

    for url in urls:
        try:
            raw_data = fetch_json(url)
            df = parse_series(metric_key, raw_data)
            if not df.empty:
                return df, url
            last_error = RuntimeError(f"Empty series from {url}")
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Failed to fetch {metric_key}: {last_error}")


def _extract_json_from_response_text(raw_text: str) -> object | None:
    trimmed = raw_text.strip()
    if not trimmed:
        return None

    try:
        return json.loads(trimmed)
    except Exception:
        pass

    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", trimmed)
    if not match:
        return None

    candidate = match.group(1)
    try:
        return json.loads(candidate)
    except Exception:
        return None


def _parse_reserve_risk_point(payload: object) -> Tuple[pd.Timestamp, float] | None:
    point: Dict[str, object] | None = None

    if isinstance(payload, dict):
        if "d" in payload and "reserveRisk" in payload:
            point = payload
    elif isinstance(payload, list) and payload:
        if isinstance(payload[-1], dict):
            point = payload[-1]

    if not point:
        return None

    date_raw = _safe_iso_date(point.get("d"))
    value_raw = _safe_float(point.get("reserveRisk"))
    if not date_raw or value_raw is None:
        return None

    try:
        date_value = pd.to_datetime(date_raw)
    except Exception:
        return None

    return date_value, value_raw


def fetch_reserve_risk_backup_point() -> Tuple[pd.Timestamp, float, str] | None:
    headers = {"User-Agent": "btc-monitor-history-fetcher/1.1"}

    for url in RESERVE_RISK_BACKUP_URLS:
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if response.status_code >= 400:
                continue

            payload = _extract_json_from_response_text(response.text)
            if payload is None:
                continue

            parsed = _parse_reserve_risk_point(payload)
            if parsed is None:
                continue

            return parsed[0], parsed[1], url
        except Exception:
            continue

    return None


def _safe_int(value: object) -> int | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    return int(parsed)


def patch_reserve_risk_tail(df: pd.DataFrame) -> Tuple[pd.DataFrame, str | None]:
    if df.empty or "date" not in df.columns or "reserve_risk" not in df.columns:
        return df, None

    backup_point = fetch_reserve_risk_backup_point()
    if not backup_point:
        return df, None

    backup_date, backup_value, backup_source = backup_point
    patched = df.copy()
    patched["date"] = pd.to_datetime(patched["date"])
    patched = patched.sort_values("date").reset_index(drop=True)

    same_day = patched["date"] == backup_date
    if same_day.any():
        patched.loc[same_day, "reserve_risk"] = backup_value
    else:
        patched = pd.concat(
            [
                patched,
                pd.DataFrame(
                    {
                        "date": [backup_date],
                        "reserve_risk": [backup_value],
                    }
                ),
            ],
            ignore_index=True,
        )
        patched = patched.sort_values("date").drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)

    applied_info = (
        f"{backup_date.strftime('%Y-%m-%d')} -> {backup_value:.10f} "
        f"(source: {backup_source})"
    )
    return patched, applied_info


def build_base_dataframe(
    start_date: str | None = None,
    end_date: str | None = None,
) -> Tuple[pd.DataFrame, Dict[str, str], pd.Timestamp | None]:
    """Fetch all required data and build merged base DataFrame."""
    dfs: Dict[str, pd.DataFrame] = {}
    selected_sources: Dict[str, str] = {}

    print("=" * 72)
    print("BTC Indicators History (BGeometrics chart files mode)")
    print("=" * 72)

    futures = {}
    max_workers = min(6, len(SERIES_CONFIG))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for key, cfg in SERIES_CONFIG.items():
            display_name = str(cfg.get("display_name", key))
            print(f"Queue fetch: {display_name} ...")
            futures[key] = executor.submit(fetch_metric, key, cfg)

        for key, cfg in SERIES_CONFIG.items():
            display_name = str(cfg.get("display_name", key))
            print(f"Fetching {display_name} ...")
            df, selected_url = futures[key].result()
            dfs[key] = df
            selected_sources[key] = selected_url
            print(f"  Rows: {len(df):,} | Source: {selected_url}")

    reserve_primary_non_null = dfs["reserve_risk"].loc[dfs["reserve_risk"]["reserve_risk"].notna(), "date"]
    reserve_primary_last_date = (
        pd.to_datetime(reserve_primary_non_null.max()) if not reserve_primary_non_null.empty else None
    )

    reserve_patched_df, reserve_patch_info = patch_reserve_risk_tail(dfs["reserve_risk"])
    if reserve_patch_info:
        dfs["reserve_risk"] = reserve_patched_df
        selected_sources["reserve_risk"] = (
            f"{selected_sources['reserve_risk']} + backup({reserve_patch_info})"
        )
        print(f"Reserve Risk tail patched: {reserve_patch_info}")

    merged: pd.DataFrame | None = None
    for key in [
        "btc_price",
        "ma200w",
        "realized_price",
        "reserve_risk",
        "lth_mvrv",
        "mvrv_zscore",
        "sth_sopr",
        "sth_mvrv",
        "puell_multiple",
    ]:
        current = dfs[key]
        merged = current if merged is None else pd.merge(merged, current, on="date", how="outer")

    assert merged is not None
    merged = merged.sort_values("date").reset_index(drop=True)

    if start_date:
        merged = merged[merged["date"] >= pd.to_datetime(start_date)]
    if end_date:
        merged = merged[merged["date"] <= pd.to_datetime(end_date)]

    return merged.reset_index(drop=True), selected_sources, reserve_primary_last_date


def _score_by_lt(value: object, trigger: float, deep: float) -> int:
    parsed = _safe_float(value)
    if parsed is None:
        return 0
    if parsed < deep:
        return 2
    if parsed < trigger:
        return 1
    return 0


def _score_by_lt_series(
    values: pd.Series,
    trigger_series: pd.Series,
    deep_series: pd.Series,
) -> pd.Series:
    numeric_values = pd.to_numeric(values, errors="coerce")
    trigger_values = pd.to_numeric(trigger_series, errors="coerce")
    deep_values = pd.to_numeric(deep_series, errors="coerce")
    deep_values = pd.concat([deep_values, trigger_values], axis=1).min(axis=1)

    scores = pd.Series(0, index=values.index, dtype="int64")
    valid_mask = numeric_values.notna() & trigger_values.notna() & deep_values.notna()
    scores.loc[valid_mask & (numeric_values < trigger_values)] = 1
    scores.loc[valid_mask & (numeric_values < deep_values)] = 2
    return scores


def _build_rolling_lt_thresholds(
    values: pd.Series,
    trigger_quantile: float,
    deep_quantile: float,
    fallback_trigger: float,
    fallback_deep: float,
    window_days: int = ROLLING_THRESHOLD_WINDOW_DAYS,
    min_history_days: int = ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
) -> Tuple[pd.Series, pd.Series]:
    numeric_values = pd.to_numeric(values, errors="coerce")
    history = numeric_values.shift(1).rolling(window=max(2, int(window_days)), min_periods=max(2, int(min_history_days)))
    trigger_series = history.quantile(trigger_quantile).fillna(fallback_trigger)
    deep_series = history.quantile(deep_quantile).fillna(fallback_deep)
    deep_series = pd.concat([deep_series, trigger_series], axis=1).min(axis=1)
    return trigger_series, deep_series


def _classify_score_band(score: int, max_score: int) -> str:
    if max_score <= 0:
        return "watch"

    normalized_score = (score / max_score) * 12
    for low, high, label in SCORE_BANDS:
        if low <= normalized_score <= high:
            return label
    return "watch"


def enrich_for_frontend(
    base_df: pd.DataFrame,
    reserve_risk_disable_lag_days: int = DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
    reserve_risk_primary_last_date: pd.Timestamp | None = None,
) -> Tuple[pd.DataFrame, Dict[str, Dict[str, object]]]:
    """Build frontend-ready columns including ffilled metrics and V2 signals/scores."""
    df = base_df.copy()
    reserve_risk_disable_lag_days = max(0, int(reserve_risk_disable_lag_days))

    metric_cols = [
        "btc_price",
        "ma200w",
        "realized_price",
        "reserve_risk",
        "lth_mvrv",
        "mvrv_zscore",
        "sth_sopr",
        "sth_mvrv",
        "puell_multiple",
    ]

    for col in metric_cols:
        if col not in df.columns:
            df[col] = pd.NA

    # Track last real update date per indicator (before forward-fill).
    for col in metric_cols:
        date_col = f"{col}_date"
        df[date_col] = df["date"].where(df[col].notna(), pd.NaT).ffill()

    # Forward-fill indicator values so latest row stays usable in UI.
    for col in metric_cols:
        df[col] = df[col].ffill()

    if reserve_risk_primary_last_date is None:
        reserve_primary_series = df.loc[df["reserve_risk"].notna(), "date"]
        reserve_risk_primary_last_date = (
            pd.to_datetime(reserve_primary_series.max()) if not reserve_primary_series.empty else None
        )

    # Track Reserve Risk lag so stale series can be excluded from scoring.
    df["reserve_risk_lag_days"] = (df["date"] - df["reserve_risk_date"]).dt.days
    reserve_primary_date = pd.to_datetime(reserve_risk_primary_last_date) if reserve_risk_primary_last_date is not None else pd.NaT
    df["reserve_risk_primary_date"] = reserve_primary_date
    if pd.isna(reserve_primary_date):
        df["reserve_risk_primary_lag_days"] = pd.NA
        reserve_primary_is_fresh = pd.Series(False, index=df.index)
    else:
        df["reserve_risk_primary_lag_days"] = (df["date"] - reserve_primary_date).dt.days
        reserve_primary_is_fresh = df["reserve_risk_primary_lag_days"].le(reserve_risk_disable_lag_days)

    df["reserve_risk_active"] = (
        df["reserve_risk_date"].notna()
        & reserve_primary_is_fresh
        & df["reserve_risk_lag_days"].fillna(reserve_risk_disable_lag_days + 1).le(reserve_risk_disable_lag_days)
    )
    df["reserve_risk_disable_lag_days"] = reserve_risk_disable_lag_days

    # Derived metrics.
    df["price_200w_ma_ratio"] = df["btc_price"] / df["ma200w"].replace(0, pd.NA)
    df["price_realized_ratio"] = df["btc_price"] / df["realized_price"].replace(0, pd.NA)

    reserve_trigger_series, reserve_deep_series = _build_rolling_lt_thresholds(
        values=df["reserve_risk"],
        trigger_quantile=RESERVE_RISK_TRIGGER_QUANTILE,
        deep_quantile=RESERVE_RISK_DEEP_QUANTILE,
        fallback_trigger=0.0016,
        fallback_deep=0.0012,
    )
    sth_sopr_trigger_series, sth_sopr_deep_series = _build_rolling_lt_thresholds(
        values=df["sth_sopr"],
        trigger_quantile=STH_TRIGGER_QUANTILE,
        deep_quantile=STH_DEEP_QUANTILE,
        fallback_trigger=THRESHOLD_STATIC["sth_sopr"]["trigger"],
        fallback_deep=THRESHOLD_STATIC["sth_sopr"]["deep"],
    )
    sth_mvrv_trigger_series, sth_mvrv_deep_series = _build_rolling_lt_thresholds(
        values=df["sth_mvrv"],
        trigger_quantile=STH_TRIGGER_QUANTILE,
        deep_quantile=STH_DEEP_QUANTILE,
        fallback_trigger=THRESHOLD_STATIC["sth_mvrv"]["trigger"],
        fallback_deep=THRESHOLD_STATIC["sth_mvrv"]["deep"],
    )

    df["score_price_ma200w"] = df["price_200w_ma_ratio"].apply(
        lambda v: _score_by_lt(v, THRESHOLD_STATIC["price_ma200w_ratio"]["trigger"], THRESHOLD_STATIC["price_ma200w_ratio"]["deep"])
    )
    df["score_price_realized"] = df["price_realized_ratio"].apply(
        lambda v: _score_by_lt(v, THRESHOLD_STATIC["price_realized_ratio"]["trigger"], THRESHOLD_STATIC["price_realized_ratio"]["deep"])
    )
    df["score_reserve_risk_primary"] = _score_by_lt_series(
        values=df["reserve_risk"],
        trigger_series=reserve_trigger_series,
        deep_series=reserve_deep_series,
    )
    df["score_sth_sopr"] = _score_by_lt_series(
        values=df["sth_sopr"],
        trigger_series=sth_sopr_trigger_series,
        deep_series=sth_sopr_deep_series,
    )
    df["score_sth_mvrv"] = _score_by_lt_series(
        values=df["sth_mvrv"],
        trigger_series=sth_mvrv_trigger_series,
        deep_series=sth_mvrv_deep_series,
    )
    # STH-SOPR and STH-MVRV are highly correlated, so score them as one grouped dimension.
    df["score_sth_group"] = df[["score_sth_sopr", "score_sth_mvrv"]].max(axis=1)
    df["score_puell"] = df["puell_multiple"].apply(
        lambda v: _score_by_lt(v, THRESHOLD_STATIC["puell_multiple"]["trigger"], THRESHOLD_STATIC["puell_multiple"]["deep"])
    )
    df["score_lth_mvrv"] = df["lth_mvrv"].apply(
        lambda v: _score_by_lt(v, THRESHOLD_STATIC["lth_mvrv"]["trigger"], THRESHOLD_STATIC["lth_mvrv"]["deep"])
    )
    df["score_mvrv_zscore"] = df["mvrv_zscore"].apply(
        lambda v: _score_by_lt(v, THRESHOLD_STATIC["mvrv_zscore"]["trigger"], THRESHOLD_STATIC["mvrv_zscore"]["deep"])
    )
    df["score_reserve_risk_replacement"] = df[["score_lth_mvrv", "score_mvrv_zscore"]].max(axis=1)

    df["lth_mvrv_lag_days"] = (df["date"] - df["lth_mvrv_date"]).dt.days
    df["mvrv_zscore_lag_days"] = (df["date"] - df["mvrv_zscore_date"]).dt.days
    replacement_lag = df[["lth_mvrv_lag_days", "mvrv_zscore_lag_days"]].min(axis=1, skipna=True)
    replacement_available_mask = df[["lth_mvrv_date", "mvrv_zscore_date"]].notna().any(axis=1)
    df["reserve_risk_replacement_lag_days"] = replacement_lag.where(replacement_available_mask, pd.NA)
    df["reserve_risk_replacement_active"] = (
        ~df["reserve_risk_active"]
        & df["reserve_risk_replacement_lag_days"].fillna(reserve_risk_disable_lag_days + 1).le(reserve_risk_disable_lag_days)
    )
    reserve_replacement_source = pd.Series(
        np.where(
            df["score_lth_mvrv"] >= df["score_mvrv_zscore"],
            "lth_mvrv",
            "mvrv_zscore_data",
        ),
        index=df.index,
        dtype="object",
    )
    df["reserve_risk_replacement_source"] = reserve_replacement_source.where(
        df["reserve_risk_replacement_active"],
        None,
    )

    df["reserve_risk_source_mode"] = np.where(
        df["reserve_risk_active"],
        "primary",
        np.where(df["reserve_risk_replacement_active"], "replacement", "inactive"),
    )
    df["reserve_dimension_active"] = df["reserve_risk_source_mode"] != "inactive"
    df["score_reserve_risk"] = df["score_reserve_risk_primary"]
    replacement_mask = ~df["reserve_risk_active"] & df["reserve_risk_replacement_active"]
    df.loc[replacement_mask, "score_reserve_risk"] = df.loc[replacement_mask, "score_reserve_risk_replacement"]
    df.loc[~df["reserve_dimension_active"], "score_reserve_risk"] = 0
    df["score_reserve_risk"] = df["score_reserve_risk"].fillna(0).astype(int)

    thresholds = {
        "priceMa200wRatio": THRESHOLD_STATIC["price_ma200w_ratio"],
        "priceRealizedRatio": THRESHOLD_STATIC["price_realized_ratio"],
        "reserveRisk": {
            "trigger": float(reserve_trigger_series.iloc[-1]),
            "deep": float(reserve_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": RESERVE_RISK_TRIGGER_QUANTILE,
            "deepQuantile": RESERVE_RISK_DEEP_QUANTILE,
        },
        "sthSopr": {
            "trigger": float(sth_sopr_trigger_series.iloc[-1]),
            "deep": float(sth_sopr_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": STH_TRIGGER_QUANTILE,
            "deepQuantile": STH_DEEP_QUANTILE,
        },
        "sthMvrv": {
            "trigger": float(sth_mvrv_trigger_series.iloc[-1]),
            "deep": float(sth_mvrv_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": STH_TRIGGER_QUANTILE,
            "deepQuantile": STH_DEEP_QUANTILE,
        },
        "puellMultiple": THRESHOLD_STATIC["puell_multiple"],
        "reserveRiskReplacement": {
            "lthMvrv": THRESHOLD_STATIC["lth_mvrv"],
            "mvrvZscore": THRESHOLD_STATIC["mvrv_zscore"],
        },
    }

    # Signal flags and composite score.
    df["signal_price_ma200w"] = df["score_price_ma200w"] > 0
    df["signal_price_realized"] = df["score_price_realized"] > 0
    df["signal_reserve_risk"] = df["score_reserve_risk"] > 0
    df["signal_sth_sopr"] = df["score_sth_sopr"] > 0
    df["signal_sth_mvrv"] = df["score_sth_mvrv"] > 0
    df["signal_sth_group"] = df["score_sth_group"] > 0
    df["signal_puell"] = df["score_puell"] > 0

    df["inactive_indicator_count"] = (~df["reserve_dimension_active"]).astype(int)
    df["active_indicator_count"] = SCORING_INDICATOR_COUNT - df["inactive_indicator_count"]
    df["max_signal_score_v2"] = df["active_indicator_count"] * 2
    df["signal_count"] = df[GROUPED_SIGNAL_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2"] = df[GROUPED_SCORE_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2_min3d"] = df["signal_score_v2"].rolling(window=3, min_periods=3).min()
    min3d_ratio = (
        df["signal_score_v2_min3d"] / df["max_signal_score_v2"].replace(0, pd.NA)
    ).fillna(0)
    df["signal_confirmed_3d"] = min3d_ratio >= SCORE_CONFIRM_RATIO
    df["signal_band_v2"] = [
        _classify_score_band(int(score), int(max_score))
        for score, max_score in zip(df["signal_score_v2"], df["max_signal_score_v2"])
    ]

    return df, thresholds


def build_tabular_view(frontend_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare human-readable table used for CSV/XLSX exports."""
    return frontend_df.rename(
        columns={
            "date": "Date",
            "price_200w_ma_ratio": "BTC_Price_200W_MA_Ratio",
            "price_realized_ratio": "BTC_Price_Realized_Price_Ratio",
            "reserve_risk": "Reserve_Risk",
            "sth_sopr": "STH_SOPR",
            "sth_mvrv": "STH_MVRV",
            "puell_multiple": "Puell_Multiple",
            "signal_score_v2": "Signal_Score_V2",
            "signal_count": "Signal_Count",
        }
    )[
        [
            "Date",
            "BTC_Price_200W_MA_Ratio",
            "BTC_Price_Realized_Price_Ratio",
            "Reserve_Risk",
            "STH_SOPR",
            "STH_MVRV",
            "Puell_Multiple",
            "Signal_Score_V2",
            "Signal_Count",
        ]
    ].reset_index(drop=True)


def dataframe_to_history_json(frontend_df: pd.DataFrame) -> List[Dict[str, object]]:
    """Convert enriched DataFrame to frontend history JSON format."""
    records: List[Dict[str, object]] = []

    for row in frontend_df.itertuples(index=False):
        date_value = _safe_iso_date(getattr(row, "date"))
        if not date_value:
            continue

        ts = datetime.strptime(date_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        unix_ts = int(ts.timestamp())

        records.append(
            {
                "d": date_value,
                "unixTs": unix_ts,
                "btcPrice": _safe_float(getattr(row, "btc_price")),
                "ma200w": _safe_float(getattr(row, "ma200w")),
                "realizedPrice": _safe_float(getattr(row, "realized_price")),
                "priceMa200wRatio": _safe_float(getattr(row, "price_200w_ma_ratio")),
                "priceRealizedRatio": _safe_float(getattr(row, "price_realized_ratio")),
                "reserveRisk": _safe_float(getattr(row, "reserve_risk")),
                "lthMvrv": _safe_float(getattr(row, "lth_mvrv")),
                "mvrvZscore": _safe_float(getattr(row, "mvrv_zscore")),
                "sthSopr": _safe_float(getattr(row, "sth_sopr")),
                "sthMvrv": _safe_float(getattr(row, "sth_mvrv")),
                "puellMultiple": _safe_float(getattr(row, "puell_multiple")),
                "signalPriceMa200w": bool(getattr(row, "signal_price_ma200w")),
                "signalPriceRealized": bool(getattr(row, "signal_price_realized")),
                "signalReserveRisk": bool(getattr(row, "signal_reserve_risk")),
                "signalSthSopr": bool(getattr(row, "signal_sth_sopr")),
                "signalSthMvrv": bool(getattr(row, "signal_sth_mvrv")),
                "signalSthGroup": bool(getattr(row, "signal_sth_group")),
                "signalPuell": bool(getattr(row, "signal_puell")),
                "signalCount": int(getattr(row, "signal_count")),
                "activeIndicatorCount": int(getattr(row, "active_indicator_count")),
                "scorePriceMa200w": int(getattr(row, "score_price_ma200w")),
                "scorePriceRealized": int(getattr(row, "score_price_realized")),
                "scoreReserveRisk": int(getattr(row, "score_reserve_risk")),
                "scoreReserveRiskPrimary": int(getattr(row, "score_reserve_risk_primary")),
                "scoreReserveRiskReplacement": int(getattr(row, "score_reserve_risk_replacement")),
                "scoreLthMvrv": int(getattr(row, "score_lth_mvrv")),
                "scoreMvrvZscore": int(getattr(row, "score_mvrv_zscore")),
                "scoreSthSopr": int(getattr(row, "score_sth_sopr")),
                "scoreSthMvrv": int(getattr(row, "score_sth_mvrv")),
                "scoreSthGroup": int(getattr(row, "score_sth_group")),
                "scorePuell": int(getattr(row, "score_puell")),
                "signalScoreV2": int(getattr(row, "signal_score_v2")),
                "maxSignalScoreV2": int(getattr(row, "max_signal_score_v2")),
                "signalScoreV2Min3d": _safe_float(getattr(row, "signal_score_v2_min3d")),
                "signalConfirmed3d": bool(getattr(row, "signal_confirmed_3d")),
                "signalBandV2": str(getattr(row, "signal_band_v2")),
                "reserveRiskActive": bool(getattr(row, "reserve_risk_active")),
                "reserveRiskReplacementActive": bool(getattr(row, "reserve_risk_replacement_active")),
                "reserveRiskReplacementSource": getattr(row, "reserve_risk_replacement_source"),
                "reserveRiskSourceMode": str(getattr(row, "reserve_risk_source_mode")),
                "reserveRiskLagDays": _safe_int(getattr(row, "reserve_risk_lag_days")),
                "reserveRiskPrimaryLagDays": _safe_int(getattr(row, "reserve_risk_primary_lag_days")),
                "reserveRiskReplacementLagDays": _safe_int(getattr(row, "reserve_risk_replacement_lag_days")),
                "api_data_date": {
                    "price_ma200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "price_realized": _safe_iso_date(getattr(row, "realized_price_date")),
                    "reserve_risk": _safe_iso_date(getattr(row, "reserve_risk_date")),
                    "lth_mvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "mvrv_zscore": _safe_iso_date(getattr(row, "mvrv_zscore_date")),
                    "sth_sopr": _safe_iso_date(getattr(row, "sth_sopr_date")),
                    "sth_mvrv": _safe_iso_date(getattr(row, "sth_mvrv_date")),
                    "puell": _safe_iso_date(getattr(row, "puell_multiple_date")),
                },
            }
        )

    return records


def build_latest_json(
    frontend_df: pd.DataFrame,
    thresholds: Dict[str, Dict[str, object]],
) -> Dict[str, object]:
    """Build latest snapshot JSON from the last history row."""
    if frontend_df.empty:
        raise ValueError("Cannot build latest JSON from empty dataframe")

    last = frontend_df.iloc[-1]
    date_value = _safe_iso_date(last["date"])
    if not date_value:
        raise ValueError("Latest row has no valid date")

    reserve_risk_active = bool(last.get("reserve_risk_active", True))
    reserve_risk_lag_days = _safe_int(last.get("reserve_risk_lag_days"))
    reserve_risk_primary_lag_days = _safe_int(last.get("reserve_risk_primary_lag_days"))
    reserve_risk_disable_lag_days = _safe_int(last.get("reserve_risk_disable_lag_days"))
    reserve_risk_date = _safe_iso_date(last["reserve_risk_date"]) or date_value
    reserve_risk_primary_date = _safe_iso_date(last.get("reserve_risk_primary_date"))
    reserve_risk_replacement_active = bool(last.get("reserve_risk_replacement_active", False))
    reserve_risk_replacement_source = last.get("reserve_risk_replacement_source")
    reserve_risk_replacement_lag_days = _safe_int(last.get("reserve_risk_replacement_lag_days"))
    reserve_risk_source_mode = str(last.get("reserve_risk_source_mode", "primary"))
    lth_mvrv_date = _safe_iso_date(last.get("lth_mvrv_date")) or date_value
    mvrv_zscore_date = _safe_iso_date(last.get("mvrv_zscore_date")) or date_value

    reserve_risk_effective_date = reserve_risk_date
    if reserve_risk_source_mode == "replacement":
        if reserve_risk_replacement_source == "mvrv_zscore_data":
            reserve_risk_effective_date = mvrv_zscore_date
        else:
            reserve_risk_effective_date = lth_mvrv_date

    inactive_indicators: List[Dict[str, object]] = []
    if reserve_risk_source_mode == "inactive":
        inactive_reason = "stale_source_lag"
        if (
            reserve_risk_primary_lag_days is not None
            and reserve_risk_disable_lag_days is not None
            and reserve_risk_primary_lag_days > reserve_risk_disable_lag_days
        ):
            inactive_reason = "primary_source_stale"

        inactive_indicators.append(
            {
                "key": "reserveRisk",
                "reason": inactive_reason,
                "sourceDate": reserve_risk_date,
                "primarySourceDate": reserve_risk_primary_date,
                "latestDate": date_value,
                "lagDays": reserve_risk_lag_days,
                "primaryLagDays": reserve_risk_primary_lag_days,
                "disableLagDays": reserve_risk_disable_lag_days,
                "replacementCandidates": ["lth_mvrv", "mvrv_zscore_data"],
            }
        )

    latest_payload = {
        "date": date_value,
        "btcPrice": _safe_float(last["btc_price"]) or 0.0,
        "realizedPrice": _safe_float(last["realized_price"]) or 0.0,
        "priceMa200wRatio": _safe_float(last["price_200w_ma_ratio"]) or 0.0,
        "priceRealizedRatio": _safe_float(last["price_realized_ratio"]) or 0.0,
        "reserveRisk": _safe_float(last["reserve_risk"]) or 0.0,
        "lthMvrv": _safe_float(last["lth_mvrv"]),
        "mvrvZscore": _safe_float(last["mvrv_zscore"]),
        "sthSopr": _safe_float(last["sth_sopr"]) or 0.0,
        "sthMvrv": _safe_float(last["sth_mvrv"]) or 0.0,
        "ma200w": _safe_float(last["ma200w"]),
        "puellMultiple": _safe_float(last["puell_multiple"]) or 0.0,
        "signalCount": int(last["signal_count"]),
        "activeIndicatorCount": int(last["active_indicator_count"]),
        "signalScoreV2": int(last["signal_score_v2"]),
        "maxSignalScoreV2": int(last["max_signal_score_v2"]),
        "signalScoreV2Min3d": _safe_float(last["signal_score_v2_min3d"]),
        "signalConfirmed3d": bool(last["signal_confirmed_3d"]),
        "signalBandV2": str(last["signal_band_v2"]),
        "scoreReserveRiskPrimary": int(last["score_reserve_risk_primary"]),
        "scoreReserveRiskReplacement": int(last["score_reserve_risk_replacement"]),
        "scoreLthMvrv": int(last["score_lth_mvrv"]),
        "scoreMvrvZscore": int(last["score_mvrv_zscore"]),
        "scoreSthGroup": int(last["score_sth_group"]),
        "signalSthGroup": bool(last["signal_sth_group"]),
        "scoringModelVersion": SCORING_MODEL_VERSION,
        "reserveRiskActive": reserve_risk_active,
        "reserveRiskReplacementActive": reserve_risk_replacement_active,
        "reserveRiskReplacementSource": reserve_risk_replacement_source,
        "reserveRiskReplacementLagDays": reserve_risk_replacement_lag_days,
        "reserveRiskSourceMode": reserve_risk_source_mode,
        "reserveRiskLagDays": reserve_risk_lag_days,
        "reserveRiskPrimaryLagDays": reserve_risk_primary_lag_days,
        "inactiveIndicators": inactive_indicators,
        "signals": {
            "priceMa200w": bool(last["signal_price_ma200w"]),
            "priceRealized": bool(last["signal_price_realized"]),
            "reserveRisk": bool(last["signal_reserve_risk"]),
            "sthSopr": bool(last["signal_sth_sopr"]),
            "sthMvrv": bool(last["signal_sth_mvrv"]),
            "sthGroup": bool(last["signal_sth_group"]),
            "puell": bool(last["signal_puell"]),
        },
        "indicatorDates": {
            "priceMa200w": _safe_iso_date(last["btc_price_date"]) or date_value,
            "priceRealized": _safe_iso_date(last["realized_price_date"]) or date_value,
            "reserveRisk": reserve_risk_effective_date,
            "sthSopr": _safe_iso_date(last["sth_sopr_date"]) or date_value,
            "sthMvrv": _safe_iso_date(last["sth_mvrv_date"]) or date_value,
            "puell": _safe_iso_date(last["puell_multiple_date"]) or date_value,
        },
        "thresholds": thresholds,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }
    return latest_payload


def build_light_history_json(
    history_json: List[Dict[str, object]],
    years: int = 8,
) -> List[Dict[str, object]]:
    """Build lightweight recent history subset for frontend default loading."""
    if not history_json:
        return []

    latest_date_str = str(history_json[-1].get("d", ""))
    latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d")
    cutoff = latest_date - pd.Timedelta(days=365 * years)

    light: List[Dict[str, object]] = []
    for row in history_json:
        date_str = str(row.get("d", ""))
        if not date_str:
            continue
        row_date = datetime.strptime(date_str, "%Y-%m-%d")
        if row_date >= cutoff:
            light.append(row)
    return light


def build_manifest_json(
    latest_json: Dict[str, object],
    history_rows: int,
    light_rows: int,
    thresholds: Dict[str, Dict[str, object]],
) -> Dict[str, object]:
    """Build a small manifest for observability/debugging and cache-busting hints."""
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "latestDate": latest_json.get("date"),
        "lastUpdated": latest_json.get("lastUpdated"),
        "historyRows": history_rows,
        "historyLightRows": light_rows,
        "schemaVersion": "v3",
        "indicatorSet": "core6_bottom_v2_sth_grouped",
        "scoringModelVersion": latest_json.get("scoringModelVersion", SCORING_MODEL_VERSION),
        "thresholds": thresholds,
        "activeIndicatorCount": latest_json.get("activeIndicatorCount", SCORING_INDICATOR_COUNT),
        "maxSignalScoreV2": latest_json.get("maxSignalScoreV2", SCORING_INDICATOR_COUNT * 2),
        "reserveRiskSourceMode": latest_json.get("reserveRiskSourceMode", "primary"),
        "inactiveIndicators": latest_json.get("inactiveIndicators", []),
    }


def write_json(path: Path, payload: object) -> None:
    """Write JSON with stable formatting and UTF-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def save_tabular_outputs(df: pd.DataFrame, output_dir: Path, file_prefix: str) -> Dict[str, Path]:
    """Save DataFrame to CSV and XLSX."""
    output_dir.mkdir(parents=True, exist_ok=True)
    saved: Dict[str, Path] = {}

    csv_path = output_dir / f"{file_prefix}.csv"
    df.to_csv(csv_path, index=False)
    saved["csv"] = csv_path

    xlsx_path = output_dir / f"{file_prefix}.xlsx"
    try:
        df.to_excel(xlsx_path, index=False, sheet_name="BTC_Indicators")
        saved["xlsx"] = xlsx_path
    except Exception as exc:
        print(f"Excel save skipped: {exc}")

    return saved


def print_summary(
    tabular_df: pd.DataFrame,
    sources: Dict[str, str],
    history_path: Path,
    history_light_path: Path,
    latest_path: Path,
    manifest_path: Path,
    history_rows: int,
    light_rows: int,
) -> None:
    """Print concise run summary."""
    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)

    print(f"Rows: {len(tabular_df):,}")
    if not tabular_df.empty:
        print(f"Date range: {tabular_df['Date'].min().date()} -> {tabular_df['Date'].max().date()}")
        print("Latest 5 rows:")
        print(tabular_df.tail(5).to_string(index=False))

    print()
    print("Source URLs used:")
    for key in [
        "btc_price",
        "ma200w",
        "realized_price",
        "reserve_risk",
        "lth_mvrv",
        "mvrv_zscore",
        "sth_sopr",
        "sth_mvrv",
        "puell_multiple",
    ]:
        print(f"  - {key}: {sources.get(key, '-')}")

    print()
    print("Frontend JSON files:")
    print(f"  - history      : {history_path} ({history_rows} rows)")
    print(f"  - history light: {history_light_path} ({light_rows} rows)")
    print(f"  - latest       : {latest_path}")
    print(f"  - manifest     : {manifest_path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch BTC indicator history with BGeometrics chart-file endpoints."
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Output folder for CSV/XLSX files (default: current directory).",
    )
    parser.add_argument(
        "--file-prefix",
        default="btc_indicators_from_files",
        help="Output file name prefix (default: btc_indicators_from_files).",
    )
    parser.add_argument(
        "--start-date",
        default=None,
        help="Optional start date, format YYYY-MM-DD.",
    )
    parser.add_argument(
        "--end-date",
        default=None,
        help="Optional end date, format YYYY-MM-DD.",
    )
    parser.add_argument(
        "--history-json-path",
        default="app/public/btc_indicators_history.json",
        help="Frontend history JSON output path.",
    )
    parser.add_argument(
        "--latest-json-path",
        default="app/public/btc_indicators_latest.json",
        help="Frontend latest JSON output path.",
    )
    parser.add_argument(
        "--history-light-json-path",
        default="app/public/btc_indicators_history_light.json",
        help="Frontend lightweight history JSON output path.",
    )
    parser.add_argument(
        "--history-light-years",
        type=int,
        default=8,
        help="Number of recent years to keep in lightweight history JSON.",
    )
    parser.add_argument(
        "--manifest-json-path",
        default="app/public/btc_indicators_manifest.json",
        help="Frontend manifest JSON output path.",
    )
    parser.add_argument(
        "--skip-tabular",
        action="store_true",
        help="Skip CSV/XLSX outputs and only write frontend JSON files.",
    )
    parser.add_argument(
        "--reserve-risk-disable-lag-days",
        type=int,
        default=DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
        help=(
            "Auto-exclude Reserve Risk from scoring when its source date lags behind latest date "
            "by more than this many days."
        ),
    )
    args = parser.parse_args()

    base_df, sources, reserve_primary_last_date = build_base_dataframe(args.start_date, args.end_date)
    if base_df.empty:
        print("No data after filtering. Nothing saved.")
        return 1

    frontend_df, thresholds = enrich_for_frontend(
        base_df,
        reserve_risk_disable_lag_days=args.reserve_risk_disable_lag_days,
        reserve_risk_primary_last_date=reserve_primary_last_date,
    )
    tabular_df = build_tabular_view(frontend_df)

    history_json = dataframe_to_history_json(frontend_df)
    latest_json = build_latest_json(frontend_df, thresholds=thresholds)
    history_light_json = build_light_history_json(history_json, years=max(1, args.history_light_years))
    manifest_json = build_manifest_json(
        latest_json=latest_json,
        history_rows=len(history_json),
        light_rows=len(history_light_json),
        thresholds=thresholds,
    )

    history_path = Path(args.history_json_path)
    history_light_path = Path(args.history_light_json_path)
    latest_path = Path(args.latest_json_path)
    manifest_path = Path(args.manifest_json_path)
    write_json(history_path, history_json)
    write_json(history_light_path, history_light_json)
    write_json(latest_path, latest_json)
    write_json(manifest_path, manifest_json)

    saved_files: Dict[str, Path] = {}
    if not args.skip_tabular:
        saved_files = save_tabular_outputs(tabular_df, Path(args.output_dir), args.file_prefix)

    print()
    if saved_files:
        print("Saved tabular files:")
        for kind, path in saved_files.items():
            print(f"  - {kind}: {path}")
    else:
        print("Tabular export skipped (--skip-tabular).")

    print_summary(
        tabular_df=tabular_df,
        sources=sources,
        history_path=history_path,
        history_light_path=history_light_path,
        latest_path=latest_path,
        manifest_path=manifest_path,
        history_rows=len(history_json),
        light_rows=len(history_light_json),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
