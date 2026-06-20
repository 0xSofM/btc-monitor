"""Strategy official mNAV fetching, normalization, and history helpers."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List

from .fetcher import fetch_json_payload


STRATEGY_BITCOIN_KPIS_URL = "https://api.strategy.com/btc/bitcoinKpis"
STRATEGY_MSTR_KPI_URL = "https://api.strategy.com/btc/mstrKpiData"
STRATEGY_SOURCE_NAME = "strategy_official_api"
STRATEGY_MNAV_FORMULA = "enterpriseValueUsd / btcReserveUsd"


def _parse_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "").replace("$", "")
        if not cleaned:
            return None
        try:
            parsed = float(cleaned)
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


def _parse_int(value: Any) -> int | None:
    parsed = _parse_number(value)
    if parsed is None:
        return None
    return int(parsed)


def _as_iso_timestamp(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _round(value: float | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def classify_mnav_band(mnav: float | None) -> str:
    if mnav is None:
        return "unknown"
    if mnav < 1.0:
        return "discount"
    if mnav < 1.3:
        return "low_premium"
    if mnav < 2.0:
        return "normal_premium"
    if mnav < 3.0:
        return "elevated_premium"
    return "overheated"


def classify_mnav_risk_flag(band: str) -> str:
    if band == "discount":
        return "stress"
    if band == "overheated":
        return "crowded"
    if band == "elevated_premium":
        return "elevated"
    if band == "unknown":
        return "unknown"
    return "normal"


def _extract_bitcoin_results(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Strategy bitcoin KPI payload must be an object.")
    results = payload.get("results")
    if not isinstance(results, dict):
        raise ValueError("Strategy bitcoin KPI payload missing results object.")
    return results


def _extract_mstr_row(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("value")
    else:
        raise ValueError("Strategy MSTR KPI payload must be an object or array.")
    if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict):
        raise ValueError("Strategy MSTR KPI payload missing value row.")
    return rows[0]


def build_strategy_mnav_snapshot(
    bitcoin_payload: Any,
    mstr_payload: Any,
    generated_at: datetime | None = None,
) -> Dict[str, Any]:
    """Build a normalized latest mNAV snapshot from Strategy official API payloads."""
    generated_at = generated_at or datetime.now(timezone.utc)
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=timezone.utc)
    generated_at_iso = generated_at.astimezone(timezone.utc).isoformat()

    bitcoin_wrapper = bitcoin_payload if isinstance(bitcoin_payload, dict) else {}
    btc = _extract_bitcoin_results(bitcoin_payload)
    mstr = _extract_mstr_row(mstr_payload)

    enterprise_value_usd_m = _parse_number(mstr.get("entVal"))
    previous_enterprise_value_usd_m = _parse_number(mstr.get("prevEntVal"))
    market_cap_usd_m = _parse_number(mstr.get("marketCap"))
    btc_reserve_usd_m = _parse_number(btc.get("btcNavNumber") or btc.get("btcNav"))
    previous_btc_reserve_usd_m = _parse_number(btc.get("prevBtcNav"))

    if enterprise_value_usd_m is None or enterprise_value_usd_m <= 0:
        raise ValueError("Strategy MSTR enterprise value is missing or invalid.")
    if btc_reserve_usd_m is None or btc_reserve_usd_m <= 0:
        raise ValueError("Strategy BTC reserve value is missing or invalid.")

    mnav_value = enterprise_value_usd_m / btc_reserve_usd_m
    previous_value = (
        previous_enterprise_value_usd_m / previous_btc_reserve_usd_m
        if previous_enterprise_value_usd_m
        and previous_enterprise_value_usd_m > 0
        and previous_btc_reserve_usd_m
        and previous_btc_reserve_usd_m > 0
        else None
    )
    change = mnav_value - previous_value if previous_value is not None else None
    equity_premium = (
        market_cap_usd_m / btc_reserve_usd_m
        if market_cap_usd_m is not None and market_cap_usd_m > 0
        else None
    )
    band = classify_mnav_band(mnav_value)

    btc_timestamp = _as_iso_timestamp(bitcoin_wrapper.get("timestamp"))
    mstr_timestamp = _as_iso_timestamp(mstr.get("timeStampUtc"))

    return {
        "date": generated_at.astimezone(timezone.utc).strftime("%Y-%m-%d"),
        "generatedAt": generated_at_iso,
        "source": STRATEGY_SOURCE_NAME,
        "sourceUrls": {
            "bitcoinKpis": STRATEGY_BITCOIN_KPIS_URL,
            "mstrKpiData": STRATEGY_MSTR_KPI_URL,
        },
        "formula": STRATEGY_MNAV_FORMULA,
        "mstr": {
            "price": _parse_number(mstr.get("price") or mstr.get("ufPrice")),
            "marketCapUsdM": market_cap_usd_m,
            "enterpriseValueUsdM": enterprise_value_usd_m,
            "previousEnterpriseValueUsdM": previous_enterprise_value_usd_m,
            "debtUsdM": _parse_number(mstr.get("debt")),
            "preferredEquityUsdM": _parse_number(mstr.get("pref")),
            "debtPreferredByMarketCapPct": _parse_number(mstr.get("debtPrefByMC")),
            "sharesVolume": _parse_int(mstr.get("sharesVolume")),
            "timestampUtc": mstr_timestamp,
        },
        "btcReserve": {
            "btcHoldings": _parse_number(btc.get("btcHoldings")),
            "btcPriceUsd": _parse_number(btc.get("latestPrice") or btc.get("ufPrice")),
            "btcReserveUsdM": btc_reserve_usd_m,
            "previousBtcReserveUsdM": previous_btc_reserve_usd_m,
            "satsPerShare": _parse_number(btc.get("satsPerShare")),
            "timestamp": btc_timestamp,
            "msTimestamp": _parse_int(btc.get("msTimestamp")),
        },
        "mnav": {
            "value": _round(mnav_value, 4),
            "previousValue": _round(previous_value, 4),
            "change": _round(change, 4),
            "band": band,
            "riskFlag": classify_mnav_risk_flag(band),
            "equityPremium": _round(equity_premium, 4),
        },
        "dataHealth": {
            "isStale": False,
            "mstrTimestampUtc": mstr_timestamp,
            "btcTimestamp": btc_timestamp,
        },
    }


def fetch_strategy_mnav_snapshot() -> Dict[str, Any]:
    bitcoin_payload = fetch_json_payload(STRATEGY_BITCOIN_KPIS_URL)
    mstr_payload = fetch_json_payload(STRATEGY_MSTR_KPI_URL)
    return build_strategy_mnav_snapshot(bitcoin_payload, mstr_payload)


def snapshot_to_history_row(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    mstr = snapshot.get("mstr") if isinstance(snapshot.get("mstr"), dict) else {}
    reserve = (
        snapshot.get("btcReserve")
        if isinstance(snapshot.get("btcReserve"), dict)
        else {}
    )
    mnav = snapshot.get("mnav") if isinstance(snapshot.get("mnav"), dict) else {}

    return {
        "d": snapshot.get("date"),
        "generatedAt": snapshot.get("generatedAt"),
        "mnav": mnav.get("value"),
        "mnavBand": mnav.get("band"),
        "riskFlag": mnav.get("riskFlag"),
        "enterpriseValueUsdM": mstr.get("enterpriseValueUsdM"),
        "btcReserveUsdM": reserve.get("btcReserveUsdM"),
        "marketCapUsdM": mstr.get("marketCapUsdM"),
        "equityPremium": mnav.get("equityPremium"),
        "mstrPrice": mstr.get("price"),
        "btcPrice": reserve.get("btcPriceUsd"),
        "btcHoldings": reserve.get("btcHoldings"),
        "satsPerShare": reserve.get("satsPerShare"),
        "mstrTimestampUtc": mstr.get("timestampUtc"),
        "btcTimestamp": reserve.get("timestamp"),
        "source": snapshot.get("source"),
    }


def merge_strategy_mnav_history(
    existing_history: Any,
    latest_snapshot: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if isinstance(existing_history, list):
        rows = [row for row in existing_history if isinstance(row, dict)]

    latest_row = snapshot_to_history_row(latest_snapshot)
    latest_date = latest_row.get("d")
    rows = [row for row in rows if row.get("d") != latest_date]
    rows.append(latest_row)
    return sorted(rows, key=lambda row: str(row.get("d") or ""))


def build_strategy_mnav_manifest_health(
    snapshot: Dict[str, Any],
    history_rows: int,
) -> Dict[str, Any]:
    mnav = snapshot.get("mnav") if isinstance(snapshot.get("mnav"), dict) else {}
    data_health = (
        snapshot.get("dataHealth")
        if isinstance(snapshot.get("dataHealth"), dict)
        else {}
    )
    return {
        "source": snapshot.get("source"),
        "formula": snapshot.get("formula"),
        "latestDate": snapshot.get("date"),
        "historyRows": history_rows,
        "mnav": mnav.get("value"),
        "band": mnav.get("band"),
        "riskFlag": mnav.get("riskFlag"),
        "isStale": data_health.get("isStale"),
        "mstrTimestampUtc": data_health.get("mstrTimestampUtc"),
        "btcTimestamp": data_health.get("btcTimestamp"),
    }
