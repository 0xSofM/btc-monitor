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
    "priceRealizedRatio",
    "mvrvZscore",
    "lthMvrv",
    "sthSopr",
    "sthMvrv",
    "puellMultiple",
]

INDICATOR_DATE_FIELDS = {
    "priceMa200w": ("priceMa200w", "price_ma200w"),
    "priceRealized": ("priceRealized", "price_realized"),
    "reserveRisk": ("reserveRisk", "reserve_risk"),
    "mvrvZscore": ("mvrvZscore", "mvrv_zscore"),
    "lthMvrv": ("lthMvrv", "lth_mvrv"),
    "sthSopr": ("sthSopr", "sth_sopr"),
    "sthMvrv": ("sthMvrv", "sth_mvrv"),
    "puell": ("puell", "puell"),
}

INDICATOR_MAX_LAG_OVERRIDES = {
    # Reserve Risk remains an observation metric and can legitimately lag more than Core-6.
    "reserveRisk": 30,
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


def _as_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _grouped_short_term_signal(sopr: Any, mvrv: Any, group: Any = None) -> bool:
    if group is not None:
        return bool(group)
    return bool(sopr) or bool(mvrv)


def _grouped_short_term_score(sopr: Any, mvrv: Any, group: Any = None) -> int:
    if group is not None:
        return _as_int(group)
    return max(_as_int(sopr), _as_int(mvrv))


def compute_signal_count_from_row(row: Dict[str, Any]) -> int:
    price_ma_signal = row.get("signalPriceMa200w")
    if price_ma_signal is None:
        price_ma_signal = row.get("signalPriceMa")

    short_term_group = _grouped_short_term_signal(
        row.get("signalSthSopr"),
        row.get("signalSthMvrv"),
        row.get("signalSthGroup"),
    )

    return sum(
        [
            bool(price_ma_signal),
            bool(row.get("signalPriceRealized")),
            bool(row.get("signalReserveRisk")),
            short_term_group,
            bool(row.get("signalPuell")),
        ]
    )


def compute_signal_count_from_latest(latest: Dict[str, Any]) -> int:
    signals = latest.get("signals")
    if not isinstance(signals, dict):
        return -1

    short_term_group = _grouped_short_term_signal(
        signals.get("sthSopr"),
        signals.get("sthMvrv"),
        signals.get("sthGroup"),
    )

    return sum(
        [
            bool(signals.get("priceMa200w")),
            bool(signals.get("priceRealized")),
            bool(signals.get("reserveRisk")),
            short_term_group,
            bool(signals.get("puell")),
        ]
    )


def compute_signal_score_from_row(row: Dict[str, Any]) -> int:
    short_term_group_score = _grouped_short_term_score(
        row.get("scoreSthSopr"),
        row.get("scoreSthMvrv"),
        row.get("scoreSthGroup"),
    )

    return sum(
        [
            _as_int(row.get("scorePriceMa200w")),
            _as_int(row.get("scorePriceRealized")),
            _as_int(row.get("scoreReserveRisk")),
            short_term_group_score,
            _as_int(row.get("scorePuell")),
        ]
    )


def compute_signal_score_from_latest_payload(latest: Dict[str, Any]) -> int | None:
    reserve_score = latest.get("scoreReserveRisk")
    if reserve_score is None:
        source_mode = str(latest.get("reserveRiskSourceMode") or "").lower()
        if source_mode == "replacement":
            reserve_score = latest.get("scoreReserveRiskReplacement")
        elif source_mode == "primary":
            reserve_score = latest.get("scoreReserveRiskPrimary")
        else:
            reserve_score = latest.get("scoreReserveRiskPrimary")
            if reserve_score is None:
                reserve_score = latest.get("scoreReserveRiskReplacement")

    has_any_component_score = any(
        latest.get(key) is not None
        for key in (
            "scorePriceMa200w",
            "scorePriceRealized",
            "scoreReserveRisk",
            "scoreReserveRiskPrimary",
            "scoreReserveRiskReplacement",
            "scoreSthSopr",
            "scoreSthMvrv",
            "scoreSthGroup",
            "scorePuell",
        )
    )
    if not has_any_component_score:
        return None

    return sum(
        [
            _as_int(latest.get("scorePriceMa200w")),
            _as_int(latest.get("scorePriceRealized")),
            _as_int(reserve_score),
            _grouped_short_term_score(
                latest.get("scoreSthSopr"),
                latest.get("scoreSthMvrv"),
                latest.get("scoreSthGroup"),
            ),
            _as_int(latest.get("scorePuell")),
        ]
    )


def compute_signal_count_v4_from_row(row: Dict[str, Any]) -> int:
    return sum(
        [
            bool(row.get("signalPriceMa200w") or row.get("signalPriceMa")),
            bool(row.get("signalPriceRealized")),
            bool(row.get("signalMvrvZscoreCore") or row.get("signalReserveRiskV4")),
            bool(row.get("signalSthMvrv")),
            bool(row.get("signalLthMvrv")),
            bool(row.get("signalPuell")),
        ]
    )


def compute_signal_count_v4_from_latest(latest: Dict[str, Any]) -> int:
    signals = latest.get("signalsV4")
    if not isinstance(signals, dict):
        return -1

    return sum(
        [
            bool(signals.get("priceMa200w")),
            bool(signals.get("priceRealized")),
            bool(signals.get("mvrvZscore") or signals.get("reserveRisk")),
            bool(signals.get("sthMvrv")),
            bool(signals.get("lthMvrv")),
            bool(signals.get("puell")),
        ]
    )


def compute_total_score_v4_from_row(row: Dict[str, Any]) -> int | None:
    required = ("valuationScore", "triggerScore", "confirmationScore")
    if not any(row.get(key) is not None for key in required):
        return None

    return sum(
        [
            _as_int(row.get("valuationScore")),
            _as_int(row.get("triggerScore")),
            _as_int(row.get("confirmationScore")),
        ]
    )


def compute_total_score_v4_from_latest(latest: Dict[str, Any]) -> int | None:
    required = ("valuationScore", "triggerScore", "confirmationScore")
    if not any(latest.get(key) is not None for key in required):
        return None

    return sum(
        [
            _as_int(latest.get("valuationScore")),
            _as_int(latest.get("triggerScore")),
            _as_int(latest.get("confirmationScore")),
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

        if "signalScoreV2" in row:
            score_expected = compute_signal_score_from_row(row)
            score_actual = row.get("signalScoreV2")
            if score_actual is None or int(score_actual) != score_expected:
                errors.append(
                    f"Row {idx} signalScoreV2 mismatch: expected {score_expected}, got {score_actual}."
                )
                break

        if "signalCountV4" in row:
            count_v4_expected = compute_signal_count_v4_from_row(row)
            count_v4_actual = row.get("signalCountV4")
            if count_v4_actual is None or int(count_v4_actual) != count_v4_expected:
                errors.append(
                    f"Row {idx} signalCountV4 mismatch: expected {count_v4_expected}, got {count_v4_actual}."
                )
                break

        if "totalScoreV4" in row:
            total_v4_expected = compute_total_score_v4_from_row(row)
            total_v4_actual = row.get("totalScoreV4")
            if total_v4_expected is not None and (
                total_v4_actual is None or int(total_v4_actual) != total_v4_expected
            ):
                errors.append(
                    f"Row {idx} totalScoreV4 mismatch: expected {total_v4_expected}, got {total_v4_actual}."
                )
                break

    latest_expected = compute_signal_count_from_latest(latest)
    latest_actual = latest.get("signalCount")
    if latest_expected < 0:
        errors.append("Latest payload missing 'signals' object.")
    elif latest_actual is None or int(latest_actual) != latest_expected:
        errors.append(
            f"Latest signalCount mismatch: expected {latest_expected}, got {latest_actual}."
        )

    if "signalScoreV2" in latest:
        latest_score_expected = compute_signal_score_from_latest_payload(latest)
        if latest_score_expected is None and history:
            tail_score = history[-1].get("signalScoreV2")
            latest_score_expected = _as_int(tail_score) if tail_score is not None else None
        latest_score_actual = latest.get("signalScoreV2")
        if latest_score_expected is not None and (
            latest_score_actual is None or int(latest_score_actual) != latest_score_expected
        ):
            errors.append(
                f"Latest signalScoreV2 mismatch: expected {latest_score_expected}, got {latest_score_actual}."
            )

    if "signalCountV4" in latest:
        latest_count_v4_expected = compute_signal_count_v4_from_latest(latest)
        latest_count_v4_actual = latest.get("signalCountV4")
        if latest_count_v4_expected < 0:
            errors.append("Latest payload missing 'signalsV4' object.")
        elif latest_count_v4_actual is None or int(latest_count_v4_actual) != latest_count_v4_expected:
            errors.append(
                f"Latest signalCountV4 mismatch: expected {latest_count_v4_expected}, got {latest_count_v4_actual}."
            )

    if "totalScoreV4" in latest:
        latest_total_v4_expected = compute_total_score_v4_from_latest(latest)
        latest_total_v4_actual = latest.get("totalScoreV4")
        if latest_total_v4_expected is not None and (
            latest_total_v4_actual is None or int(latest_total_v4_actual) != latest_total_v4_expected
        ):
            errors.append(
                f"Latest totalScoreV4 mismatch: expected {latest_total_v4_expected}, got {latest_total_v4_actual}."
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


def get_inactive_indicator_keys(latest: Dict[str, Any]) -> set[str]:
    inactive_raw = latest.get("inactiveIndicators")
    if not isinstance(inactive_raw, list):
        return set()

    inactive: set[str] = set()
    for item in inactive_raw:
        if isinstance(item, str):
            inactive.add(item)
            continue

        if isinstance(item, dict):
            key = item.get("key")
            if isinstance(key, str) and key:
                inactive.add(key)

    return inactive


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

    inactive_indicators = get_inactive_indicator_keys(latest)

    for indicator_key in INDICATOR_DATE_FIELDS:
        if indicator_key in inactive_indicators:
            continue

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
        allowed_lag_days = max(max_lag_days, INDICATOR_MAX_LAG_OVERRIDES.get(indicator_key, max_lag_days))
        if lag_days > allowed_lag_days:
            errors.append(
                f"Indicator '{indicator_key}' is stale by {lag_days} days "
                f"(latest={latest_date_raw}, indicator={indicator_date_raw}, max={allowed_lag_days})."
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
