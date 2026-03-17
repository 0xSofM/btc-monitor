"""
BTC 指标数据更新脚本
从 BGeometrics API 拉取链上指标，生成前端所需的 JSON 文件。
由 GitHub Actions 每日定时调用。
"""

import json
import os
import time
from datetime import datetime, timedelta

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
            return resp.json()
        except Exception as e:
            print(f"  [attempt {attempt+1}] {endpoint} failed: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    return []


def build_date_map(records, value_key, out_key):
    """将 API 返回的列表转为 {日期: 值} 字典"""
    m = {}
    for r in records:
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


def main():
    print(f"=== BTC Indicator Update: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} ===")

    # --- 拉取各指标的全量历史（用天数参数获取尽可能多的数据） ---
    # 首次运行拉取全量，后续增量追加
    existing = load_existing_history()
    existing_dates = {r["d"] for r in existing} if existing else set()

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
        latest = merged[-1]
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
