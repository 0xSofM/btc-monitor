"""HTTP fetching, JSON parsing, and data-source management."""

from __future__ import annotations

import json
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Tuple

import pandas as pd
import requests

from .config import (
    INDICATOR_FRESHNESS_MAX_LAG_DAYS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RESERVE_RISK_SOURCE_REGISTRY,
    RETRY_BACKOFF_SEC,
    SERIES_CONFIG,
)


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


def _safe_int(value: object) -> int | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    return int(parsed)


# ---- HTTP layer -----------------------------------------------------------


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


# ---- Series parsing -------------------------------------------------------


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


# ---- Reserve Risk multi-source --------------------------------------------


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
    applied_point_source = None
    diagnostics = build_reserve_risk_source_diagnostics(
        primary_df=primary_df,
        point_candidates=point_candidates,
        applied_point_source=applied_point_source,
        primary_source_key=primary_source_key,
        supporting_series={
            "bitcoin_data_history": recent_df if use_recent_primary else legacy_df,
        },
        assembled_df=assembled_df,
        assembled_source_label=source_label,
    )

    reserve_primary_last_date_raw = diagnostics["primarySeries"].get("latestNonNullDate")
    reserve_primary_last_date: pd.Timestamp | None = None
    if isinstance(reserve_primary_last_date_raw, str) and reserve_primary_last_date_raw:
        try:
            reserve_primary_last_date = pd.to_datetime(reserve_primary_last_date_raw)
        except Exception:
            pass

    return assembled_df, source_label, reserve_primary_last_date, diagnostics


def patch_reserve_risk_tail(
    reserve_df: pd.DataFrame,
    point_candidates: Dict[str, Dict[str, object]],
) -> Tuple[pd.DataFrame, Dict[str, object] | None]:
    best = select_best_reserve_risk_point_source(point_candidates)
    if best is None:
        return reserve_df, None

    point_date = best.get("date")
    point_value = _safe_float(best.get("value"))
    if not isinstance(point_date, pd.Timestamp) or point_value is None:
        return reserve_df, None

    df = reserve_df.copy()
    df["date"] = pd.to_datetime(df["date"])

    mask_same_day = df["date"] == point_date
    if mask_same_day.any():
        current_value = _safe_float(df.loc[mask_same_day, "reserve_risk"].iloc[-1])
        if current_value is not None and abs(current_value - point_value) < 1e-12:
            return reserve_df, None

        df.loc[mask_same_day, "reserve_risk"] = point_value
    else:
        new_row = pd.DataFrame(
            [{"date": point_date, "reserve_risk": point_value}]
        )
        df = pd.concat([df, new_row], ignore_index=True)
        df = df.sort_values("date").reset_index(drop=True)

    return df, best


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
        "lth_sopr",
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

    if merged is None:
        raise RuntimeError("No data was fetched")

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
