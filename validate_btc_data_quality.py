#!/usr/bin/env python3
"""
Validate BTC indicator JSON outputs before auto-commit.

Checks:
1. Latest date must not move backward versus previous snapshot.
2. History row count must not drop unexpectedly.
3. Critical fields must have recent non-null values.
4. signalCount must match per-row signal booleans and latest payload.
5. History ordering/basic structure checks.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple


CRITICAL_FIELDS = [
    "priceMa200wRatio",
    "mvrvZscore",
    "lthMvrv",
    "puellMultiple",
    "nupl",
]

INDICATOR_DATE_FIELDS = {
    "priceMa200w": ("priceMa200w", "price_ma200w"),
    "mvrvZ": ("mvrvZ", "mvrv_z"),
    "lthMvrv": ("lthMvrv", "lth_mvrv"),
    "puell": ("puell", "puell"),
    "nupl": ("nupl", "nupl"),
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_date(value: Any) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError(f"Invalid date value: {value!r}")
    return datetime.strptime(value, "%Y-%m-%d")


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return False


def compute_signal_count_from_row(row: Dict[str, Any]) -> int:
    return sum(
        [
            bool(row.get("signalPriceMa")),
            bool(row.get("signalMvrvZ")),
            bool(row.get("signalLthMvrv")),
            bool(row.get("signalPuell")),
            bool(row.get("signalNupl")),
        ]
    )


def compute_signal_count_from_latest(latest: Dict[str, Any]) -> int:
    signals = latest.get("signals")
    if not isinstance(signals, dict):
        return -1
    return sum(
        [
            bool(signals.get("priceMa200w")),
            bool(signals.get("mvrvZ")),
            bool(signals.get("lthMvrv")),
            bool(signals.get("puell")),
            bool(signals.get("nupl")),
        ]
    )


def validate_history_structure(history: List[Dict[str, Any]], errors: List[str]) -> None:
    if not history:
        errors.append("Current history is empty.")
        return

    seen_dates = set()
    prev_date: datetime | None = None
    for idx, row in enumerate(history):
        try:
            date = parse_date(row.get("d"))
        except Exception as exc:  # noqa: PERF203
            errors.append(f"Row {idx} has invalid date: {exc}")
            continue

        if prev_date and date < prev_date:
            errors.append(f"History dates are not sorted at row {idx}: {date} < {prev_date}")
        prev_date = date

        date_key = row.get("d")
        if date_key in seen_dates:
            errors.append(f"Duplicate history date detected: {date_key}")
        seen_dates.add(date_key)


def validate_recent_non_null(history: List[Dict[str, Any]], lookback_rows: int, errors: List[str]) -> None:
    if not history:
        return

    recent = history[-lookback_rows:] if len(history) > lookback_rows else history
    for field in CRITICAL_FIELDS:
        if all(is_missing(row.get(field)) for row in recent):
            errors.append(
                f"Critical field '{field}' is missing in all recent {len(recent)} rows."
            )


def validate_signal_consistency(history: List[Dict[str, Any]], latest: Dict[str, Any], errors: List[str]) -> None:
    for idx, row in enumerate(history):
        expected = compute_signal_count_from_row(row)
        actual = row.get("signalCount")
        if actual is None:
            errors.append(f"Row {idx} missing signalCount.")
            continue
        if int(actual) != expected:
            errors.append(f"Row {idx} signalCount mismatch: expected {expected}, got {actual}.")
            break

    latest_expected = compute_signal_count_from_latest(latest)
    latest_actual = latest.get("signalCount")
    if latest_expected < 0:
        errors.append("Latest payload missing 'signals' object.")
    elif latest_actual is None or int(latest_actual) != latest_expected:
        errors.append(
            f"Latest signalCount mismatch: expected {latest_expected}, got {latest_actual}."
        )


def get_latest_indicator_date(latest: Dict[str, Any], indicator_key: str) -> str:
    candidates = INDICATOR_DATE_FIELDS[indicator_key]

    indicator_dates = latest.get("indicatorDates")
    if isinstance(indicator_dates, dict):
        for key in candidates:
            value = indicator_dates.get(key)
            if isinstance(value, str) and value:
                return value

    api_data_date = latest.get("api_data_date")
    if isinstance(api_data_date, dict):
        for key in candidates:
            value = api_data_date.get(key)
            if isinstance(value, str) and value:
                return value

    return ""


def get_history_tail_indicator_date(history: List[Dict[str, Any]], indicator_key: str) -> str:
    if not history:
        return ""

    tail = history[-1]
    candidates = INDICATOR_DATE_FIELDS[indicator_key]

    api_data_date = tail.get("api_data_date")
    if isinstance(api_data_date, dict):
        for key in candidates:
            value = api_data_date.get(key)
            if isinstance(value, str) and value:
                return value

    indicator_dates = tail.get("indicatorDates")
    if isinstance(indicator_dates, dict):
        for key in candidates:
            value = indicator_dates.get(key)
            if isinstance(value, str) and value:
                return value

    return ""


def validate_indicator_staleness(
    history: List[Dict[str, Any]],
    latest: Dict[str, Any],
    max_lag_days: int,
    errors: List[str],
) -> None:
    if max_lag_days < 0:
        return

    latest_date_raw = latest.get("date") or (history[-1].get("d") if history else "")
    if not latest_date_raw:
        errors.append("Cannot validate indicator staleness: missing latest date.")
        return

    try:
        latest_date = parse_date(latest_date_raw)
    except Exception as exc:
        errors.append(f"Cannot validate indicator staleness: invalid latest date ({exc}).")
        return

    for indicator_key in INDICATOR_DATE_FIELDS:
        indicator_date_raw = get_latest_indicator_date(latest, indicator_key)
        if not indicator_date_raw:
            indicator_date_raw = get_history_tail_indicator_date(history, indicator_key)

        if not indicator_date_raw:
            errors.append(
                f"Missing indicator date for '{indicator_key}', cannot verify staleness."
            )
            continue

        try:
            indicator_date = parse_date(indicator_date_raw)
        except Exception as exc:
            errors.append(
                f"Invalid indicator date for '{indicator_key}': {indicator_date_raw} ({exc})."
            )
            continue

        lag_days = (latest_date - indicator_date).days
        if lag_days > max_lag_days:
            errors.append(
                f"Indicator '{indicator_key}' is stale by {lag_days} days "
                f"(latest={latest_date_raw}, indicator={indicator_date_raw}, max={max_lag_days})."
            )


def validate_current_pair(
    history: List[Dict[str, Any]],
    latest: Dict[str, Any],
    lookback_rows: int,
    max_indicator_lag_days: int,
) -> Tuple[bool, List[str]]:
    errors: List[str] = []

    validate_history_structure(history, errors)
    validate_recent_non_null(history, lookback_rows, errors)
    validate_signal_consistency(history, latest, errors)
    validate_indicator_staleness(history, latest, max_indicator_lag_days, errors)

    if history:
        history_last_date = str(history[-1].get("d", ""))
        latest_date = str(latest.get("date", ""))
        if latest_date != history_last_date:
            errors.append(
                f"Latest date ({latest_date}) does not match history tail date ({history_last_date})."
            )

    if all(is_missing(latest.get(field)) for field in CRITICAL_FIELDS):
        errors.append("All critical fields are missing in latest payload.")

    return (len(errors) == 0), errors


def validate_against_previous(
    prev_history: List[Dict[str, Any]],
    prev_latest: Dict[str, Any],
    curr_history: List[Dict[str, Any]],
    curr_latest: Dict[str, Any],
    max_row_drop: int,
    errors: List[str],
) -> None:
    if prev_history:
        prev_rows = len(prev_history)
        curr_rows = len(curr_history)
        if curr_rows < (prev_rows - max_row_drop):
            errors.append(
                f"History rows dropped too much: previous={prev_rows}, current={curr_rows}, max_drop={max_row_drop}."
            )

    prev_date_raw = prev_latest.get("date")
    curr_date_raw = curr_latest.get("date")
    if prev_date_raw and curr_date_raw:
        prev_date = parse_date(prev_date_raw)
        curr_date = parse_date(curr_date_raw)
        if curr_date < prev_date:
            errors.append(f"Latest date moved backward: previous={prev_date_raw}, current={curr_date_raw}.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate BTC indicator data quality.")
    parser.add_argument("--current-history", required=True, help="Path to current history JSON.")
    parser.add_argument("--current-latest", required=True, help="Path to current latest JSON.")
    parser.add_argument("--previous-history", default="", help="Path to previous history JSON.")
    parser.add_argument("--previous-latest", default="", help="Path to previous latest JSON.")
    parser.add_argument("--lookback-rows", type=int, default=30, help="Rows checked for recent non-null critical fields.")
    parser.add_argument("--max-row-drop", type=int, default=5, help="Allowed max row drop versus previous history.")
    parser.add_argument(
        "--max-indicator-lag-days",
        type=int,
        default=21,
        help="Max allowed lag days between latest date and per-indicator actual data date.",
    )
    args = parser.parse_args()

    current_history_path = Path(args.current_history)
    current_latest_path = Path(args.current_latest)
    current_history = load_json(current_history_path)
    current_latest = load_json(current_latest_path)

    if not isinstance(current_history, list):
        print("ERROR: Current history JSON must be an array.")
        return 1
    if not isinstance(current_latest, dict):
        print("ERROR: Current latest JSON must be an object.")
        return 1

    ok, errors = validate_current_pair(
        current_history,
        current_latest,
        args.lookback_rows,
        max(0, args.max_indicator_lag_days),
    )

    if args.previous_history and args.previous_latest:
        prev_history_path = Path(args.previous_history)
        prev_latest_path = Path(args.previous_latest)
        if prev_history_path.exists() and prev_latest_path.exists():
            prev_history = load_json(prev_history_path)
            prev_latest = load_json(prev_latest_path)
            if isinstance(prev_history, list) and isinstance(prev_latest, dict):
                validate_against_previous(
                    prev_history=prev_history,
                    prev_latest=prev_latest,
                    curr_history=current_history,
                    curr_latest=current_latest,
                    max_row_drop=max(0, args.max_row_drop),
                    errors=errors,
                )

    if errors:
        print("DATA QUALITY VALIDATION FAILED")
        for err in errors:
            print(f"- {err}")
        return 1

    print("Data quality validation passed.")
    print(f"- history rows: {len(current_history)}")
    print(f"- latest date : {current_latest.get('date')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
