#!/usr/bin/env python3
"""
Fetch BTC indicator history from BGeometrics chart JSON files.

Data sources:
  - https://charts.bgeometrics.com/files/*.json

Outputs:
  1. Tabular files (CSV/XLSX) for offline analysis
  2. Frontend static files used by the Vite app:
     - app/public/btc_indicators_history.json
     - app/public/btc_indicators_latest.json

Indicators:
  - BTC Price / 200W-MA (calculated)
  - MVRV Z-Score
  - LTH-MVRV
  - Puell Multiple
  - NUPL
"""

from __future__ import annotations

import argparse
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

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
    "mvrv_z_score": {
        "display_name": "MVRV Z-Score",
        "url": "https://charts.bgeometrics.com/files/mvrv_zscore_data.json",
    },
    "lth_mvrv": {
        "display_name": "LTH-MVRV",
        "url": "https://charts.bgeometrics.com/files/lth_mvrv.json",
    },
    "puell_multiple": {
        "display_name": "Puell Multiple",
        "url": "https://charts.bgeometrics.com/files/puell_multiple_data.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/puell_multiple_7dma.json",
        ],
    },
    "nupl": {
        "display_name": "NUPL",
        "url": "https://charts.bgeometrics.com/files/nupl_data.json",
        "fallback_urls": [
            "https://charts.bgeometrics.com/files/nupl_7dma.json",
        ],
    },
}

REQUEST_TIMEOUT = 45
MAX_RETRIES = 4
RETRY_BACKOFF_SEC = 2.0


def _safe_float(value: object) -> float | None:
    if value is None:
        return None
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


def build_base_dataframe(
    start_date: str | None = None,
    end_date: str | None = None,
) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Fetch all required data and build merged base DataFrame."""
    dfs: Dict[str, pd.DataFrame] = {}
    selected_sources: Dict[str, str] = {}

    print("=" * 72)
    print("BTC Indicators History (BGeometrics chart files mode)")
    print("=" * 72)

    for key, cfg in SERIES_CONFIG.items():
        display_name = str(cfg.get("display_name", key))
        print(f"Fetching {display_name} ...")
        df, selected_url = fetch_metric(key, cfg)
        dfs[key] = df
        selected_sources[key] = selected_url
        print(f"  Rows: {len(df):,} | Source: {selected_url}")

    merged: pd.DataFrame | None = None
    for key in ["btc_price", "ma200w", "mvrv_z_score", "lth_mvrv", "puell_multiple", "nupl"]:
        current = dfs[key]
        merged = current if merged is None else pd.merge(merged, current, on="date", how="outer")

    assert merged is not None
    merged = merged.sort_values("date").reset_index(drop=True)

    if start_date:
        merged = merged[merged["date"] >= pd.to_datetime(start_date)]
    if end_date:
        merged = merged[merged["date"] <= pd.to_datetime(end_date)]

    return merged.reset_index(drop=True), selected_sources


def enrich_for_frontend(base_df: pd.DataFrame) -> pd.DataFrame:
    """Build frontend-ready columns including ffilled metrics and signal flags."""
    df = base_df.copy()

    metric_cols = [
        "btc_price",
        "ma200w",
        "mvrv_z_score",
        "lth_mvrv",
        "puell_multiple",
        "nupl",
    ]

    # Track last real update date per indicator (before forward-fill).
    for col in metric_cols:
        date_col = f"{col}_date"
        df[date_col] = df["date"].where(df[col].notna(), pd.NaT).ffill()

    # Forward-fill indicator values so latest row stays usable in UI.
    for col in metric_cols:
        df[col] = df[col].ffill()

    # Derived metric.
    df["price_200w_ma_ratio"] = df["btc_price"] / df["ma200w"].replace(0, pd.NA)

    # Signal flags.
    df["signal_price_ma"] = df["price_200w_ma_ratio"].fillna(float("inf")) < 1
    df["signal_mvrv_z"] = df["mvrv_z_score"].fillna(float("inf")) < 0
    df["signal_lth_mvrv"] = df["lth_mvrv"].fillna(float("inf")) < 1
    df["signal_puell"] = df["puell_multiple"].fillna(float("inf")) < 0.5
    df["signal_nupl"] = df["nupl"].fillna(float("inf")) < 0

    signal_cols = [
        "signal_price_ma",
        "signal_mvrv_z",
        "signal_lth_mvrv",
        "signal_puell",
        "signal_nupl",
    ]
    df["signal_count"] = df[signal_cols].sum(axis=1)

    return df


def build_tabular_view(frontend_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare human-readable table used for CSV/XLSX exports."""
    return frontend_df.rename(
        columns={
            "date": "Date",
            "price_200w_ma_ratio": "BTC_Price_200W_MA_Ratio",
            "mvrv_z_score": "MVRV_Z_Score",
            "lth_mvrv": "LTH_MVRV",
            "puell_multiple": "Puell_Multiple",
            "nupl": "NUPL",
        }
    )[
        [
            "Date",
            "BTC_Price_200W_MA_Ratio",
            "MVRV_Z_Score",
            "LTH_MVRV",
            "Puell_Multiple",
            "NUPL",
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
                "priceMa200wRatio": _safe_float(getattr(row, "price_200w_ma_ratio")),
                "mvrvZscore": _safe_float(getattr(row, "mvrv_z_score")),
                "lthMvrv": _safe_float(getattr(row, "lth_mvrv")),
                "puellMultiple": _safe_float(getattr(row, "puell_multiple")),
                "nupl": _safe_float(getattr(row, "nupl")),
                "signalPriceMa": bool(getattr(row, "signal_price_ma")),
                "signalMvrvZ": bool(getattr(row, "signal_mvrv_z")),
                "signalLthMvrv": bool(getattr(row, "signal_lth_mvrv")),
                "signalPuell": bool(getattr(row, "signal_puell")),
                "signalNupl": bool(getattr(row, "signal_nupl")),
                "signalCount": int(getattr(row, "signal_count")),
                "api_data_date": {
                    "price_ma200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "mvrv_z": _safe_iso_date(getattr(row, "mvrv_z_score_date")),
                    "lth_mvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "puell": _safe_iso_date(getattr(row, "puell_multiple_date")),
                    "nupl": _safe_iso_date(getattr(row, "nupl_date")),
                },
            }
        )

    return records


def build_latest_json(frontend_df: pd.DataFrame) -> Dict[str, object]:
    """Build latest snapshot JSON from the last history row."""
    if frontend_df.empty:
        raise ValueError("Cannot build latest JSON from empty dataframe")

    last = frontend_df.iloc[-1]
    date_value = _safe_iso_date(last["date"])
    if not date_value:
        raise ValueError("Latest row has no valid date")

    latest_payload = {
        "date": date_value,
        "btcPrice": _safe_float(last["btc_price"]) or 0.0,
        "priceMa200wRatio": _safe_float(last["price_200w_ma_ratio"]) or 0.0,
        "ma200w": _safe_float(last["ma200w"]),
        "mvrvZscore": _safe_float(last["mvrv_z_score"]) or 0.0,
        "lthMvrv": _safe_float(last["lth_mvrv"]) or 0.0,
        "puellMultiple": _safe_float(last["puell_multiple"]) or 0.0,
        "nupl": _safe_float(last["nupl"]) or 0.0,
        "signalCount": int(last["signal_count"]),
        "signals": {
            "priceMa200w": bool(last["signal_price_ma"]),
            "mvrvZ": bool(last["signal_mvrv_z"]),
            "lthMvrv": bool(last["signal_lth_mvrv"]),
            "puell": bool(last["signal_puell"]),
            "nupl": bool(last["signal_nupl"]),
        },
        "indicatorDates": {
            "priceMa200w": _safe_iso_date(last["btc_price_date"]) or date_value,
            "mvrvZ": _safe_iso_date(last["mvrv_z_score_date"]) or date_value,
            "lthMvrv": _safe_iso_date(last["lth_mvrv_date"]) or date_value,
            "puell": _safe_iso_date(last["puell_multiple_date"]) or date_value,
            "nupl": _safe_iso_date(last["nupl_date"]) or date_value,
        },
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }
    return latest_payload


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
    latest_path: Path,
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
    for key in ["btc_price", "ma200w", "mvrv_z_score", "lth_mvrv", "puell_multiple", "nupl"]:
        print(f"  - {key}: {sources.get(key, '-')}")

    print()
    print("Frontend JSON files:")
    print(f"  - history: {history_path}")
    print(f"  - latest : {latest_path}")


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
        "--skip-tabular",
        action="store_true",
        help="Skip CSV/XLSX outputs and only write frontend JSON files.",
    )
    args = parser.parse_args()

    base_df, sources = build_base_dataframe(args.start_date, args.end_date)
    if base_df.empty:
        print("No data after filtering. Nothing saved.")
        return 1

    frontend_df = enrich_for_frontend(base_df)
    tabular_df = build_tabular_view(frontend_df)

    history_json = dataframe_to_history_json(frontend_df)
    latest_json = build_latest_json(frontend_df)

    history_path = Path(args.history_json_path)
    latest_path = Path(args.latest_json_path)
    write_json(history_path, history_json)
    write_json(latest_path, latest_json)

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

    print_summary(tabular_df, sources, history_path, latest_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
