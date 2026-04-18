#!/usr/bin/env python3
"""
Fetch BTC indicator history from BGeometrics chart JSON files.

Data sources:
  - https://charts.bgeometrics.com/files/*.json

Outputs:
  1. Tabular files (CSV/XLSX) for offline analysis
  2. Frontend static files used by the Vite app:
     - app/public/btc_indicators_history.json
     - app/public/btc_indicators_history_light.json
     - app/public/btc_indicators_latest.json
     - app/public/btc_indicators_manifest.json

Core-6 bottom indicators (V4 layered model):
  - BTC Price / 200W-MA (calculated)
  - BTC Price / Realized Price (calculated)
  - Reserve Risk
  - Puell Multiple
  - STH-MVRV
  - LTH-MVRV

Auxiliary indicators:
  - STH-SOPR
  - MVRV Z-Score (soft Reserve Risk fallback)
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

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
SCORING_INDICATOR_COUNT_V4 = 6
SCORE_CONFIRM_RATIO = 7 / 12
DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS = 30
LEGACY_SCORING_MODEL_VERSION = "v3_no_lookahead_replacement"
SCORING_MODEL_VERSION = "v4_core6_mvrv_substitute"
SCHEMA_VERSION = "v4"
INDICATOR_SET = "core6_bottom_v4_mvrv_substitute"
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
    "mvrv_zscore": 7,
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


def fetch_json_payload(url: str) -> object:
    """Fetch a JSON payload from URL with retry."""
    headers = {"User-Agent": "btc-monitor-history-fetcher/1.1"}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            try:
                return response.json()
            except Exception:
                payload = _extract_json_from_response_text(response.text)
                if payload is None:
                    raise
                return payload
        except Exception:
            if attempt == MAX_RETRIES:
                raise
            wait_sec = RETRY_BACKOFF_SEC * attempt
            time.sleep(wait_sec)

    return []


def fetch_json(url: str) -> List[List[object]]:
    """Fetch a `[timestamp_ms, value]` list from URL with retry."""
    payload = fetch_json_payload(url)
    if not isinstance(payload, list):
        raise ValueError(f"Unexpected JSON type from {url}: {type(payload)}")

    return payload


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


def parse_reserve_risk_history_series(raw_rows: object) -> pd.DataFrame:
    """Parse Reserve Risk history from either dict-list or chart-file array formats."""
    if not isinstance(raw_rows, list):
        return pd.DataFrame(columns=["date", "reserve_risk"])

    if raw_rows and isinstance(raw_rows[0], list):
        return parse_series("reserve_risk", raw_rows)

    parsed: List[Dict[str, object]] = []
    for row in raw_rows:
        if not isinstance(row, dict):
            continue

        date_raw = _safe_iso_date(row.get("d"))
        if not date_raw:
            continue

        try:
            date_value = pd.to_datetime(date_raw)
        except Exception:
            continue

        parsed.append(
            {
                "date": date_value,
                "reserve_risk": _safe_float(row.get("reserveRisk")),
            }
        )

    if not parsed:
        return pd.DataFrame(columns=["date", "reserve_risk"])

    df = pd.DataFrame(parsed)
    return df.sort_values("date").groupby("date", as_index=False).last()


def fetch_metric(
    metric_key: str, config: Dict[str, object]
) -> Tuple[pd.DataFrame, str]:
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


def _reserve_risk_source_priority(source_key: str) -> int:
    config = RESERVE_RISK_SOURCE_REGISTRY.get(source_key, {})
    raw_priority = config.get("priority", 999)
    try:
        return int(raw_priority)
    except (TypeError, ValueError):
        return 999


def _summarize_reserve_risk_series(
    df: pd.DataFrame, source_key: str
) -> Dict[str, object]:
    config = RESERVE_RISK_SOURCE_REGISTRY.get(source_key, {})
    summary: Dict[str, object] = {
        "key": source_key,
        "displayName": str(config.get("display_name", source_key)),
        "mode": "series",
        "priority": _reserve_risk_source_priority(source_key),
        "latestObservedDate": None,
        "latestObservedValue": None,
        "latestNonNullDate": None,
        "latestNonNullValue": None,
        "trailingNullRows": 0,
        "trailingNullDays": 0,
        "healthStatus": "missing",
    }

    if df.empty or "date" not in df.columns or "reserve_risk" not in df.columns:
        return summary

    sorted_df = df.copy()
    sorted_df["date"] = pd.to_datetime(sorted_df["date"])
    sorted_df = sorted_df.sort_values("date").reset_index(drop=True)
    latest_row = sorted_df.iloc[-1]
    latest_date = pd.to_datetime(latest_row["date"])
    latest_value = _safe_float(latest_row.get("reserve_risk"))
    summary["latestObservedDate"] = _safe_iso_date(latest_date)
    summary["latestObservedValue"] = latest_value

    non_null = sorted_df.loc[sorted_df["reserve_risk"].notna()]
    if non_null.empty:
        summary["healthStatus"] = "no_non_null_values"
        return summary

    latest_non_null_row = non_null.iloc[-1]
    latest_non_null_date = pd.to_datetime(latest_non_null_row["date"])
    latest_non_null_value = _safe_float(latest_non_null_row.get("reserve_risk"))
    summary["latestNonNullDate"] = _safe_iso_date(latest_non_null_date)
    summary["latestNonNullValue"] = latest_non_null_value

    trailing_null_rows = 0
    if latest_value is None:
        for value in reversed(sorted_df["reserve_risk"].tolist()):
            if _safe_float(value) is None:
                trailing_null_rows += 1
            else:
                break

    trailing_null_days = (
        int((latest_date - latest_non_null_date).days) if latest_value is None else 0
    )
    summary["trailingNullRows"] = trailing_null_rows
    summary["trailingNullDays"] = trailing_null_days
    summary["healthStatus"] = "null_tail" if latest_value is None else "healthy"
    return summary


def fetch_reserve_risk_series_sources() -> Dict[str, Dict[str, object]]:
    candidates: Dict[str, Dict[str, object]] = {}

    for source_key, config in RESERVE_RISK_SOURCE_REGISTRY.items():
        if str(config.get("mode")) != "series":
            continue

        urls = [str(url) for url in config.get("urls", [])]
        candidate: Dict[str, object] = {
            "key": source_key,
            "displayName": str(config.get("display_name", source_key)),
            "mode": "series",
            "priority": _reserve_risk_source_priority(source_key),
            "available": False,
            "selectedUrl": None,
            "dataframe": pd.DataFrame(columns=["date", "reserve_risk"]),
            "error": None,
        }
        errors: List[str] = []

        for url in urls:
            try:
                payload = fetch_json_payload(url)
                parsed_df = parse_reserve_risk_history_series(payload)
                if parsed_df.empty:
                    errors.append(f"{url} -> empty Reserve Risk history")
                    continue

                candidate["available"] = True
                candidate["selectedUrl"] = url
                candidate["dataframe"] = parsed_df
                break
            except Exception as exc:
                errors.append(f"{url} -> {exc}")
                continue

        if not bool(candidate["available"]):
            candidate["error"] = " | ".join(errors[-3:]) if errors else "no usable source"

        candidates[source_key] = candidate

    return candidates


def merge_reserve_risk_history_sources(
    legacy_df: pd.DataFrame, recent_df: pd.DataFrame
) -> pd.DataFrame:
    if legacy_df.empty and recent_df.empty:
        return pd.DataFrame(columns=["date", "reserve_risk"])
    if legacy_df.empty:
        return recent_df.copy().sort_values("date").reset_index(drop=True)
    if recent_df.empty:
        return legacy_df.copy().sort_values("date").reset_index(drop=True)

    merged = pd.concat(
        [
            legacy_df.assign(
                _source_rank=0,
                _non_null_rank=legacy_df["reserve_risk"].notna().astype(int),
            ),
            recent_df.assign(
                _source_rank=1,
                _non_null_rank=recent_df["reserve_risk"].notna().astype(int),
            ),
        ],
        ignore_index=True,
    )
    merged["date"] = pd.to_datetime(merged["date"])
    merged = merged.sort_values(
        ["date", "_non_null_rank", "_source_rank"]
    ).drop_duplicates(subset=["date"], keep="last")
    return merged.drop(columns=["_source_rank", "_non_null_rank"]).reset_index(
        drop=True
    )


def _build_reserve_risk_source_label(
    primary_candidate: Dict[str, object] | None,
    legacy_candidate: Dict[str, object] | None = None,
    recent_df: pd.DataFrame | None = None,
) -> str:
    primary_url = (
        str(primary_candidate.get("selectedUrl"))
        if primary_candidate and primary_candidate.get("selectedUrl")
        else "-"
    )
    if not legacy_candidate or recent_df is None or recent_df.empty:
        return primary_url

    legacy_url = (
        str(legacy_candidate.get("selectedUrl"))
        if legacy_candidate.get("selectedUrl")
        else "-"
    )
    recent_start = _safe_iso_date(pd.to_datetime(recent_df["date"]).min()) or "recent"
    return f"{primary_url} + legacy_bridge({legacy_url} < {recent_start})"


def fetch_reserve_risk_point_sources() -> Dict[str, Dict[str, object]]:
    candidates: Dict[str, Dict[str, object]] = {}

    for source_key, config in RESERVE_RISK_SOURCE_REGISTRY.items():
        if str(config.get("mode")) != "point":
            continue

        urls = [str(url) for url in config.get("urls", [])]
        candidate: Dict[str, object] = {
            "key": source_key,
            "displayName": str(config.get("display_name", source_key)),
            "mode": "point",
            "priority": _reserve_risk_source_priority(source_key),
            "available": False,
            "selectedUrl": None,
            "date": None,
            "value": None,
            "error": None,
        }
        errors: List[str] = []

        for url in urls:
            try:
                payload = fetch_json_payload(url)
                parsed = _parse_reserve_risk_point(payload)
                if parsed is None:
                    errors.append(f"{url} -> invalid Reserve Risk payload")
                    continue

                candidate["available"] = True
                candidate["selectedUrl"] = url
                candidate["date"] = parsed[0]
                candidate["value"] = parsed[1]
                break
            except Exception as exc:
                errors.append(f"{url} -> {exc}")
                continue

        if not bool(candidate["available"]):
            candidate["error"] = " | ".join(errors[-3:]) if errors else "no usable source"

        candidates[source_key] = candidate

    return candidates


def select_best_reserve_risk_point_source(
    candidates: Dict[str, Dict[str, object]]
) -> Dict[str, object] | None:
    available = [candidate for candidate in candidates.values() if candidate.get("available")]
    if not available:
        return None

    def sort_key(candidate: Dict[str, object]) -> Tuple[pd.Timestamp, int]:
        candidate_date = candidate.get("date")
        if isinstance(candidate_date, pd.Timestamp):
            normalized_date = candidate_date
        else:
            normalized_date = pd.Timestamp("1900-01-01")
        return normalized_date, -int(candidate.get("priority", 999))

    return max(available, key=sort_key)


def build_reserve_risk_source_diagnostics(
    primary_df: pd.DataFrame,
    point_candidates: Dict[str, Dict[str, object]],
    applied_point_source: Dict[str, object] | None = None,
    primary_source_key: str = "bgeometrics_primary",
    supporting_series: Dict[str, pd.DataFrame] | None = None,
    assembled_df: pd.DataFrame | None = None,
    assembled_source_label: str | None = None,
) -> Dict[str, object]:
    diagnostics: Dict[str, object] = {
        "primarySeries": _summarize_reserve_risk_series(primary_df, primary_source_key),
        "supportingSeries": [],
        "assembledSeries": None,
        "pointSources": [],
        "selectedPointSourceKey": (
            str(applied_point_source.get("key")) if applied_point_source else None
        ),
        "selectedPointSourceApplied": bool(applied_point_source),
        "shadowCompare": None,
    }

    primary_summary = diagnostics["primarySeries"]
    sorted_primary = primary_df.copy()
    if not sorted_primary.empty and "date" in sorted_primary.columns:
        sorted_primary["date"] = pd.to_datetime(sorted_primary["date"])
        sorted_primary = sorted_primary.sort_values("date").reset_index(drop=True)

    supporting_list: List[Dict[str, object]] = []
    for source_key, df in (supporting_series or {}).items():
        supporting_list.append(_summarize_reserve_risk_series(df, source_key))
    diagnostics["supportingSeries"] = supporting_list

    if assembled_df is not None:
        assembled_summary = _summarize_reserve_risk_series(
            assembled_df, source_key="assembled_bridge"
        )
        assembled_summary["key"] = "assembled_bridge"
        assembled_summary["displayName"] = "Reserve Risk assembled history"
        assembled_summary["mode"] = "assembled"
        assembled_summary["sourceLabel"] = assembled_source_label
        diagnostics["assembledSeries"] = assembled_summary

    point_source_list: List[Dict[str, object]] = []
    for candidate in sorted(
        point_candidates.values(),
        key=lambda item: int(item.get("priority", 999)),
    ):
        point_source_list.append(
            {
                "key": candidate.get("key"),
                "displayName": candidate.get("displayName"),
                "mode": candidate.get("mode"),
                "priority": candidate.get("priority"),
                "available": bool(candidate.get("available")),
                "selectedUrl": candidate.get("selectedUrl"),
                "latestDate": _safe_iso_date(candidate.get("date")),
                "latestValue": _safe_float(candidate.get("value")),
                "error": candidate.get("error"),
            }
        )
    diagnostics["pointSources"] = point_source_list

    best_candidate = select_best_reserve_risk_point_source(point_candidates)
    if best_candidate:
        candidate_date = best_candidate.get("date")
        candidate_value = _safe_float(best_candidate.get("value"))
        primary_same_day_value = None
        same_day_available = False
        primary_latest_non_null_date = primary_summary.get("latestNonNullDate")
        primary_latest_non_null_value = primary_summary.get("latestNonNullValue")

        if isinstance(candidate_date, pd.Timestamp) and not primary_df.empty:
            same_day_rows = primary_df.loc[
                pd.to_datetime(primary_df["date"]) == candidate_date
            ]
            if not same_day_rows.empty:
                same_day_available = True
                primary_same_day_value = _safe_float(
                    same_day_rows.iloc[-1].get("reserve_risk")
                )

        latest_date_gap_days = None
        if (
            isinstance(candidate_date, pd.Timestamp)
            and isinstance(primary_summary.get("latestObservedDate"), str)
            and primary_summary.get("latestObservedDate")
        ):
            latest_date_gap_days = int(
                (
                    candidate_date
                    - pd.to_datetime(str(primary_summary.get("latestObservedDate")))
                ).days
            )

        status = "candidate_only"
        same_date_delta = None
        same_date_ratio = None
        if same_day_available and primary_same_day_value is not None and candidate_value is not None:
            status = "same_day_comparable"
            same_date_delta = candidate_value - primary_same_day_value
            same_date_ratio = (
                candidate_value / primary_same_day_value
                if primary_same_day_value not in (None, 0)
                else None
            )
        elif same_day_available:
            status = "primary_same_day_missing"

        diagnostics["shadowCompare"] = {
            "candidateKey": best_candidate.get("key"),
            "candidateDisplayName": best_candidate.get("displayName"),
            "candidateLatestDate": _safe_iso_date(candidate_date),
            "candidateLatestValue": candidate_value,
            "primaryLatestObservedDate": primary_summary.get("latestObservedDate"),
            "primaryLatestObservedValue": primary_summary.get("latestObservedValue"),
            "primaryLatestNonNullDate": primary_latest_non_null_date,
            "primaryLatestNonNullValue": primary_latest_non_null_value,
            "sameDayComparable": bool(
                same_day_available
                and primary_same_day_value is not None
                and candidate_value is not None
            ),
            "primarySameDayAvailable": same_day_available,
            "primarySameDayValue": primary_same_day_value,
            "sameDayDelta": same_date_delta,
            "sameDayRatio": same_date_ratio,
            "latestDateGapDays": latest_date_gap_days,
            "status": status,
        }

    return diagnostics


def _safe_int(value: object) -> int | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    return int(parsed)


def build_reserve_risk_history_dataframe() -> Tuple[
    pd.DataFrame,
    str,
    pd.Timestamp | None,
    Dict[str, object],
]:
    series_candidates = fetch_reserve_risk_series_sources()
    recent_candidate = series_candidates.get("bitcoin_data_history", {})
    legacy_candidate = series_candidates.get("bgeometrics_primary", {})

    recent_df = recent_candidate.get("dataframe")
    if not isinstance(recent_df, pd.DataFrame):
        recent_df = pd.DataFrame(columns=["date", "reserve_risk"])
    legacy_df = legacy_candidate.get("dataframe")
    if not isinstance(legacy_df, pd.DataFrame):
        legacy_df = pd.DataFrame(columns=["date", "reserve_risk"])

    use_recent_primary = bool(recent_candidate.get("available")) and not recent_df.empty
    primary_df = recent_df if use_recent_primary else legacy_df
    primary_source_key = (
        "bitcoin_data_history" if use_recent_primary else "bgeometrics_primary"
    )
    assembled_df = (
        merge_reserve_risk_history_sources(legacy_df, recent_df)
        if use_recent_primary
        else legacy_df.copy()
    )
    source_label = _build_reserve_risk_source_label(
        primary_candidate=recent_candidate if use_recent_primary else legacy_candidate,
        legacy_candidate=legacy_candidate if use_recent_primary else None,
        recent_df=recent_df if use_recent_primary else None,
    )

    point_candidates = fetch_reserve_risk_point_sources()
    patched_df, patch_info = patch_reserve_risk_tail(
        assembled_df,
        point_candidates=point_candidates,
    )
    if patch_info:
        source_label = f"{source_label} + point_backup({patch_info['appliedLabel']})"

    reserve_non_null = primary_df.loc[primary_df["reserve_risk"].notna(), "date"]
    reserve_last_date = (
        pd.to_datetime(reserve_non_null.max()) if not reserve_non_null.empty else None
    )
    diagnostics = build_reserve_risk_source_diagnostics(
        primary_df=primary_df,
        point_candidates=point_candidates,
        applied_point_source=patch_info,
        primary_source_key=primary_source_key,
        supporting_series=(
            {"bgeometrics_primary": legacy_df}
            if use_recent_primary and not legacy_df.empty
            else None
        ),
        assembled_df=patched_df,
        assembled_source_label=source_label,
    )
    return patched_df, source_label, reserve_last_date, diagnostics


def patch_reserve_risk_tail(
    df: pd.DataFrame,
    point_candidates: Dict[str, Dict[str, object]] | None = None,
) -> Tuple[pd.DataFrame, Dict[str, object] | None]:
    if df.empty or "date" not in df.columns or "reserve_risk" not in df.columns:
        return df, None

    if point_candidates is None:
        point_candidates = fetch_reserve_risk_point_sources()

    backup_point = select_best_reserve_risk_point_source(point_candidates)
    if not backup_point:
        return df, None

    backup_date = backup_point.get("date")
    backup_value = _safe_float(backup_point.get("value"))
    backup_source = str(backup_point.get("selectedUrl"))
    if not isinstance(backup_date, pd.Timestamp) or backup_value is None:
        return df, None

    patched = df.copy()
    patched["date"] = pd.to_datetime(patched["date"])
    patched = patched.sort_values("date").reset_index(drop=True)

    same_day = patched["date"] == backup_date
    if same_day.any():
        current_value = _safe_float(patched.loc[same_day, "reserve_risk"].iloc[-1])
        if current_value is not None and abs(current_value - backup_value) < 1e-12:
            return patched, None
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
        patched = (
            patched.sort_values("date")
            .drop_duplicates(subset=["date"], keep="last")
            .reset_index(drop=True)
        )

    applied_info = {
        "key": backup_point.get("key"),
        "displayName": backup_point.get("displayName"),
        "selectedUrl": backup_source,
        "date": backup_date,
        "value": backup_value,
        "appliedLabel": (
            f"{backup_date.strftime('%Y-%m-%d')} -> {backup_value:.10f} "
            f"(source: {backup_source})"
        ),
    }
    return patched, applied_info


def build_base_dataframe(
    start_date: str | None = None,
    end_date: str | None = None,
) -> Tuple[pd.DataFrame, Dict[str, str], pd.Timestamp | None, Dict[str, object]]:
    """Fetch all required data and build merged base DataFrame."""
    dfs: Dict[str, pd.DataFrame] = {}
    selected_sources: Dict[str, str] = {}

    print("=" * 72)
    print("BTC Indicators History (hybrid reserve source mode)")
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

    print("Fetching Reserve Risk ...")
    reserve_df, reserve_source_label, reserve_primary_last_date, reserve_risk_diagnostics = (
        build_reserve_risk_history_dataframe()
    )
    dfs["reserve_risk"] = reserve_df
    selected_sources["reserve_risk"] = reserve_source_label
    print(f"  Rows: {len(reserve_df):,} | Source: {reserve_source_label}")

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
        merged = (
            current
            if merged is None
            else pd.merge(merged, current, on="date", how="outer")
        )

    assert merged is not None
    merged = merged.sort_values("date").reset_index(drop=True)

    if start_date:
        merged = merged[merged["date"] >= pd.to_datetime(start_date)]
    if end_date:
        merged = merged[merged["date"] <= pd.to_datetime(end_date)]

    return (
        merged.reset_index(drop=True),
        selected_sources,
        reserve_primary_last_date,
        reserve_risk_diagnostics,
    )


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
    history = numeric_values.shift(1).rolling(
        window=max(2, int(window_days)), min_periods=max(2, int(min_history_days))
    )
    trigger_series = history.quantile(trigger_quantile).fillna(fallback_trigger)
    deep_series = history.quantile(deep_quantile).fillna(fallback_deep)
    deep_series = pd.concat([deep_series, trigger_series], axis=1).min(axis=1)
    return trigger_series, deep_series


def _classify_score_band(score: int, max_score: int) -> str:
    if max_score <= 0:
        return "watch"

    normalized_score = (score / max_score) * 12
    if normalized_score < 4:
        return "watch"
    if normalized_score < 7:
        return "focus"
    if normalized_score < 10:
        return "accumulate"
    return "extreme_bottom"


def _freshness_score_series(lag_days: pd.Series, max_lag_days: int) -> pd.Series:
    safe_max_lag = max(1, int(max_lag_days))
    numeric_lag = pd.to_numeric(lag_days, errors="coerce")
    freshness = 1 - (numeric_lag.clip(lower=0) / safe_max_lag)
    freshness = freshness.clip(lower=0, upper=1)
    return freshness.where(numeric_lag.notna(), 0.0)


def _score_band_thresholds(max_score: int) -> Dict[str, int]:
    safe_max = max(1, int(max_score))
    return {
        "focus": max(1, math.ceil((safe_max * 4) / 12)),
        "accumulate": max(1, math.ceil((safe_max * 7) / 12)),
        "extreme_bottom": max(1, math.ceil((safe_max * 10) / 12)),
    }


def enrich_for_frontend(
    base_df: pd.DataFrame,
    reserve_risk_disable_lag_days: int = DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
    reserve_risk_primary_last_date: pd.Timestamp | None = None,
) -> Tuple[pd.DataFrame, Dict[str, Dict[str, object]]]:
    """Build frontend-ready columns including legacy V2 and layered V4 scores."""
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

    for col in metric_cols:
        date_col = f"{col}_date"
        df[date_col] = df["date"].where(df[col].notna(), pd.NaT).ffill()

    for col in metric_cols:
        df[col] = df[col].ffill()

    if reserve_risk_primary_last_date is None:
        reserve_primary_series = df.loc[df["reserve_risk"].notna(), "date"]
        reserve_risk_primary_last_date = (
            pd.to_datetime(reserve_primary_series.max())
            if not reserve_primary_series.empty
            else None
        )

    for col in metric_cols:
        lag_col = f"{col}_lag_days"
        df[lag_col] = (df["date"] - df[f"{col}_date"]).dt.days
        freshness_limit = INDICATOR_FRESHNESS_MAX_LAG_DAYS[col]
        df[f"{col}_freshness_score"] = _freshness_score_series(
            df[lag_col], freshness_limit
        )
        df[f"{col}_is_fresh"] = (
            pd.to_numeric(df[lag_col], errors="coerce")
            .fillna(freshness_limit + 1)
            .le(freshness_limit)
        )

    reserve_primary_date = (
        pd.to_datetime(reserve_risk_primary_last_date)
        if reserve_risk_primary_last_date is not None
        else pd.NaT
    )
    df["reserve_risk_primary_date"] = reserve_primary_date
    if pd.isna(reserve_primary_date):
        df["reserve_risk_primary_lag_days"] = pd.NA
        reserve_primary_is_fresh = pd.Series(False, index=df.index)
    else:
        df["reserve_risk_primary_lag_days"] = (
            df["date"] - reserve_primary_date
        ).dt.days
        reserve_primary_is_fresh = df["reserve_risk_primary_lag_days"].le(
            reserve_risk_disable_lag_days
        )

    df["reserve_risk_active"] = (
        df["reserve_risk_date"].notna()
        & reserve_primary_is_fresh
        & df["reserve_risk_lag_days"]
        .fillna(reserve_risk_disable_lag_days + 1)
        .le(reserve_risk_disable_lag_days)
    )
    df["reserve_risk_disable_lag_days"] = reserve_risk_disable_lag_days

    df["price_200w_ma_ratio"] = df["btc_price"] / df["ma200w"].replace(0, pd.NA)
    df["price_realized_ratio"] = df["btc_price"] / df["realized_price"].replace(
        0, pd.NA
    )

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
    df["reserve_risk_trigger"] = reserve_trigger_series
    df["reserve_risk_deep"] = reserve_deep_series
    df["sth_sopr_trigger"] = sth_sopr_trigger_series
    df["sth_sopr_deep"] = sth_sopr_deep_series
    df["sth_mvrv_trigger"] = sth_mvrv_trigger_series
    df["sth_mvrv_deep"] = sth_mvrv_deep_series

    df["score_price_ma200w"] = df["price_200w_ma_ratio"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["price_ma200w_ratio"]["trigger"],
            THRESHOLD_STATIC["price_ma200w_ratio"]["deep"],
        )
    )
    df["score_price_realized"] = df["price_realized_ratio"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["price_realized_ratio"]["trigger"],
            THRESHOLD_STATIC["price_realized_ratio"]["deep"],
        )
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
    df["score_sth_group"] = df[["score_sth_sopr", "score_sth_mvrv"]].max(axis=1)
    df["score_puell"] = df["puell_multiple"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["puell_multiple"]["trigger"],
            THRESHOLD_STATIC["puell_multiple"]["deep"],
        )
    )
    df["score_lth_mvrv"] = df["lth_mvrv"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["lth_mvrv"]["trigger"],
            THRESHOLD_STATIC["lth_mvrv"]["deep"],
        )
    )
    df["score_mvrv_zscore"] = df["mvrv_zscore"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["mvrv_zscore"]["trigger"],
            THRESHOLD_STATIC["mvrv_zscore"]["deep"],
        )
    )
    df["lth_mvrv_lag_days"] = (df["date"] - df["lth_mvrv_date"]).dt.days
    df["mvrv_zscore_lag_days"] = (df["date"] - df["mvrv_zscore_date"]).dt.days
    df["mvrv_zscore_core_active"] = (
        df["mvrv_zscore_date"].notna() & df["mvrv_zscore_is_fresh"]
    )
    df["score_mvrv_zscore_core"] = np.where(
        df["mvrv_zscore_core_active"], df["score_mvrv_zscore"], 0
    ).astype(int)

    # Legacy V2/V3 Reserve Risk replacement logic kept for rollback compatibility.
    df["score_reserve_risk_replacement"] = df[
        ["score_lth_mvrv", "score_mvrv_zscore"]
    ].max(axis=1)
    replacement_lag_legacy = df[["lth_mvrv_lag_days", "mvrv_zscore_lag_days"]].min(
        axis=1, skipna=True
    )
    replacement_available_mask = (
        df[["lth_mvrv_date", "mvrv_zscore_date"]].notna().any(axis=1)
    )
    df["reserve_risk_replacement_lag_days"] = replacement_lag_legacy.where(
        replacement_available_mask, pd.NA
    )
    df["reserve_risk_replacement_active"] = ~df["reserve_risk_active"] & df[
        "reserve_risk_replacement_lag_days"
    ].fillna(reserve_risk_disable_lag_days + 1).le(reserve_risk_disable_lag_days)
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
    legacy_replacement_mask = (
        ~df["reserve_risk_active"] & df["reserve_risk_replacement_active"]
    )
    df.loc[legacy_replacement_mask, "score_reserve_risk"] = df.loc[
        legacy_replacement_mask, "score_reserve_risk_replacement"
    ]
    df.loc[~df["reserve_dimension_active"], "score_reserve_risk"] = 0
    df["score_reserve_risk"] = df["score_reserve_risk"].fillna(0).astype(int)

    # V4 layered model: MVRV Z-Score now occupies the valuation slot directly.
    # Keep Reserve Risk V4 fields as compatibility aliases for rollback safety.
    df["reserve_risk_soft_fallback_active"] = False
    df["reserve_risk_soft_fallback_source"] = None
    df["score_reserve_risk_v4"] = df["score_mvrv_zscore_core"].astype(int)
    df["max_reserve_risk_score_v4"] = np.where(
        df["mvrv_zscore_core_active"], 2, 0
    ).astype(int)
    df["reserve_risk_source_mode_v4"] = np.where(
        df["mvrv_zscore_core_active"], "compat_mvrv_zscore", "inactive"
    )
    df["reserve_dimension_active_v4"] = df["mvrv_zscore_core_active"]
    df["reserve_risk_fallback_lag_days_v4"] = pd.NA

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
        "lthMvrv": THRESHOLD_STATIC["lth_mvrv"],
        "mvrvZscore": THRESHOLD_STATIC["mvrv_zscore"],
        "mvrvZscoreCore": {
            **THRESHOLD_STATIC["mvrv_zscore"],
            "role": "valuation_core_v4",
        },
        "reserveRiskReplacementLegacy": {
            "lthMvrv": THRESHOLD_STATIC["lth_mvrv"],
            "mvrvZscore": THRESHOLD_STATIC["mvrv_zscore"],
        },
        "reserveRiskV4Compatibility": {
            "aliasOf": "mvrvZscoreCore",
            "deprecated": True,
        },
    }

    # Legacy V2/V3 signal fields.
    df["signal_price_ma200w"] = df["score_price_ma200w"] > 0
    df["signal_price_realized"] = df["score_price_realized"] > 0
    df["signal_reserve_risk"] = df["score_reserve_risk"] > 0
    df["signal_sth_sopr"] = df["score_sth_sopr"] > 0
    df["signal_sth_mvrv"] = df["score_sth_mvrv"] > 0
    df["signal_sth_group"] = df["score_sth_group"] > 0
    df["signal_puell"] = df["score_puell"] > 0
    df["inactive_indicator_count"] = (~df["reserve_dimension_active"]).astype(int)
    df["active_indicator_count"] = (
        LEGACY_SCORING_INDICATOR_COUNT - df["inactive_indicator_count"]
    )
    df["max_signal_score_v2"] = df["active_indicator_count"] * 2
    df["signal_count"] = df[GROUPED_SIGNAL_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2"] = df[GROUPED_SCORE_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2_min3d"] = (
        df["signal_score_v2"].rolling(window=3, min_periods=3).min()
    )
    min3d_ratio_legacy = (
        df["signal_score_v2_min3d"] / df["max_signal_score_v2"].replace(0, pd.NA)
    ).fillna(0)
    df["signal_confirmed_3d"] = min3d_ratio_legacy >= SCORE_CONFIRM_RATIO
    df["signal_band_v2"] = [
        _classify_score_band(int(score), int(max_score))
        for score, max_score in zip(df["signal_score_v2"], df["max_signal_score_v2"])
    ]

    # V4 layered scores and signals.
    df["signal_mvrv_zscore_core"] = df["score_mvrv_zscore_core"] > 0
    df["signal_reserve_risk_v4"] = df["signal_mvrv_zscore_core"]
    df["signal_lth_mvrv"] = df["score_lth_mvrv"] > 0
    df["signal_sth_sopr_aux"] = df["score_sth_sopr"] > 0
    df["valuation_score"] = (
        df["score_price_ma200w"]
        + df["score_price_realized"]
        + df["score_mvrv_zscore_core"]
        + df["score_puell"]
    ).astype(int)
    df["max_valuation_score"] = (
        6 + (df["mvrv_zscore_core_active"].astype(int) * 2)
    ).astype(int)
    df["trigger_score"] = df["score_sth_mvrv"].astype(int)
    df["max_trigger_score"] = 2
    df["confirmation_score"] = df["score_lth_mvrv"].astype(int)
    df["max_confirmation_score"] = 2
    df["auxiliary_score"] = df["score_sth_sopr"].astype(int)
    df["max_auxiliary_score"] = 2
    df["active_indicator_count_v4"] = (
        5 + df["mvrv_zscore_core_active"].astype(int)
    ).astype(int)
    df["signal_count_v4"] = (
        df[
            [
                "signal_price_ma200w",
                "signal_price_realized",
                "signal_mvrv_zscore_core",
                "signal_sth_mvrv",
                "signal_lth_mvrv",
                "signal_puell",
            ]
        ]
        .sum(axis=1)
        .astype(int)
    )
    df["max_total_score_v4"] = (
        df["max_valuation_score"]
        + df["max_trigger_score"]
        + df["max_confirmation_score"]
    ).astype(int)
    df["total_score_v4"] = (
        df["valuation_score"] + df["trigger_score"] + df["confirmation_score"]
    ).astype(int)
    df["total_score_v4_min3d"] = (
        df["total_score_v4"].rolling(window=3, min_periods=3).min()
    )
    min3d_ratio_v4 = (
        df["total_score_v4_min3d"] / df["max_total_score_v4"].replace(0, pd.NA)
    ).fillna(0)
    df["signal_confirmed_3d_v4"] = min3d_ratio_v4 >= SCORE_CONFIRM_RATIO
    df["signal_band_v4"] = [
        _classify_score_band(int(score), int(max_score))
        for score, max_score in zip(df["total_score_v4"], df["max_total_score_v4"])
    ]

    mvrv_core_freshness = df["mvrv_zscore_freshness_score"].where(
        df["mvrv_zscore_core_active"], 0.0
    ).fillna(0.0)
    df["data_freshness_score"] = (
        df[
            [
                "btc_price_freshness_score",
                "realized_price_freshness_score",
                "ma200w_freshness_score",
                "sth_mvrv_freshness_score",
                "lth_mvrv_freshness_score",
                "puell_multiple_freshness_score",
            ]
        ].sum(axis=1)
        + mvrv_core_freshness
    ) / 7
    base_score_ratio = (
        df["total_score_v4"] / df["max_total_score_v4"].replace(0, pd.NA)
    ).fillna(0)
    auxiliary_bonus = np.where(df["signal_sth_sopr_aux"], 0.1, 0.0)
    confirmation_bonus = np.where(df["signal_confirmed_3d_v4"], 0.1, 0.0)
    fallback_penalty = np.where(~df["mvrv_zscore_core_active"], 0.2, 0.0)
    df["signal_confidence"] = (
        (
            0.5 * base_score_ratio
            + 0.3 * df["data_freshness_score"]
            + auxiliary_bonus
            + confirmation_bonus
            - fallback_penalty
        )
        .clip(lower=0, upper=1)
        .round(4)
    )

    stale_flags = pd.DataFrame(
        {
            "priceMa200w": ~df["ma200w_is_fresh"],
            "priceRealized": ~df["realized_price_is_fresh"],
            "reserveRisk": ~df["reserve_risk_is_fresh"],
            "sthSopr": ~df["sth_sopr_is_fresh"],
            "sthMvrv": ~df["sth_mvrv_is_fresh"],
            "lthMvrv": ~df["lth_mvrv_is_fresh"],
            "puell": ~df["puell_multiple_is_fresh"],
            "mvrvZscore": ~df["mvrv_zscore_core_active"],
        }
    )
    df["stale_indicators"] = [
        [key for key, is_stale in flags.items() if bool(is_stale)]
        for flags in stale_flags.to_dict(orient="records")
    ]
    df["fallback_mode"] = np.where(
        ~df["mvrv_zscore_core_active"],
        "mvrv_zscore_inactive",
        "none",
    )

    return df, thresholds


def build_tabular_view(frontend_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare human-readable table used for CSV/XLSX exports."""
    return frontend_df.rename(
        columns={
            "date": "Date",
            "price_200w_ma_ratio": "BTC_Price_200W_MA_Ratio",
            "price_realized_ratio": "BTC_Price_Realized_Price_Ratio",
            "reserve_risk": "Reserve_Risk",
            "lth_mvrv": "LTH_MVRV",
            "sth_sopr": "STH_SOPR",
            "sth_mvrv": "STH_MVRV",
            "puell_multiple": "Puell_Multiple",
            "signal_score_v2": "Signal_Score_V2",
            "valuation_score": "Valuation_Score_V4",
            "trigger_score": "Trigger_Score_V4",
            "confirmation_score": "Confirmation_Score_V4",
            "total_score_v4": "Total_Score_V4",
            "signal_count": "Signal_Count",
            "signal_count_v4": "Signal_Count_V4",
        }
    )[
        [
            "Date",
            "BTC_Price_200W_MA_Ratio",
            "BTC_Price_Realized_Price_Ratio",
            "Reserve_Risk",
            "LTH_MVRV",
            "STH_SOPR",
            "STH_MVRV",
            "Puell_Multiple",
            "Signal_Score_V2",
            "Valuation_Score_V4",
            "Trigger_Score_V4",
            "Confirmation_Score_V4",
            "Total_Score_V4",
            "Signal_Count",
            "Signal_Count_V4",
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
                "signalReserveRiskV4": bool(getattr(row, "signal_reserve_risk_v4")),
                "signalMvrvZscoreCore": bool(
                    getattr(row, "signal_mvrv_zscore_core")
                ),
                "signalLthMvrv": bool(getattr(row, "signal_lth_mvrv")),
                "signalSthSoprAux": bool(getattr(row, "signal_sth_sopr_aux")),
                "signalPuell": bool(getattr(row, "signal_puell")),
                "signalCount": int(getattr(row, "signal_count")),
                "activeIndicatorCount": int(getattr(row, "active_indicator_count")),
                "signalCountV4": int(getattr(row, "signal_count_v4")),
                "activeIndicatorCountV4": int(
                    getattr(row, "active_indicator_count_v4")
                ),
                "scorePriceMa200w": int(getattr(row, "score_price_ma200w")),
                "scorePriceRealized": int(getattr(row, "score_price_realized")),
                "scoreReserveRisk": int(getattr(row, "score_reserve_risk")),
                "scoreReserveRiskV4": int(getattr(row, "score_reserve_risk_v4")),
                "scoreReserveRiskPrimary": int(
                    getattr(row, "score_reserve_risk_primary")
                ),
                "scoreReserveRiskReplacement": int(
                    getattr(row, "score_reserve_risk_replacement")
                ),
                "scoreLthMvrv": int(getattr(row, "score_lth_mvrv")),
                "scoreMvrvZscore": int(getattr(row, "score_mvrv_zscore")),
                "scoreMvrvZscoreCore": int(getattr(row, "score_mvrv_zscore_core")),
                "scoreSthSopr": int(getattr(row, "score_sth_sopr")),
                "scoreSthMvrv": int(getattr(row, "score_sth_mvrv")),
                "scoreSthGroup": int(getattr(row, "score_sth_group")),
                "scorePuell": int(getattr(row, "score_puell")),
                "signalScoreV2": int(getattr(row, "signal_score_v2")),
                "maxSignalScoreV2": int(getattr(row, "max_signal_score_v2")),
                "signalScoreV2Min3d": _safe_float(
                    getattr(row, "signal_score_v2_min3d")
                ),
                "signalConfirmed3d": bool(getattr(row, "signal_confirmed_3d")),
                "signalBandV2": str(getattr(row, "signal_band_v2")),
                "valuationScore": int(getattr(row, "valuation_score")),
                "maxValuationScore": int(getattr(row, "max_valuation_score")),
                "triggerScore": int(getattr(row, "trigger_score")),
                "maxTriggerScore": int(getattr(row, "max_trigger_score")),
                "confirmationScore": int(getattr(row, "confirmation_score")),
                "maxConfirmationScore": int(
                    getattr(row, "max_confirmation_score")
                ),
                "auxiliaryScore": int(getattr(row, "auxiliary_score")),
                "maxAuxiliaryScore": int(getattr(row, "max_auxiliary_score")),
                "totalScoreV4": int(getattr(row, "total_score_v4")),
                "maxTotalScoreV4": int(getattr(row, "max_total_score_v4")),
                "totalScoreV4Min3d": _safe_float(
                    getattr(row, "total_score_v4_min3d")
                ),
                "signalConfirmed3dV4": bool(
                    getattr(row, "signal_confirmed_3d_v4")
                ),
                "signalBandV4": str(getattr(row, "signal_band_v4")),
                "signalConfidence": _safe_float(getattr(row, "signal_confidence")),
                "dataFreshnessScore": _safe_float(
                    getattr(row, "data_freshness_score")
                ),
                "fallbackMode": str(getattr(row, "fallback_mode")),
                "reserveRiskActive": bool(getattr(row, "reserve_risk_active")),
                "reserveRiskReplacementActive": bool(
                    getattr(row, "reserve_risk_replacement_active")
                ),
                "reserveRiskReplacementSource": getattr(
                    row, "reserve_risk_replacement_source"
                ),
                "reserveRiskSourceMode": str(getattr(row, "reserve_risk_source_mode")),
                "reserveRiskLagDays": _safe_int(getattr(row, "reserve_risk_lag_days")),
                "reserveRiskPrimaryLagDays": _safe_int(
                    getattr(row, "reserve_risk_primary_lag_days")
                ),
                "reserveRiskReplacementLagDays": _safe_int(
                    getattr(row, "reserve_risk_replacement_lag_days")
                ),
                "reserveRiskSourceModeV4": str(
                    getattr(row, "reserve_risk_source_mode_v4")
                ),
                "reserveRiskSoftFallbackActive": bool(
                    getattr(row, "reserve_risk_soft_fallback_active")
                ),
                "reserveRiskFallbackLagDaysV4": _safe_int(
                    getattr(row, "reserve_risk_fallback_lag_days_v4")
                ),
                "staleIndicators": list(getattr(row, "stale_indicators")),
                "thresholds": {
                    "reserveRisk": {
                        "trigger": _safe_float(getattr(row, "reserve_risk_trigger")),
                        "deep": _safe_float(getattr(row, "reserve_risk_deep")),
                    },
                    "sthSopr": {
                        "trigger": _safe_float(getattr(row, "sth_sopr_trigger")),
                        "deep": _safe_float(getattr(row, "sth_sopr_deep")),
                    },
                    "sthMvrv": {
                        "trigger": _safe_float(getattr(row, "sth_mvrv_trigger")),
                        "deep": _safe_float(getattr(row, "sth_mvrv_deep")),
                    },
                },
                "api_data_date": {
                    "price_ma200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "price_realized": _safe_iso_date(
                        getattr(row, "realized_price_date")
                    ),
                    "reserve_risk": _safe_iso_date(getattr(row, "reserve_risk_date")),
                    "lth_mvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "mvrv_zscore": _safe_iso_date(getattr(row, "mvrv_zscore_date")),
                    "sth_sopr": _safe_iso_date(getattr(row, "sth_sopr_date")),
                    "sth_mvrv": _safe_iso_date(getattr(row, "sth_mvrv_date")),
                    "puell": _safe_iso_date(getattr(row, "puell_multiple_date")),
                },
                "indicatorDates": {
                    "priceMa200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "priceRealized": _safe_iso_date(
                        getattr(row, "realized_price_date")
                    ),
                    "reserveRisk": _safe_iso_date(getattr(row, "reserve_risk_date")),
                    "lthMvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "mvrvZscore": _safe_iso_date(getattr(row, "mvrv_zscore_date")),
                    "sthSopr": _safe_iso_date(getattr(row, "sth_sopr_date")),
                    "sthMvrv": _safe_iso_date(getattr(row, "sth_mvrv_date")),
                    "puell": _safe_iso_date(getattr(row, "puell_multiple_date")),
                },
                "coreIndicatorSet": INDICATOR_SET,
                "scoringModelVersion": SCORING_MODEL_VERSION,
            }
        )

    return records


def build_latest_json(
    frontend_df: pd.DataFrame,
    thresholds: Dict[str, Dict[str, object]],
    reserve_risk_diagnostics: Dict[str, object] | None = None,
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
    reserve_risk_replacement_active = bool(
        last.get("reserve_risk_replacement_active", False)
    )
    reserve_risk_replacement_source = last.get("reserve_risk_replacement_source")
    reserve_risk_replacement_lag_days = _safe_int(
        last.get("reserve_risk_replacement_lag_days")
    )
    reserve_risk_source_mode = str(last.get("reserve_risk_source_mode", "primary"))
    reserve_risk_source_mode_v4 = str(
        last.get("reserve_risk_source_mode_v4", "primary")
    )
    reserve_risk_soft_fallback_active = bool(
        last.get("reserve_risk_soft_fallback_active", False)
    )
    reserve_risk_fallback_lag_days_v4 = _safe_int(
        last.get("reserve_risk_fallback_lag_days_v4")
    )
    lth_mvrv_date = _safe_iso_date(last.get("lth_mvrv_date")) or date_value
    mvrv_zscore_date = _safe_iso_date(last.get("mvrv_zscore_date")) or date_value
    mvrv_zscore_core_active = bool(last.get("mvrv_zscore_core_active", False))

    reserve_risk_effective_date = reserve_risk_date
    if reserve_risk_source_mode == "replacement":
        if reserve_risk_replacement_source == "mvrv_zscore_data":
            reserve_risk_effective_date = mvrv_zscore_date
        else:
            reserve_risk_effective_date = lth_mvrv_date

    indicator_lag_days = {
        "priceMa200w": _safe_int(last.get("ma200w_lag_days")),
        "priceRealized": _safe_int(last.get("realized_price_lag_days")),
        "reserveRisk": reserve_risk_lag_days,
        "lthMvrv": _safe_int(last.get("lth_mvrv_lag_days")),
        "mvrvZscore": _safe_int(last.get("mvrv_zscore_lag_days")),
        "sthSopr": _safe_int(last.get("sth_sopr_lag_days")),
        "sthMvrv": _safe_int(last.get("sth_mvrv_lag_days")),
        "puell": _safe_int(last.get("puell_multiple_lag_days")),
    }
    indicator_dates = {
        "priceMa200w": _safe_iso_date(last["btc_price_date"]) or date_value,
        "priceRealized": _safe_iso_date(last["realized_price_date"]) or date_value,
        "reserveRisk": reserve_risk_date,
        "lthMvrv": lth_mvrv_date,
        "mvrvZscore": mvrv_zscore_date,
        "sthSopr": _safe_iso_date(last["sth_sopr_date"]) or date_value,
        "sthMvrv": _safe_iso_date(last["sth_mvrv_date"]) or date_value,
        "puell": _safe_iso_date(last["puell_multiple_date"]) or date_value,
    }
    stale_indicator_keys = list(last.get("stale_indicators", []))
    stale_indicators = []
    freshness_limit_map = {
        "priceMa200w": INDICATOR_FRESHNESS_MAX_LAG_DAYS["ma200w"],
        "priceRealized": INDICATOR_FRESHNESS_MAX_LAG_DAYS["realized_price"],
        "reserveRisk": reserve_risk_disable_lag_days,
        "lthMvrv": INDICATOR_FRESHNESS_MAX_LAG_DAYS["lth_mvrv"],
        "mvrvZscore": INDICATOR_FRESHNESS_MAX_LAG_DAYS["mvrv_zscore"],
        "sthSopr": INDICATOR_FRESHNESS_MAX_LAG_DAYS["sth_sopr"],
        "sthMvrv": INDICATOR_FRESHNESS_MAX_LAG_DAYS["sth_mvrv"],
        "puell": INDICATOR_FRESHNESS_MAX_LAG_DAYS["puell_multiple"],
    }
    for key in stale_indicator_keys:
        stale_indicators.append(
            {
                "key": key,
                "lagDays": indicator_lag_days.get(key),
                "maxLagDays": freshness_limit_map.get(key),
                "sourceDate": indicator_dates.get(key),
            }
        )

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
    if not mvrv_zscore_core_active:
        inactive_indicators.append(
            {
                "key": "mvrvZscore",
                "reason": "core_indicator_stale",
                "sourceDate": mvrv_zscore_date,
                "latestDate": date_value,
                "lagDays": _safe_int(last.get("mvrv_zscore_lag_days")),
                "disableLagDays": INDICATOR_FRESHNESS_MAX_LAG_DAYS["mvrv_zscore"],
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
        "signalCountV4": int(last["signal_count_v4"]),
        "activeIndicatorCountV4": int(last["active_indicator_count_v4"]),
        "signalScoreV2": int(last["signal_score_v2"]),
        "maxSignalScoreV2": int(last["max_signal_score_v2"]),
        "signalScoreV2Min3d": _safe_float(last["signal_score_v2_min3d"]),
        "signalConfirmed3d": bool(last["signal_confirmed_3d"]),
        "signalBandV2": str(last["signal_band_v2"]),
        "valuationScore": int(last["valuation_score"]),
        "maxValuationScore": int(last["max_valuation_score"]),
        "triggerScore": int(last["trigger_score"]),
        "maxTriggerScore": int(last["max_trigger_score"]),
        "confirmationScore": int(last["confirmation_score"]),
        "maxConfirmationScore": int(last["max_confirmation_score"]),
        "auxiliaryScore": int(last["auxiliary_score"]),
        "maxAuxiliaryScore": int(last["max_auxiliary_score"]),
        "totalScoreV4": int(last["total_score_v4"]),
        "maxTotalScoreV4": int(last["max_total_score_v4"]),
        "totalScoreV4Min3d": _safe_float(last["total_score_v4_min3d"]),
        "signalConfirmed3dV4": bool(last["signal_confirmed_3d_v4"]),
        "signalBandV4": str(last["signal_band_v4"]),
        "signalConfidence": _safe_float(last["signal_confidence"]) or 0.0,
        "dataFreshnessScore": _safe_float(last["data_freshness_score"]) or 0.0,
        "fallbackMode": str(last.get("fallback_mode", "none")),
        "scorePriceMa200w": int(last["score_price_ma200w"]),
        "scorePriceRealized": int(last["score_price_realized"]),
        "scoreReserveRisk": int(last["score_reserve_risk"]),
        "scoreReserveRiskV4": int(last["score_reserve_risk_v4"]),
        "scoreSthSopr": int(last["score_sth_sopr"]),
        "scoreSthMvrv": int(last["score_sth_mvrv"]),
        "scorePuell": int(last["score_puell"]),
        "scoreReserveRiskPrimary": int(last["score_reserve_risk_primary"]),
        "scoreReserveRiskReplacement": int(last["score_reserve_risk_replacement"]),
        "scoreLthMvrv": int(last["score_lth_mvrv"]),
        "scoreMvrvZscore": int(last["score_mvrv_zscore"]),
        "scoreMvrvZscoreCore": int(last["score_mvrv_zscore_core"]),
        "scoreSthGroup": int(last["score_sth_group"]),
        "signalSthGroup": bool(last["signal_sth_group"]),
        "signalMvrvZscoreCore": bool(last["signal_mvrv_zscore_core"]),
        "scoringModelVersion": SCORING_MODEL_VERSION,
        "legacyScoringModelVersion": LEGACY_SCORING_MODEL_VERSION,
        "reserveRiskActive": reserve_risk_active,
        "reserveRiskReplacementActive": reserve_risk_replacement_active,
        "reserveRiskReplacementSource": reserve_risk_replacement_source,
        "reserveRiskReplacementLagDays": reserve_risk_replacement_lag_days,
        "reserveRiskSourceMode": reserve_risk_source_mode,
        "reserveRiskSourceModeV4": reserve_risk_source_mode_v4,
        "reserveRiskSoftFallbackActive": reserve_risk_soft_fallback_active,
        "reserveRiskFallbackLagDaysV4": reserve_risk_fallback_lag_days_v4,
        "reserveRiskLagDays": reserve_risk_lag_days,
        "reserveRiskPrimaryLagDays": reserve_risk_primary_lag_days,
        "inactiveIndicators": inactive_indicators,
        "staleIndicators": stale_indicators,
        "indicatorLagDays": indicator_lag_days,
        "signals": {
            "priceMa200w": bool(last["signal_price_ma200w"]),
            "priceRealized": bool(last["signal_price_realized"]),
            "reserveRisk": bool(last["signal_reserve_risk"]),
            "sthSopr": bool(last["signal_sth_sopr"]),
            "sthMvrv": bool(last["signal_sth_mvrv"]),
            "sthGroup": bool(last["signal_sth_group"]),
            "puell": bool(last["signal_puell"]),
        },
        "signalsV4": {
            "priceMa200w": bool(last["signal_price_ma200w"]),
            "priceRealized": bool(last["signal_price_realized"]),
            "reserveRisk": bool(last["signal_reserve_risk_v4"]),
            "mvrvZscore": bool(last["signal_mvrv_zscore_core"]),
            "sthMvrv": bool(last["signal_sth_mvrv"]),
            "lthMvrv": bool(last["signal_lth_mvrv"]),
            "puell": bool(last["signal_puell"]),
            "sthSoprAux": bool(last["signal_sth_sopr_aux"]),
        },
        "indicatorDates": indicator_dates,
        "coreIndicatorSet": INDICATOR_SET,
        "schemaVersion": SCHEMA_VERSION,
        "thresholds": thresholds,
        "reserveRiskDiagnostics": reserve_risk_diagnostics or {},
        "reserveRiskShadowCompare": (
            reserve_risk_diagnostics.get("shadowCompare")
            if isinstance(reserve_risk_diagnostics, dict)
            else None
        ),
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
    reserve_risk_diagnostics: Dict[str, object] | None = None,
    signal_events_rows: int = 0,
    archived_snapshot_path: str | None = None,
    archive_root: str | None = None,
) -> Dict[str, object]:
    """Build a small manifest for observability/debugging and cache-busting hints."""
    reserve_risk_diagnostics = (
        reserve_risk_diagnostics
        if reserve_risk_diagnostics is not None
        else latest_json.get("reserveRiskDiagnostics", {})
    )
    primary_series = (
        reserve_risk_diagnostics.get("primarySeries", {})
        if isinstance(reserve_risk_diagnostics, dict)
        else {}
    )
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "latestDate": latest_json.get("date"),
        "lastUpdated": latest_json.get("lastUpdated"),
        "historyRows": history_rows,
        "historyLightRows": light_rows,
        "signalEventsV4Rows": signal_events_rows,
        "schemaVersion": SCHEMA_VERSION,
        "indicatorSet": INDICATOR_SET,
        "scoringModelVersion": latest_json.get(
            "scoringModelVersion", SCORING_MODEL_VERSION
        ),
        "legacyScoringModelVersion": latest_json.get(
            "legacyScoringModelVersion", LEGACY_SCORING_MODEL_VERSION
        ),
        "thresholds": thresholds,
        "activeIndicatorCount": latest_json.get(
            "activeIndicatorCount", LEGACY_SCORING_INDICATOR_COUNT
        ),
        "maxSignalScoreV2": latest_json.get(
            "maxSignalScoreV2", LEGACY_SCORING_INDICATOR_COUNT * 2
        ),
        "activeIndicatorCountV4": latest_json.get(
            "activeIndicatorCountV4", SCORING_INDICATOR_COUNT_V4
        ),
        "maxTotalScoreV4": latest_json.get(
            "maxTotalScoreV4", SCORING_INDICATOR_COUNT_V4 * 2
        ),
        "signalBandV4": latest_json.get("signalBandV4"),
        "signalConfidence": latest_json.get("signalConfidence"),
        "reserveRiskSourceMode": latest_json.get("reserveRiskSourceMode", "primary"),
        "reserveRiskSourceModeV4": latest_json.get(
            "reserveRiskSourceModeV4", "primary"
        ),
        "reserveRiskHealthStatus": primary_series.get("healthStatus"),
        "reserveRiskPrimaryLastNonNullDate": primary_series.get("latestNonNullDate"),
        "reserveRiskPrimaryTrailingNullDays": primary_series.get("trailingNullDays"),
        "reserveRiskDiagnostics": reserve_risk_diagnostics,
        "reserveRiskShadowCompare": (
            reserve_risk_diagnostics.get("shadowCompare")
            if isinstance(reserve_risk_diagnostics, dict)
            else None
        ),
        "inactiveIndicators": latest_json.get("inactiveIndicators", []),
        "archive": {
            "archiveRoot": archive_root,
            "archivedSnapshotPath": archived_snapshot_path,
            "rollbackHint": (
                f"python fetch_btc_indicators_history_files.py --rollback-from {archived_snapshot_path}"
                if archived_snapshot_path
                else None
            ),
        },
    }


def write_json(path: Path, payload: object) -> None:
    """Write JSON with stable formatting and UTF-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_json_if_exists(path: Path) -> object | None:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def archive_existing_outputs(
    output_paths: Dict[str, Path],
    archive_root: Path,
    release_label: str = "",
) -> Path | None:
    existing_paths = {key: path for key, path in output_paths.items() if path.exists()}
    if not existing_paths:
        return None

    archive_root.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = f"_{release_label.strip()}" if release_label.strip() else ""
    snapshot_dir = archive_root / f"snapshot_{timestamp}{suffix}"
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    latest_payload = load_json_if_exists(existing_paths.get("latest", Path()))
    manifest_payload = load_json_if_exists(existing_paths.get("manifest", Path()))
    metadata = {
        "archivedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotId": snapshot_dir.name,
        "previousLatestDate": (
            latest_payload.get("date")
            if isinstance(latest_payload, dict)
            else None
        ),
        "previousSchemaVersion": (
            manifest_payload.get("schemaVersion")
            if isinstance(manifest_payload, dict)
            else None
        ),
        "previousScoringModelVersion": (
            manifest_payload.get("scoringModelVersion")
            if isinstance(manifest_payload, dict)
            else None
        ),
        "releaseLabel": release_label or None,
        "files": {},
    }

    for key, path in existing_paths.items():
        target = snapshot_dir / path.name
        shutil.copy2(path, target)
        metadata["files"][key] = {
            "source": str(path),
            "snapshot": str(target),
        }

    write_json(snapshot_dir / ROLLBACK_METADATA_FILE, metadata)
    return snapshot_dir


def restore_outputs_from_archive(
    snapshot_dir: Path,
    output_paths: Dict[str, Path],
) -> Dict[str, Path]:
    if not snapshot_dir.exists():
        raise FileNotFoundError(f"Snapshot directory does not exist: {snapshot_dir}")

    restored: Dict[str, Path] = {}
    for key, target_path in output_paths.items():
        snapshot_path = snapshot_dir / target_path.name
        if not snapshot_path.exists():
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(snapshot_path, target_path)
        restored[key] = target_path
    return restored


def build_signal_events_v4_json(frontend_df: pd.DataFrame) -> List[Dict[str, object]]:
    if frontend_df.empty:
        return []

    events: List[Dict[str, object]] = []
    confirmed = frontend_df["signal_confirmed_3d_v4"].fillna(False).astype(bool)
    starts = frontend_df.index[confirmed & ~confirmed.shift(1, fill_value=False)]

    for start_idx in starts.tolist():
        end_idx = start_idx
        while (
            end_idx + 1 < len(frontend_df)
            and bool(frontend_df.iloc[end_idx + 1]["signal_confirmed_3d_v4"])
        ):
            end_idx += 1

        start_row = frontend_df.iloc[start_idx]
        window = frontend_df.iloc[start_idx : end_idx + 1]
        entry_price = _safe_float(start_row.get("btc_price")) or 0.0
        event: Dict[str, object] = {
            "startDate": _safe_iso_date(start_row.get("date")),
            "endDate": _safe_iso_date(frontend_df.iloc[end_idx].get("date")),
            "days": int(end_idx - start_idx + 1),
            "entryPrice": entry_price,
            "signalBandV4": str(start_row.get("signal_band_v4")),
            "signalConfidence": _safe_float(start_row.get("signal_confidence")),
            "valuationScore": int(start_row.get("valuation_score")),
            "triggerScore": int(start_row.get("trigger_score")),
            "confirmationScore": int(start_row.get("confirmation_score")),
            "totalScoreV4": int(start_row.get("total_score_v4")),
            "maxTotalScoreV4": int(start_row.get("max_total_score_v4")),
            "fallbackMode": str(start_row.get("fallback_mode")),
            "maxScoreDuringEvent": int(window["total_score_v4"].max()),
            "minPriceDuringEvent": _safe_float(window["btc_price"].min()),
        }

        for horizon in [30, 90, 180, 365]:
            target_idx = min(start_idx + horizon, len(frontend_df) - 1)
            target_price = _safe_float(frontend_df.iloc[target_idx].get("btc_price"))
            if entry_price > 0 and target_price is not None:
                event[f"return{horizon}d"] = round((target_price / entry_price) - 1, 6)
            else:
                event[f"return{horizon}d"] = None

        events.append(event)

    return events


def save_tabular_outputs(
    df: pd.DataFrame, output_dir: Path, file_prefix: str
) -> Dict[str, Path]:
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
    reserve_risk_diagnostics: Dict[str, object],
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
        print(
            f"Date range: {tabular_df['Date'].min().date()} -> {tabular_df['Date'].max().date()}"
        )
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

    reserve_primary = reserve_risk_diagnostics.get("primarySeries", {})
    reserve_supporting = reserve_risk_diagnostics.get("supportingSeries", [])
    reserve_shadow = reserve_risk_diagnostics.get("shadowCompare", {})
    if reserve_primary:
        print()
        print("Reserve Risk health:")
        print(
            "  - primary status: "
            f"{reserve_primary.get('healthStatus', '-')}"
        )
        print(
            "  - last non-null : "
            f"{reserve_primary.get('latestNonNullDate', '-')}"
        )
        print(
            "  - trailing null : "
            f"{reserve_primary.get('trailingNullDays', '-')}"
        )
    if reserve_supporting:
        for item in reserve_supporting:
            if not isinstance(item, dict):
                continue
            print(
                "  - bridge source : "
                f"{item.get('key', '-')} last non-null @ "
                f"{item.get('latestNonNullDate', '-')}"
            )
    if reserve_shadow:
        print(
            "  - shadow source : "
            f"{reserve_shadow.get('candidateKey', '-')}"
            f" @ {reserve_shadow.get('candidateLatestDate', '-')}"
        )

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
        "--signal-events-v4-json-path",
        default=SIGNAL_EVENTS_V4_JSON_PATH_DEFAULT,
        help="V4 event backtest JSON output path.",
    )
    parser.add_argument(
        "--skip-tabular",
        action="store_true",
        help="Skip CSV/XLSX outputs and only write frontend JSON files.",
    )
    parser.add_argument(
        "--archive-root",
        default=ARCHIVE_ROOT_DEFAULT,
        help="Directory used to archive current JSON outputs before overwrite.",
    )
    parser.add_argument(
        "--release-label",
        default="",
        help="Optional suffix added to archived snapshot directory names.",
    )
    parser.add_argument(
        "--skip-archive",
        action="store_true",
        help="Do not archive current JSON outputs before writing a new release.",
    )
    parser.add_argument(
        "--rollback-from",
        default="",
        help="Restore JSON outputs from a previously archived snapshot directory and exit.",
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

    history_path = Path(args.history_json_path)
    history_light_path = Path(args.history_light_json_path)
    latest_path = Path(args.latest_json_path)
    manifest_path = Path(args.manifest_json_path)
    signal_events_v4_path = Path(args.signal_events_v4_json_path)
    output_paths = {
        "history": history_path,
        "historyLight": history_light_path,
        "latest": latest_path,
        "manifest": manifest_path,
        "signalEventsV4": signal_events_v4_path,
    }

    if args.rollback_from:
        restored = restore_outputs_from_archive(Path(args.rollback_from), output_paths)
        if not restored:
            print(f"No matching output files found in snapshot: {args.rollback_from}")
            return 1
        print("Rollback completed.")
        for key, path in restored.items():
            print(f"  - restored {key}: {path}")
        return 0

    base_df, sources, reserve_primary_last_date, reserve_risk_diagnostics = build_base_dataframe(
        args.start_date, args.end_date
    )
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

    # Merge with existing history to preserve rows no longer returned by the API
    if history_path.exists():
        try:
            with history_path.open("r", encoding="utf-8") as f:
                existing_history = json.load(f)
            if isinstance(existing_history, list):
                existing_by_date = {row.get("d"): row for row in existing_history}
                new_by_date = {row.get("d"): row for row in history_json}
                preserved_count = 0
                # Keep existing rows whose dates are NOT in the new fetch
                for date_key, row in existing_by_date.items():
                    if date_key not in new_by_date:
                        history_json.append(row)
                        preserved_count += 1
                # Sort by date to maintain ordering
                history_json.sort(key=lambda r: r.get("d", ""))
                print(
                    f"History merged: {len(new_by_date)} new + {preserved_count} preserved = {len(history_json)} total"
                )
        except Exception as exc:
            print(
                f"WARNING: Could not merge with existing history ({exc}). Using fresh data only."
            )

    latest_json = build_latest_json(
        frontend_df,
        thresholds=thresholds,
        reserve_risk_diagnostics=reserve_risk_diagnostics,
    )
    history_light_json = build_light_history_json(
        history_json, years=max(1, args.history_light_years)
    )
    signal_events_v4_json = build_signal_events_v4_json(frontend_df)
    archived_snapshot = None
    if not args.skip_archive:
        archived_snapshot = archive_existing_outputs(
            output_paths=output_paths,
            archive_root=Path(args.archive_root),
            release_label=args.release_label,
        )
    manifest_json = build_manifest_json(
        latest_json=latest_json,
        history_rows=len(history_json),
        light_rows=len(history_light_json),
        thresholds=thresholds,
        reserve_risk_diagnostics=reserve_risk_diagnostics,
        signal_events_rows=len(signal_events_v4_json),
        archived_snapshot_path=str(archived_snapshot) if archived_snapshot else None,
        archive_root=args.archive_root,
    )
    write_json(history_path, history_json)
    write_json(history_light_path, history_light_json)
    write_json(latest_path, latest_json)
    write_json(manifest_path, manifest_json)
    write_json(signal_events_v4_path, signal_events_v4_json)

    saved_files: Dict[str, Path] = {}
    if not args.skip_tabular:
        saved_files = save_tabular_outputs(
            tabular_df, Path(args.output_dir), args.file_prefix
        )

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
        reserve_risk_diagnostics=reserve_risk_diagnostics,
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
