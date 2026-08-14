"""HTTP fetching, JSON parsing, and data-source management."""

from __future__ import annotations

import base64
import json
import math
import re
import struct
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Tuple

import pandas as pd
import requests

from .config import (
    CHECKONCHAIN_CHART_SERIES,
    CHECKONCHAIN_STALE_TRIGGER_DAYS,
    INDICATOR_FRESHNESS_MAX_LAG_DAYS,
    LIVE_BTC_PRICE_SOURCES,
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


def parse_nupl_history_series(raw_rows: object) -> pd.DataFrame:
    """Parse NUPL history from either dict-list or chart-file array formats."""
    if not isinstance(raw_rows, list):
        if isinstance(raw_rows, dict):
            point = _parse_nupl_point(raw_rows)
            if point is None:
                return pd.DataFrame(columns=["date", "nupl"])
            return pd.DataFrame([{"date": point[0], "nupl": point[1]}])
        return pd.DataFrame(columns=["date", "nupl"])

    if raw_rows and isinstance(raw_rows[0], list):
        return parse_series("nupl", raw_rows)

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
                "nupl": _safe_float(row.get("nupl")),
            }
        )

    if not parsed:
        return pd.DataFrame(columns=["date", "nupl"])

    df = pd.DataFrame(parsed)
    return df.sort_values("date").groupby("date", as_index=False).last()


def _parse_nupl_point(payload: object) -> Tuple[pd.Timestamp, float] | None:
    point: Dict[str, object] | None = None

    if isinstance(payload, dict):
        if "d" in payload and "nupl" in payload:
            point = payload
    elif isinstance(payload, list) and payload:
        if isinstance(payload[-1], dict):
            point = payload[-1]

    if not point:
        return None

    date_raw = _safe_iso_date(point.get("d"))
    value_raw = _safe_float(point.get("nupl"))
    if not date_raw or value_raw is None:
        return None

    try:
        date_value = pd.to_datetime(date_raw)
    except Exception:
        return None

    return date_value, value_raw


def merge_metric_history_sources(
    metric_key: str, source_frames: Iterable[Tuple[pd.DataFrame, int]]
) -> pd.DataFrame:
    parts: List[pd.DataFrame] = []

    for df, source_rank in source_frames:
        if df.empty or "date" not in df.columns or metric_key not in df.columns:
            continue
        parts.append(
            df.assign(
                _source_rank=int(source_rank),
                _non_null_rank=df[metric_key].notna().astype(int),
            )
        )

    if not parts:
        return pd.DataFrame(columns=["date", metric_key])

    merged = pd.concat(parts, ignore_index=True)
    merged["date"] = pd.to_datetime(merged["date"])
    merged = merged.sort_values(
        ["date", "_non_null_rank", "_source_rank"]
    ).drop_duplicates(subset=["date"], keep="last")
    return merged.drop(columns=["_source_rank", "_non_null_rank"]).reset_index(
        drop=True
    )


def parse_mvrv_zscore_history_series(raw_rows: object) -> pd.DataFrame:
    """Parse MVRV Z-Score history from bitcoin-data.com dict-list format."""
    if not isinstance(raw_rows, list):
        return pd.DataFrame(columns=["date", "mvrv_zscore"])

    if raw_rows and isinstance(raw_rows[0], list):
        return parse_series("mvrv_zscore", raw_rows)

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
                "mvrv_zscore": _safe_float(row.get("mvrvZscore")),
            }
        )

    if not parsed:
        return pd.DataFrame(columns=["date", "mvrv_zscore"])

    df = pd.DataFrame(parsed)
    return df.sort_values("date").groupby("date", as_index=False).last()


def fetch_mvrv_zscore_series(config: Dict[str, object]) -> Tuple[pd.DataFrame, str]:
    """Fetch MVRV Z-Score history; try BGeometrics primary, then bitcoin-data.com.

    bitcoin-data.com rate-limits aggressively, so we add a delay before
    that request and use extra retries with longer backoff.
    """
    source_frames: List[Tuple[pd.DataFrame, int]] = []
    selected_sources: List[str] = []
    errors: List[str] = []

    urls = [str(config["url"])] + [str(x) for x in config.get("fallback_urls", [])]
    for url in urls:
        try:
            raw_data = fetch_json(url)
            df = parse_series("mvrv_zscore", raw_data)
            if not df.empty:
                source_frames.append((df, 0))
                selected_sources.append(url)
                break
            errors.append(f"{url} -> empty MVRV Z-Score chart series")
        except Exception as exc:
            errors.append(f"{url} -> {exc}")

    # bitcoin-data.com is rate-limited; add a quiet period before attempting
    # and use more retries with a longer backoff.
    for url in [str(x) for x in config.get("history_urls", [])]:
        time.sleep(3.0)
        for attempt in range(1, MAX_RETRIES + 2):
            try:
                payload = fetch_json_payload(url)
                df = parse_mvrv_zscore_history_series(payload)
                if not df.empty:
                    source_frames.append((df, 1))
                    selected_sources.append(url)
                else:
                    errors.append(f"{url} -> empty MVRV Z-Score history")
                break
            except Exception as exc:
                errors.append(f"{url} -> {exc}")
                if attempt == MAX_RETRIES + 1:
                    break
                wait_sec = RETRY_BACKOFF_SEC * attempt * 2
                time.sleep(wait_sec)

    merged = merge_metric_history_sources("mvrv_zscore", source_frames)
    if merged.empty:
        last_error = " | ".join(errors[-3:]) if errors else "no usable source"
        raise RuntimeError(f"Failed to fetch mvrv_zscore: {last_error}")

    return merged, " + ".join(selected_sources)


def fetch_nupl_series(config: Dict[str, object]) -> Tuple[pd.DataFrame, str]:
    """Fetch NUPL long history and patch the newest tail from bitcoin-data."""
    source_frames: List[Tuple[pd.DataFrame, int]] = []
    selected_sources: List[str] = []
    errors: List[str] = []

    urls = [str(config["url"])] + [str(x) for x in config.get("fallback_urls", [])]
    for url in urls:
        try:
            raw_data = fetch_json(url)
            df = parse_series("nupl", raw_data)
            if not df.empty:
                source_frames.append((df, 0))
                selected_sources.append(url)
                break
            errors.append(f"{url} -> empty NUPL chart series")
        except Exception as exc:
            errors.append(f"{url} -> {exc}")

    for url in [str(x) for x in config.get("history_urls", [])]:
        try:
            payload = fetch_json_payload(url)
            df = parse_nupl_history_series(payload)
            if not df.empty:
                source_frames.append((df, 1))
                selected_sources.append(url)
            else:
                errors.append(f"{url} -> empty NUPL history")
        except Exception as exc:
            errors.append(f"{url} -> {exc}")

    for url in [str(x) for x in config.get("latest_urls", [])]:
        try:
            payload = fetch_json_payload(url)
            point = _parse_nupl_point(payload)
            if point is None:
                errors.append(f"{url} -> invalid NUPL latest payload")
                continue

            source_frames.append(
                (pd.DataFrame([{"date": point[0], "nupl": point[1]}]), 2)
            )
            selected_sources.append(url)
            break
        except Exception as exc:
            errors.append(f"{url} -> {exc}")

    merged = merge_metric_history_sources("nupl", source_frames)
    if merged.empty:
        last_error = " | ".join(errors[-3:]) if errors else "no usable source"
        raise RuntimeError(f"Failed to fetch nupl: {last_error}")

    return merged, " + ".join(selected_sources)


# ---- Checkonchain fallback (heavy pre-rendered Plotly pages) ---------------


_checkonchain_page_cache: Dict[str, str] = {}
_checkonchain_page_lock = threading.Lock()


def _extract_balanced_json(text: str, start_index: int) -> str | None:
    stack: List[str] = []
    in_string = False
    escaped = False

    for index in range(start_index, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char in "{[":
            stack.append(char)
        elif char in "}]":
            stack.pop()
            if not stack:
                return text[start_index : index + 1]

    return None


def _decode_b64_float64(b64_data: str) -> List[float] | None:
    """Decode a Plotly base64 float64 payload into a list of floats."""
    if not b64_data:
        return None

    try:
        raw = base64.b64decode(b64_data, validate=True)
    except Exception:
        return None

    count = len(raw) // 8
    if count == 0 or len(raw) % 8 != 0:
        return None

    try:
        return [value for (value,) in struct.iter_unpack("<d", raw)]
    except Exception:
        return None


def _parse_checkonchain_traces(html: str) -> List[Dict[str, object]] | None:
    marker = "Plotly.newPlot("
    marker_index = html.find(marker)
    if marker_index < 0:
        return None

    cursor = marker_index + len(marker)
    while cursor < len(html) and html[cursor] not in "[{":
        cursor += 1

    traces_json = _extract_balanced_json(html, cursor)
    if traces_json is None:
        return None

    try:
        payload = json.loads(traces_json)
    except Exception:
        return None

    if not isinstance(payload, list):
        return None
    return payload


def _build_trace_history(trace: Dict[str, object]) -> pd.DataFrame:
    """Build a date/value DataFrame from a single Plotly trace."""
    if not isinstance(trace, dict):
        return pd.DataFrame(columns=["date"])

    x_values = trace.get("x")
    y_obj = trace.get("y")
    b64_data = y_obj.get("bdata") if isinstance(y_obj, dict) else None
    y_values = _decode_b64_float64(str(b64_data)) if b64_data else None

    if not isinstance(x_values, list) or y_values is None:
        return pd.DataFrame(columns=["date"])

    rows: List[Dict[str, object]] = []
    for x_raw, y_raw in zip(x_values, y_values):
        date_raw = _safe_iso_date(x_raw)
        value = _safe_float(y_raw)
        if not date_raw or value is None:
            continue
        rows.append({"date": pd.to_datetime(date_raw), "value": value})

    if not rows:
        return pd.DataFrame(columns=["date"])

    df = pd.DataFrame(rows)
    return df.sort_values("date").groupby("date", as_index=False).last()


def _build_clipped_band_history(
    band_traces: List[Dict[str, object]],
) -> pd.DataFrame:
    """Reconstruct STH-SOPR from two band traces clipped at 1.

    "STH-SOPR > 1" holds the raw value when above 1 (else exactly 1);
    "STH-SOPR < 1" holds the raw value when below 1 (else exactly 1).
    """
    decoded: List[pd.DataFrame] = []
    for trace in band_traces:
        if not isinstance(trace, dict):
            return pd.DataFrame(columns=["date"])

        x_values = trace.get("x")
        y_obj = trace.get("y")
        b64_data = y_obj.get("bdata") if isinstance(y_obj, dict) else None
        y_values = _decode_b64_float64(str(b64_data)) if b64_data else None

        if not isinstance(x_values, list) or y_values is None:
            return pd.DataFrame(columns=["date"])

        rows: List[Dict[str, object]] = []
        for x_raw, y_raw in zip(x_values, y_values):
            date_raw = _safe_iso_date(x_raw)
            value = _safe_float(y_raw)
            if not date_raw or value is None:
                continue
            rows.append({"date": pd.to_datetime(date_raw), "value": value})

        if not rows:
            return pd.DataFrame(columns=["date"])
        decoded.append(pd.DataFrame(rows))

    if len(decoded) < 2:
        return pd.DataFrame(columns=["date"])

    merged = pd.merge(decoded[0], decoded[1], on="date", how="inner")
    merged["value"] = merged.apply(
        lambda row: row["value_x"]
        if abs(float(row["value_x"]) - 1) >= abs(float(row["value_y"]) - 1)
        else row["value_y"],
        axis=1,
    )
    return (
        merged[["date", "value"]]
        .sort_values("date")
        .groupby("date", as_index=False)
        .last()
    )


def _fetch_checkonchain_page(url: str) -> str | None:
    """Fetch a checkonchain chart page (deduped per process via cache)."""
    with _checkonchain_page_lock:
        cached = _checkonchain_page_cache.get(url)
    if cached is not None:
        return cached

    headers = {"User-Agent": "btc-monitor-history-fetcher/1.1"}
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            html = response.text
            if not html:
                raise RuntimeError(f"empty response from {url}")
            with _checkonchain_page_lock:
                _checkonchain_page_cache[url] = html
            return html
        except Exception:
            if attempt == MAX_RETRIES:
                return None
            time.sleep(RETRY_BACKOFF_SEC * attempt)

    return None


def fetch_checkonchain_history(metric_key: str) -> pd.DataFrame:
    """Fetch full history for one LTH/STH metric from checkonchain."""
    config = CHECKONCHAIN_CHART_SERIES.get(metric_key)
    if config is None:
        return pd.DataFrame(columns=["date", metric_key])

    url = str(config["url"])
    html = _fetch_checkonchain_page(url)
    if html is None:
        return pd.DataFrame(columns=["date", metric_key])

    traces = _parse_checkonchain_traces(html)
    if traces is None:
        return pd.DataFrame(columns=["date", metric_key])

    trace_name = config.get("trace")
    if trace_name:
        trace = next(
            (candidate for candidate in traces if candidate.get("name") == trace_name),
            None,
        )
        df = _build_trace_history(trace) if isinstance(trace, dict) else None
    else:
        band_names = [str(name) for name in config.get("band_traces", [])]
        band_traces = [
            next(
                (candidate for candidate in traces if candidate.get("name") == name),
                {},
            )
            for name in band_names
        ]
        df = _build_clipped_band_history(band_traces)

    if df is None or df.empty or "value" not in df.columns:
        return pd.DataFrame(columns=["date", metric_key])

    result = df.rename(columns={"value": metric_key})
    return result.sort_values("date").groupby("date", as_index=False).last()


def fetch_lth_sth_series(
    metric_key: str, config: Dict[str, object]
) -> Tuple[pd.DataFrame, str]:
    """Fetch an LTH/STH metric; extend with checkonchain when the primary lags."""
    urls = [str(config["url"])] + [str(x) for x in config.get("fallback_urls", [])]
    source_frames: List[Tuple[pd.DataFrame, int]] = []
    selected_sources: List[str] = []
    errors: List[str] = []

    for url in urls:
        try:
            raw_data = fetch_json(url)
            df = parse_series(metric_key, raw_data)
            if not df.empty:
                # Rank 1 (higher) so the primary wins ties on overlapping dates;
                # the fallback (rank 0) only fills nulls and extends the tail.
                source_frames.append((df, 1))
                selected_sources.append(url)
                break
            errors.append(f"{url} -> empty {metric_key} chart series")
        except Exception as exc:
            errors.append(f"{url} -> {exc}")

    merged = merge_metric_history_sources(metric_key, source_frames)
    if merged.empty:
        last_error = " | ".join(errors[-3:]) if errors else "no usable source"
        raise RuntimeError(f"Failed to fetch {metric_key}: {last_error}")

    # Extend the tail with checkonchain only when the primary lags too long.
    last_date = pd.to_datetime(merged["date"]).max()
    today = pd.Timestamp.now(tz="utc").date()
    lag_days = (today - last_date.date()).days
    if lag_days > CHECKONCHAIN_STALE_TRIGGER_DAYS:
        try:
            fallback_df = fetch_checkonchain_history(metric_key)
            if not fallback_df.empty:
                source_frames.append((fallback_df, 0))
                selected_sources.append(
                    str(CHECKONCHAIN_CHART_SERIES[metric_key]["url"])
                )
                merged = merge_metric_history_sources(metric_key, source_frames)
        except Exception as exc:
            errors.append(f"checkonchain fallback -> {exc}")

    if merged.empty:
        last_error = " | ".join(errors[-3:]) if errors else "no usable source"
        raise RuntimeError(f"Failed to fetch {metric_key}: {last_error}")

    return merged, " + ".join(selected_sources)


def fetch_metric(
    metric_key: str, config: Dict[str, object]
) -> Tuple[pd.DataFrame, str]:
    """Fetch one metric; try primary URL then fallback URLs."""
    if metric_key == "nupl":
        return fetch_nupl_series(config)
    if metric_key in CHECKONCHAIN_CHART_SERIES:
        return fetch_lth_sth_series(metric_key, config)

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


# ---- Live BTC price (multi-source, near real-time) --------------------------


def _parse_blockchain_stats_price(payload: object) -> float | None:
    """Extract BTC price from blockchain.info/stats JSON."""
    if not isinstance(payload, dict):
        return None
    return _safe_float(payload.get("market_price_usd"))


def _parse_coinbase_spot_price(payload: object) -> float | None:
    """Extract BTC price from Coinbase spot price JSON."""
    if not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    return _safe_float(data.get("amount"))


def _parse_coingecko_simple_price(payload: object) -> float | None:
    """Extract BTC price from CoinGecko simple/price JSON."""
    if not isinstance(payload, dict):
        return None
    btc = payload.get("bitcoin")
    if not isinstance(btc, dict):
        return None
    return _safe_float(btc.get("usd"))


_LIVE_PRICE_PARSERS = {
    "blockchain_stats": _parse_blockchain_stats_price,
    "coinbase_spot": _parse_coinbase_spot_price,
    "coingecko_simple": _parse_coingecko_simple_price,
}


def fetch_live_btc_price() -> Tuple[float, str] | None:
    """Try multiple free real-time BTC price sources; return (price, source_name)."""
    for source in LIVE_BTC_PRICE_SOURCES:
        name = str(source.get("name", ""))
        url = str(source.get("url", ""))
        parser_key = str(source.get("parser", ""))
        parser = _LIVE_PRICE_PARSERS.get(parser_key)
        if not parser:
            continue

        try:
            payload = fetch_json_payload(url)
            price = parser(payload)
            if price is not None and price > 0:
                return price, name
        except Exception:
            continue

    return None


def compute_ma200w_from_price(price_df: pd.DataFrame) -> pd.DataFrame:
    """Compute 200-week moving average (1400-day SMA) from BTC price history.

    This eliminates dependency on BGeometrics 200W-MA chart file updates.
    The 200W-MA is a simple 200-week * 7-day = 1400-day SMA.
    """
    if price_df.empty or "btc_price" not in price_df.columns:
        return pd.DataFrame(columns=["date", "ma200w"])

    df = price_df.sort_values("date").copy()
    df["ma200w"] = df["btc_price"].rolling(window=1400, min_periods=365).mean()
    return df[["date", "ma200w"]].dropna(subset=["ma200w"])


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
    print("BTC Indicators History (multi-source with live price)")
    print("=" * 72)

    # Pre-fetch MVRV Z-Score from bitcoin-data.com before the parallel burst,
    # so we avoid the aggressive rate limit on unauthenticated requests.
    mvrv_zscore_bd_df: pd.DataFrame | None = None
    mvrv_zscore_bd_label: str | None = None
    print("Pre-fetching MVRV Z-Score from bitcoin-data.com ...")
    time.sleep(2.0)
    try:
        bd_payload = fetch_json_payload("https://bitcoin-data.com/v1/mvrv-zscore")
        bd_df = parse_mvrv_zscore_history_series(bd_payload)
        if not bd_df.empty:
            mvrv_zscore_bd_df = bd_df
            mvrv_zscore_bd_label = "https://bitcoin-data.com/v1/mvrv-zscore"
            print(f"  bitcoin-data.com MVRV Z-Score: {len(bd_df)} rows, latest={bd_df['date'].max().date()}")
    except Exception as exc:
        print(f"  bitcoin-data.com MVRV Z-Score unavailable: {exc}")

    # Fetch all indicators except ma200w (we self-compute it from btc_price)
    fetch_keys = [k for k in SERIES_CONFIG if k != "ma200w"]
    futures = {}
    max_workers = min(6, len(fetch_keys))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for key in fetch_keys:
            cfg = SERIES_CONFIG[key]
            display_name = str(cfg.get("display_name", key))
            print(f"Queue fetch: {display_name} ...")
            futures[key] = executor.submit(fetch_metric, key, cfg)

        for key in fetch_keys:
            cfg = SERIES_CONFIG[key]
            display_name = str(cfg.get("display_name", key))
            print(f"Fetching {display_name} ...")
            df, selected_url = futures[key].result()
            dfs[key] = df
            selected_sources[key] = selected_url
            print(f"  Rows: {len(df):,} | Source: {selected_url}")

    # Patch latest BTC price with live real-time source FIRST,
    # so MA200W computation includes the freshest price data.
    live_price = fetch_live_btc_price()
    if live_price is not None and "btc_price" in dfs and not dfs["btc_price"].empty:
        live_value, live_source = live_price
        btc_df = dfs["btc_price"]
        today = pd.Timestamp.now(tz="utc").date()
        latest_row = btc_df.iloc[-1]
        latest_date = latest_row["date"]
        if hasattr(latest_date, "date"):
            latest_date = latest_date.date()
        latest_price = latest_row["btc_price"]

        if latest_price and abs(live_value - latest_price) / latest_price < 0.10:
            if pd.to_datetime(latest_date).date() == today:
                # Update existing today row with fresher live price
                btc_df.loc[btc_df["date"].dt.date == today, "btc_price"] = live_value
                selected_sources["btc_price"] = (
                    f"{selected_sources.get('btc_price', '?')} + live ({live_source}, updated)"
                )
                print(
                    f"  Updated BTC price with live source ({live_source}): "
                    f"${live_value:,.2f} for {today}"
                )
            elif pd.to_datetime(latest_date).date() < today:
                new_row = pd.DataFrame(
                    [{"date": pd.to_datetime(today), "btc_price": live_value}]
                )
                btc_df = pd.concat([btc_df, new_row], ignore_index=True)
                dfs["btc_price"] = btc_df.sort_values("date").reset_index(drop=True)
                selected_sources["btc_price"] = (
                    f"{selected_sources.get('btc_price', '?')} + live ({live_source})"
                )
                print(
                    f"  Patched BTC price with live source ({live_source}): "
                    f"${live_value:,.2f} for {today}"
                )

    # Self-compute 200W-MA from (possibly live-patched) BTC price history
    if "btc_price" in dfs and not dfs["btc_price"].empty:
        print("Computing 200W-MA from BTC price history ...")
        ma200w_df = compute_ma200w_from_price(dfs["btc_price"])
        dfs["ma200w"] = ma200w_df
        selected_sources["ma200w"] = "self_computed_from_btc_price"
        print(f"  Rows: {len(ma200w_df):,} | Source: self-computed (1400-day SMA)")

    # Merge pre-fetched bitcoin-data.com MVRV Z-Score into the BGeometrics data.
    if mvrv_zscore_bd_df is not None and "mvrv_zscore" in dfs and not dfs["mvrv_zscore"].empty:
        merged_df = merge_metric_history_sources(
            "mvrv_zscore",
            [
                (dfs["mvrv_zscore"], 0),
                (mvrv_zscore_bd_df, 1),
            ],
        )
        if not merged_df.empty:
            dfs["mvrv_zscore"] = merged_df
            current_source = selected_sources.get("mvrv_zscore", "?")
            selected_sources["mvrv_zscore"] = f"{current_source} + {mvrv_zscore_bd_label}"
            print(
                f"  Patched MVRV Z-Score with bitcoin-data.com: "
                f"{len(mvrv_zscore_bd_df)} rows"
            )

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
        "nupl",
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
