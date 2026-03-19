"""
BTC indicator data updater.

Primary source:
- bitcoin-data.com

Fallback strategy when upstream is rate limited or unavailable:
1. Keep on-chain indicators from the last known history row.
2. Refresh BTC spot price from backup price feeds.
3. Recompute Price / 200W-MA from the carried MA baseline.

Rate Limit Handling:
- bitcoin-data.com has strict rate limits (8 requests/hour for free tier)
- We fetch only 1 day of data for each indicator to minimize API calls
- Total: 5 API calls per run (btc-price, mvrv-zscore, lth-mvrv, puell-multiple, nupl)
"""

import json
import os
import time
from datetime import UTC, datetime

import requests

API_BASE = "https://bitcoin-data.com/v1"
COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices/BTC-USD/spot"
COINGECKO_SPOT_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
TIMEOUT = 30
HISTORY_FILE = "btc_indicators_history.json"
LATEST_FILE = "btc_indicators_latest.json"
MA200W_DAYS = 1400


def fetch_json(endpoint, params=None):
    """Fetch a primary upstream endpoint with retry."""
    url = f"{API_BASE}/{endpoint}"
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, timeout=TIMEOUT)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict):
                # Handle single record response (e.g., {"d":"2026-03-17","mvrvZscore":"0.701"})
                if "d" in payload:
                    return [payload]
                for key in ("data", "result", "items"):
                    value = payload.get(key)
                    if isinstance(value, list):
                        return value
            print(f" [attempt {attempt + 1}] {endpoint} unexpected response object shape, fallback to []")
            return []
        except Exception as error:
            print(f" [attempt {attempt + 1}] {endpoint} failed: {error}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    return []


def fetch_backup_btc_price():
    """Fetch BTC/USD spot price from backup providers."""
    today = datetime.now(UTC).strftime("%Y-%m-%d")

    try:
        response = requests.get(COINBASE_SPOT_URL, timeout=TIMEOUT)
        response.raise_for_status()
        payload = response.json()
        amount = payload.get("data", {}).get("amount")
        if amount is not None:
            return {
                "d": today,
                "btcPrice": float(amount),
                "source": "coinbase",
            }
    except Exception as error:
        print(f"  [fallback] coinbase spot failed: {error}")

    try:
        headers = {}
        demo_key = os.getenv("COINGECKO_DEMO_API_KEY")
        if demo_key:
            headers["x-cg-demo-api-key"] = demo_key

        response = requests.get(COINGECKO_SPOT_URL, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        payload = response.json()
        amount = payload.get("bitcoin", {}).get("usd")
        if amount is not None:
            return {
                "d": today,
                "btcPrice": float(amount),
                "source": "coingecko",
            }
    except Exception as error:
        print(f"  [fallback] coingecko spot failed: {error}")

    return None


def load_existing_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    return []


def get_value(record, *keys):
    if not record:
        return None
    for key in keys:
        if key in record:
            return record.get(key)
    return None


def build_date_map(records, value_key):
    result = {}
    for record in records:
        if not isinstance(record, dict):
            continue
        day = record.get("d")
        value = record.get(value_key)
        if day and value is not None:
            try:
                result[day] = float(value)
            except (ValueError, TypeError):
                continue
    return result


def build_price_series(existing_history, latest_price_map):
    price_by_date = {}

    for record in existing_history:
        day = record.get("d")
        price = get_value(record, "btcPrice", "btc_price")
        if day and price is not None:
            try:
                price_by_date[day] = float(price)
            except (ValueError, TypeError):
                continue

    for day, price in latest_price_map.items():
        price_by_date[day] = price

    return sorted(price_by_date.items(), key=lambda item: item[0])


def compute_ma200w_map(price_series):
    ma200w_map = {}
    prices_only = [price for _, price in price_series]

    for index, (day, _) in enumerate(price_series):
        if index < MA200W_DAYS - 1:
            continue
        window = prices_only[index - MA200W_DAYS + 1:index + 1]
        ma200w_map[day] = sum(window) / len(window)

    return ma200w_map


def get_last_known_indicator_values(history, exclude_date=None):
    fallback = {
        "mvrv_zscore": None,
        "lth_mvrv": None,
        "puell_multiple": None,
        "nupl": None,
    }

    for record in reversed(history):
        if exclude_date and record.get("d") == exclude_date:
            continue
        return {
            "mvrv_zscore": get_value(record, "mvrv_zscore", "mvrvZscore"),
            "lth_mvrv": get_value(record, "lth_mvrv", "lthMvrv"),
            "puell_multiple": get_value(record, "puell_multiple", "puellMultiple"),
            "nupl": get_value(record, "nupl"),
        }

    return fallback


def get_last_known_ma200w(history, exclude_date=None):
    for record in reversed(history):
        if exclude_date and record.get("d") == exclude_date:
            continue
        ma200w = get_value(record, "ma200w")
        if ma200w is not None:
            try:
                return float(ma200w)
            except (ValueError, TypeError):
                continue

        ratio = get_value(record, "price_ma200w_ratio", "priceMa200wRatio")
        price = get_value(record, "btc_price", "btcPrice")
        if ratio and price:
            try:
                return float(price) / float(ratio)
            except (ValueError, TypeError, ZeroDivisionError):
                continue

    return None


def find_indicator_dates(history):
    latest = history[-1]
    dates = {
        "priceMa200w": latest["d"],
    }
    mapping = {
        "mvrvZ": ("mvrv_zscore", "mvrvZscore"),
        "lthMvrv": ("lth_mvrv", "lthMvrv"),
        "puell": ("puell_multiple", "puellMultiple"),
        "nupl": ("nupl",),
    }

    latest_values = {name: get_value(latest, *keys) for name, keys in mapping.items()}

    for index in range(len(history) - 1, -1, -1):
        record = history[index]
        previous = history[index - 1] if index > 0 else None

        for name, keys in mapping.items():
            if name in dates:
                continue

            latest_value = latest_values.get(name)
            if latest_value is None:
                continue

            current_value = get_value(record, *keys)
            previous_value = get_value(previous, *keys) if previous else None
            if current_value == latest_value and previous_value != current_value:
                dates[name] = record["d"]

        if len(dates) == 5:
            return dates

    for index in range(len(history) - 1, -1, -1):
        record = history[index]
        for name, keys in mapping.items():
            if name not in dates and get_value(record, *keys) is not None:
                dates[name] = record["d"]

    return dates


def build_latest_payload(history):
    latest = history[-1]
    btc_price = get_value(latest, "btcPrice", "btc_price") or 0
    price_ma200w_ratio = get_value(latest, "priceMa200wRatio", "price_ma200w_ratio") or 0
    mvrv_zscore = get_value(latest, "mvrvZscore", "mvrv_zscore") or 0
    lth_mvrv = get_value(latest, "lthMvrv", "lth_mvrv") or 0
    puell_multiple = get_value(latest, "puellMultiple", "puell_multiple") or 0
    nupl = get_value(latest, "nupl") or 0

    signals = {
        "priceMa200w": bool(latest.get("signal_price_ma", price_ma200w_ratio < 1)),
        "mvrvZ": bool(latest.get("signal_mvrv_z", mvrv_zscore < 0)),
        "lthMvrv": bool(latest.get("signal_lth_mvrv", lth_mvrv < 1)),
        "puell": bool(latest.get("signal_puell", puell_multiple < 0.5)),
        "nupl": bool(latest.get("signal_nupl", nupl < 0)),
    }

    return {
        "date": latest["d"],
        "btcPrice": btc_price,
        "priceMa200wRatio": price_ma200w_ratio,
        "ma200w": get_value(latest, "ma200w"),
        "mvrvZscore": mvrv_zscore,
        "lthMvrv": lth_mvrv,
        "puellMultiple": puell_multiple,
        "nupl": nupl,
        "signalCount": latest.get("signal_count", sum(signals.values())),
        "signals": signals,
        "indicatorDates": find_indicator_dates(history),
    }


def fail_job(message):
    print(f"::error::{message}")
    raise RuntimeError(message)


def main():
    print(f"=== BTC Indicator Update: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')} ===")

    existing = load_existing_history()
    
    # Use minimal fetch days to conserve API rate limit
    # bitcoin-data.com has 8 requests/hour limit for free tier
    # We only need the latest data, so fetch just 1 day
    fetch_days = 1 if existing else 5000
    print(f"Fetching last {fetch_days} days of primary data...")

    btc_price_raw = fetch_json(f"btc-price/{fetch_days}")
    mvrv_z_raw = fetch_json(f"mvrv-zscore/{fetch_days}")
    lth_mvrv_raw = fetch_json(f"lth-mvrv/{fetch_days}")
    puell_raw = fetch_json(f"puell-multiple/{fetch_days}")
    nupl_raw = fetch_json(f"nupl/{fetch_days}")

    print(f" btc-price: {len(btc_price_raw)} records")
    print(f" mvrv-zscore: {len(mvrv_z_raw)} records")
    print(f" lth-mvrv: {len(lth_mvrv_raw)} records")
    print(f" puell-multiple: {len(puell_raw)} records")
    print(f" nupl: {len(nupl_raw)} records")

    price_map = build_date_map(btc_price_raw, "btcPrice")

    fallback_price = None
    if not price_map:
        fallback_price = fetch_backup_btc_price()
        if fallback_price:
            price_map[fallback_price["d"]] = fallback_price["btcPrice"]
            print(f"  fallback btc price: {fallback_price['btcPrice']} ({fallback_price['source']})")

    if not price_map:
        fail_job("No BTC price data available from either the primary upstream or backup feeds.")

    if not existing and not any([mvrv_z_raw, lth_mvrv_raw, puell_raw, nupl_raw]):
        fail_job("Initial bootstrap requires at least one on-chain indicator source. No primary data was available and there is no history to carry forward.")

    if not any([mvrv_z_raw, lth_mvrv_raw, puell_raw, nupl_raw]):
        print("  [degraded] all non-price indicators unavailable, carrying forward the last known values")

    mvrv_map = build_date_map(mvrv_z_raw, "mvrvZscore")
    lth_map = build_date_map(lth_mvrv_raw, "lthMvrv")
    puell_map = build_date_map(puell_raw, "puellMultiple")
    nupl_map = build_date_map(nupl_raw, "nupl")

    degraded_mode = not any([mvrv_map, lth_map, puell_map, nupl_map])
    carry_exclude_date = max(price_map.keys()) if degraded_mode else None

    price_series = build_price_series(existing, price_map)
    ma200w_map = compute_ma200w_map(price_series)
    fallback_ma200w = get_last_known_ma200w(existing, exclude_date=carry_exclude_date)

    all_dates = sorted(
        set(price_map.keys())
        | set(mvrv_map.keys())
        | set(lth_map.keys())
        | set(puell_map.keys())
        | set(nupl_map.keys())
    )

    carried = get_last_known_indicator_values(existing, exclude_date=carry_exclude_date)
    new_records = []

    for day in all_dates:
        btc_price = price_map.get(day)
        if btc_price is None:
            continue

        mvrv = mvrv_map.get(day, carried["mvrv_zscore"])
        lth = lth_map.get(day, carried["lth_mvrv"])
        puell = puell_map.get(day, carried["puell_multiple"])
        nupl_value = nupl_map.get(day, carried["nupl"])

        if day in mvrv_map:
            carried["mvrv_zscore"] = mvrv
        if day in lth_map:
            carried["lth_mvrv"] = lth
        if day in puell_map:
            carried["puell_multiple"] = puell
        if day in nupl_map:
            carried["nupl"] = nupl_value

        ma200w = ma200w_map.get(day) or fallback_ma200w
        price_ma200w_ratio = (btc_price / ma200w) if ma200w else None

        signal_price_ma = price_ma200w_ratio is not None and price_ma200w_ratio < 1
        signal_mvrv_z = mvrv is not None and mvrv < 0
        signal_lth_mvrv = lth is not None and lth < 1
        signal_puell = puell is not None and puell < 0.5
        signal_nupl = nupl_value is not None and nupl_value < 0

        signal_count = sum([
            signal_price_ma,
            signal_mvrv_z,
            signal_lth_mvrv,
            signal_puell,
            signal_nupl,
        ])

        new_records.append({
            "d": day,
            "btc_price": round(btc_price, 2),
            "price_ma200w_ratio": round(price_ma200w_ratio, 6) if price_ma200w_ratio is not None else None,
            "ma200w": round(ma200w, 2) if ma200w is not None else None,
            "mvrv_zscore": mvrv,
            "lth_mvrv": lth,
            "puell_multiple": puell,
            "nupl": nupl_value,
            "signal_price_ma": signal_price_ma,
            "signal_mvrv_z": signal_mvrv_z,
            "signal_lth_mvrv": signal_lth_mvrv,
            "signal_puell": signal_puell,
            "signal_nupl": signal_nupl,
            "signal_count": signal_count,
        })

    print(f"  Generated {len(new_records)} new/updated records")

    if existing:
        merged_map = {record["d"]: record for record in existing}
        for record in new_records:
            merged_map[record["d"]] = record
        merged = sorted(merged_map.values(), key=lambda item: item["d"])
    else:
        merged = new_records

    if not merged:
        fail_job("No merged history records were produced.")

    print(f"  Total history: {len(merged)} records")

    with open(HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(merged, file, ensure_ascii=False, separators=(",", ":"))
    print(f"  Written {HISTORY_FILE} ({os.path.getsize(HISTORY_FILE) / 1024:.1f} KB)")

    latest = build_latest_payload(merged)
    with open(LATEST_FILE, "w", encoding="utf-8") as file:
        json.dump(latest, file, ensure_ascii=False, indent=2)
    print(f"  Written {LATEST_FILE}")

    public_dir = os.path.join("app", "public")
    os.makedirs(public_dir, exist_ok=True)

    for filename in [HISTORY_FILE, LATEST_FILE]:
        destination = os.path.join(public_dir, filename)
        with open(filename, "r", encoding="utf-8") as source_file:
            with open(destination, "w", encoding="utf-8") as target_file:
                target_file.write(source_file.read())
        print(f"  Copied to {destination}")

    print("=== Done ===")


if __name__ == "__main__":
    main()
