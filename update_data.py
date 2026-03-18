"""
BTC 指标数据更新脚本
从 BGeometrics API 拉取链上指标，生成前端所需的 JSON 文件。
由 GitHub Actions 每日定时调用。
"""

import json
import os
import time
from datetime import UTC, datetime

import requests

API_BASE = "https://bitcoin-data.com/v1"
TIMEOUT = 30
HISTORY_FILE = "btc_indicators_history.json"
LATEST_FILE = "btc_indicators_latest.json"

# 200周 = 1400天
MA200W_DAYS = 1400


def fetch_json(endpoint, params=None):
    """带重试的 API 请求"""
    url = f"{API_BASE}/{endpoint}"
    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
            payload = resp.json()
            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict):
                for key in ("data", "result", "items"):
                    value = payload.get(key)
                    if isinstance(value, list):
                        return value
                print(f"  [attempt {attempt+1}] {endpoint} unexpected response object shape, fallback to []")
                return []
            print(f"  [attempt {attempt+1}] {endpoint} unexpected response type {type(payload).__name__}, fallback to []")
            return []
        except Exception as e:
            print(f"  [attempt {attempt+1}] {endpoint} failed: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    return []


def build_date_map(records, value_key, out_key):
    """将 API 返回的列表转为 {日期: 值} 字典"""
    m = {}
    for r in records:
        if not isinstance(r, dict):
            continue
        d = r.get("d")
        v = r.get(value_key)
        if d and v is not None:
            try:
                m[d] = float(v)
            except (ValueError, TypeError):
                pass
    return m


def load_existing_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def get_value(record, *keys):
    for key in keys:
        if key in record:
            return record.get(key)
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

    for i in range(len(history) - 1, -1, -1):
        record = history[i]
        prev_record = history[i - 1] if i > 0 else None

        for name, keys in mapping.items():
            if name in dates:
                continue

            latest_value = latest_values.get(name)
            if latest_value is None:
                continue

            current_value = get_value(record, *keys)
            prev_value = get_value(prev_record, *keys) if prev_record else None
            if current_value == latest_value and prev_value != current_value:
                dates[name] = record["d"]

        if len(dates) == 5:
            return dates

    for i in range(len(history) - 1, -1, -1):
        record = history[i]
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

    # --- 拉取各指标的全量历史（用天数参数获取尽可能多的数据） ---
    # 首次运行拉取全量，后续增量追加
    existing = load_existing_history()
    # 决定拉取天数：有历史数据时只拉最近 30 天做增量，否则拉全量
    fetch_days = 30 if existing else 5000

    print(f"Fetching last {fetch_days} days of data...")

    btc_price_raw = fetch_json(f"btc-price/{fetch_days}")
    mvrv_z_raw = fetch_json(f"mvrv-zscore/{fetch_days}")
    lth_mvrv_raw = fetch_json(f"lth-mvrv/{fetch_days}")
    puell_raw = fetch_json(f"puell-multiple/{fetch_days}")
    nupl_raw = fetch_json(f"nupl/{fetch_days}")

    # 200周均线需要至少 1400 天价格数据
    price_for_ma = fetch_json(f"btc-price/{max(fetch_days, MA200W_DAYS)}")

    print(f"  btc-price: {len(btc_price_raw)} records")
    print(f"  mvrv-zscore: {len(mvrv_z_raw)} records")
    print(f"  lth-mvrv: {len(lth_mvrv_raw)} records")
    print(f"  puell-multiple: {len(puell_raw)} records")
    print(f"  nupl: {len(nupl_raw)} records")
    print(f"  btc-price (for MA): {len(price_for_ma)} records")

    if not btc_price_raw:
        fail_job("btc-price endpoint returned no data. Upstream API is likely unavailable or rate limited, so the workflow is stopping to avoid publishing stale snapshots.")

    if not any([mvrv_z_raw, lth_mvrv_raw, puell_raw, nupl_raw]):
        fail_job("All non-price indicator endpoints returned no data. Upstream API is likely unavailable or rate limited, so the workflow is stopping to avoid publishing stale snapshots.")

    # --- 构建日期索引 ---
    price_map = build_date_map(btc_price_raw, "btcPrice", "btc_price")
    mvrv_map = build_date_map(mvrv_z_raw, "mvrvZscore", "mvrv_zscore")
    lth_map = build_date_map(lth_mvrv_raw, "lthMvrv", "lth_mvrv")
    puell_map = build_date_map(puell_raw, "puellMultiple", "puell_multiple")
    nupl_map = build_date_map(nupl_raw, "nupl", "nupl")

    # --- 构建价格列表用于计算滚动 200 周均线 ---
    price_list = []
    for r in sorted(price_for_ma, key=lambda x: x.get("d", "")):
        d = r.get("d")
        p = r.get("btcPrice")
        if d and p:
            try:
                price_list.append((d, float(p)))
            except (ValueError, TypeError):
                pass

    # 计算每个日期的 200 周均线
    ma200w_map = {}
    for i, (d, p) in enumerate(price_list):
        if i >= MA200W_DAYS - 1:
            window = [x[1] for x in price_list[i - MA200W_DAYS + 1: i + 1]]
            ma200w_map[d] = sum(window) / len(window)

    # --- 收集所有日期 ---
    all_dates = sorted(
        set(price_map.keys())
        | set(mvrv_map.keys())
        | set(lth_map.keys())
        | set(puell_map.keys())
        | set(nupl_map.keys())
    )

    # --- 合并生成每日记录 ---
    new_records = []
    # 用于向前填充的上一个有效值
    last = {
        "mvrv_zscore": None,
        "lth_mvrv": None,
        "puell_multiple": None,
        "nupl": None,
    }

    for d in all_dates:
        btc_price = price_map.get(d)
        if btc_price is None:
            continue  # 没有价格的日期跳过

        mvrv = mvrv_map.get(d, last["mvrv_zscore"])
        lth = lth_map.get(d, last["lth_mvrv"])
        puell = puell_map.get(d, last["puell_multiple"])
        nupl_val = nupl_map.get(d, last["nupl"])

        # 更新最后有效值
        if d in mvrv_map:
            last["mvrv_zscore"] = mvrv
        if d in lth_map:
            last["lth_mvrv"] = lth
        if d in puell_map:
            last["puell_multiple"] = puell
        if d in nupl_map:
            last["nupl"] = nupl_val

        ma200w = ma200w_map.get(d)
        price_ma200w_ratio = (btc_price / ma200w) if ma200w else None

        # 计算信号
        signal_price_ma = price_ma200w_ratio is not None and price_ma200w_ratio < 1
        signal_mvrv_z = mvrv is not None and mvrv < 0
        signal_lth_mvrv = lth is not None and lth < 1
        signal_puell = puell is not None and puell < 0.5
        signal_nupl = nupl_val is not None and nupl_val < 0

        signal_count = sum([
            signal_price_ma,
            signal_mvrv_z,
            signal_lth_mvrv,
            signal_puell,
            signal_nupl,
        ])

        record = {
            "d": d,
            "btc_price": btc_price,
            "price_ma200w_ratio": round(price_ma200w_ratio, 6) if price_ma200w_ratio else None,
            "ma200w": round(ma200w, 2) if ma200w else None,
            "mvrv_zscore": round(mvrv, 6) if mvrv is not None else None,
            "lth_mvrv": round(lth, 6) if lth is not None else None,
            "puell_multiple": round(puell, 6) if puell is not None else None,
            "nupl": round(nupl_val, 6) if nupl_val is not None else None,
            "signal_price_ma": signal_price_ma,
            "signal_mvrv_z": signal_mvrv_z,
            "signal_lth_mvrv": signal_lth_mvrv,
            "signal_puell": signal_puell,
            "signal_nupl": signal_nupl,
            "signal_count": signal_count,
        }

        new_records.append(record)

    print(f"  Generated {len(new_records)} new/updated records")

    # --- 合并到已有历史 ---
    if existing:
        existing_map = {r["d"]: r for r in existing}
        for r in new_records:
            existing_map[r["d"]] = r  # 覆盖更新
        merged = sorted(existing_map.values(), key=lambda x: x["d"])
    else:
        merged = new_records

    print(f"  Total history: {len(merged)} records")

    # --- 写入文件 ---
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Written {HISTORY_FILE} ({os.path.getsize(HISTORY_FILE) / 1024:.1f} KB)")

    # 生成 latest 文件
    if merged:
        latest = build_latest_payload(merged)
        with open(LATEST_FILE, "w", encoding="utf-8") as f:
            json.dump(latest, f, ensure_ascii=False, indent=2)
        print(f"  Written {LATEST_FILE}")

    # --- 复制到 app/public 供 Vercel 构建 ---
    public_dir = os.path.join("app", "public")
    os.makedirs(public_dir, exist_ok=True)

    for fname in [HISTORY_FILE, LATEST_FILE]:
        if os.path.exists(fname):
            dest = os.path.join(public_dir, fname)
            with open(fname, "r", encoding="utf-8") as src:
                with open(dest, "w", encoding="utf-8") as dst:
                    dst.write(src.read())
            print(f"  Copied to {dest}")

    print("=== Done ===")


if __name__ == "__main__":
    main()
