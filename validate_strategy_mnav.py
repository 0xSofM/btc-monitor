#!/usr/bin/env python3
"""Validate Strategy mNAV JSON outputs."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _as_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        if not cleaned:
            return None
        try:
            parsed = float(cleaned)
            if math.isnan(parsed):
                return None
            return parsed
        except ValueError:
            return None
    return None


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_date(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def validate_strategy_mnav_pair(
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
    max_mstr_lag_days: int = 7,
    max_btc_lag_hours: int = 36,
    check_freshness: bool = True,
    now: datetime | None = None,
) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)

    if not isinstance(latest, dict):
        return False, ["Latest Strategy mNAV JSON must be an object."]
    if not isinstance(history, list):
        return False, ["Strategy mNAV history JSON must be an array."]

    latest_date = latest.get("date")
    if _parse_date(latest_date) is None:
        errors.append("Latest Strategy mNAV date must be YYYY-MM-DD.")

    mstr = latest.get("mstr")
    reserve = latest.get("btcReserve")
    mnav = latest.get("mnav")
    if not isinstance(mstr, dict):
        errors.append("Latest Strategy mNAV payload missing mstr object.")
        mstr = {}
    if not isinstance(reserve, dict):
        errors.append("Latest Strategy mNAV payload missing btcReserve object.")
        reserve = {}
    if not isinstance(mnav, dict):
        errors.append("Latest Strategy mNAV payload missing mnav object.")
        mnav = {}

    enterprise_value = _as_number(mstr.get("enterpriseValueUsdM"))
    btc_reserve = _as_number(reserve.get("btcReserveUsdM"))
    mnav_value = _as_number(mnav.get("value"))
    if enterprise_value is None or enterprise_value <= 0:
        errors.append("enterpriseValueUsdM must be positive.")
    if btc_reserve is None or btc_reserve <= 0:
        errors.append("btcReserveUsdM must be positive.")
    if mnav_value is None:
        errors.append("mnav.value must be numeric.")
    else:
        if not 0.2 <= mnav_value <= 10:
            errors.append(f"mnav.value out of expected range: {mnav_value}.")
        if enterprise_value and btc_reserve:
            expected = enterprise_value / btc_reserve
            if abs(mnav_value - expected) > 0.01:
                errors.append(
                    f"mnav.value ({mnav_value}) does not match EV/BTC reserve ({expected:.4f})."
                )

    for key in ("btcHoldings", "btcPriceUsd"):
        value = _as_number(reserve.get(key))
        if value is None or value <= 0:
            errors.append(f"btcReserve.{key} must be positive.")

    generated_at = _parse_timestamp(latest.get("generatedAt"))
    mstr_timestamp = _parse_timestamp(mstr.get("timestampUtc"))
    btc_timestamp = _parse_timestamp(reserve.get("timestamp"))
    if generated_at is None:
        errors.append("generatedAt must be an ISO timestamp.")
    if mstr_timestamp is None:
        errors.append("mstr.timestampUtc must be an ISO timestamp.")
    elif check_freshness:
        mstr_lag_days = (now - mstr_timestamp).total_seconds() / 86400
        if mstr_lag_days > max_mstr_lag_days:
            errors.append(
                f"MSTR market data is stale: {mstr_lag_days:.1f} days old."
            )
        if mstr_lag_days < -1:
            errors.append("MSTR market timestamp is unexpectedly in the future.")
    if btc_timestamp is None:
        errors.append("btcReserve.timestamp must be an ISO timestamp.")
    elif check_freshness:
        btc_lag_hours = (now - btc_timestamp).total_seconds() / 3600
        if btc_lag_hours > max_btc_lag_hours:
            errors.append(f"BTC reserve data is stale: {btc_lag_hours:.1f} hours old.")
        if btc_lag_hours < -1:
            errors.append("BTC reserve timestamp is unexpectedly in the future.")

    seen_dates: set[str] = set()
    previous_date = ""
    for index, row in enumerate(history):
        if not isinstance(row, dict):
            errors.append(f"History row {index} must be an object.")
            continue
        date = row.get("d")
        if _parse_date(date) is None:
            errors.append(f"History row {index} has invalid date: {date!r}.")
            continue
        date_str = str(date)
        if date_str in seen_dates:
            errors.append(f"History has duplicate date: {date_str}.")
        if previous_date and date_str < previous_date:
            errors.append("History rows must be sorted by date ascending.")
        seen_dates.add(date_str)
        previous_date = date_str

    if not history:
        errors.append("Strategy mNAV history must contain at least one row.")
    elif isinstance(history[-1], dict):
        tail = history[-1]
        if tail.get("d") != latest_date:
            errors.append(
                f"History tail date ({tail.get('d')}) does not match latest date ({latest_date})."
            )
        tail_mnav = _as_number(tail.get("mnav"))
        if mnav_value is not None and tail_mnav is not None and abs(tail_mnav - mnav_value) > 0.0001:
            errors.append(
                f"History tail mNAV ({tail_mnav}) does not match latest mNAV ({mnav_value})."
            )

    return len(errors) == 0, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Strategy mNAV JSON files.")
    parser.add_argument("--current-latest", required=True, help="Current Strategy mNAV latest JSON path.")
    parser.add_argument("--current-history", required=True, help="Current Strategy mNAV history JSON path.")
    parser.add_argument("--max-mstr-lag-days", type=int, default=7)
    parser.add_argument("--max-btc-lag-hours", type=int, default=36)
    parser.add_argument(
        "--skip-freshness-check",
        action="store_true",
        help="Validate structure/formula but do not fail when checked-in market data ages.",
    )
    args = parser.parse_args()

    latest = load_json(Path(args.current_latest))
    history = load_json(Path(args.current_history))
    ok, errors = validate_strategy_mnav_pair(
        latest,
        history,
        max_mstr_lag_days=max(0, args.max_mstr_lag_days),
        max_btc_lag_hours=max(1, args.max_btc_lag_hours),
        check_freshness=not args.skip_freshness_check,
    )
    if not ok:
        print("Strategy mNAV validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Strategy mNAV validation passed.")
    print(f"- latest date : {latest.get('date')}")
    print(f"- history rows: {len(history)}")
    print(f"- mNAV        : {latest.get('mnav', {}).get('value')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
