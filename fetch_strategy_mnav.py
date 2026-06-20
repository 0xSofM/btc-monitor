#!/usr/bin/env python3
"""Fetch Strategy official mNAV data and write frontend JSON snapshots."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict

from pipeline.archiver import load_json_if_exists, write_json
from pipeline.strategy_mnav import (
    build_strategy_mnav_manifest_health,
    fetch_strategy_mnav_snapshot,
    merge_strategy_mnav_history,
)


def update_manifest(
    manifest_path: Path,
    snapshot: Dict[str, Any],
    history_rows: int,
    latest_path: Path,
    history_path: Path,
) -> None:
    manifest = load_json_if_exists(manifest_path)
    if not isinstance(manifest, dict):
        manifest = {}

    auxiliary_files = manifest.get("auxiliaryDataFiles")
    if not isinstance(auxiliary_files, dict):
        auxiliary_files = {}

    auxiliary_files["strategyMnavLatest"] = latest_path.name
    auxiliary_files["strategyMnavHistory"] = history_path.name

    manifest["auxiliaryDataFiles"] = auxiliary_files
    manifest["strategyMnavHealth"] = build_strategy_mnav_manifest_health(
        snapshot,
        history_rows,
    )
    write_json(manifest_path, manifest)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Strategy official mNAV data.")
    parser.add_argument(
        "--latest-json-path",
        default="app/public/strategy_mnav_latest.json",
        help="Strategy mNAV latest JSON output path.",
    )
    parser.add_argument(
        "--history-json-path",
        default="app/public/strategy_mnav_history.json",
        help="Strategy mNAV history JSON output path.",
    )
    parser.add_argument(
        "--manifest-json-path",
        default="app/public/btc_indicators_manifest.json",
        help="BTC monitor manifest path to annotate with Strategy mNAV health.",
    )
    parser.add_argument(
        "--skip-manifest-update",
        action="store_true",
        help="Write Strategy mNAV files without updating btc_indicators_manifest.json.",
    )
    args = parser.parse_args()

    latest_path = Path(args.latest_json_path)
    history_path = Path(args.history_json_path)
    manifest_path = Path(args.manifest_json_path)

    snapshot = fetch_strategy_mnav_snapshot()
    previous_history = load_json_if_exists(history_path)
    history = merge_strategy_mnav_history(previous_history, snapshot)

    write_json(latest_path, snapshot)
    write_json(history_path, history)

    if not args.skip_manifest_update:
        update_manifest(manifest_path, snapshot, len(history), latest_path, history_path)

    mnav = snapshot.get("mnav", {})
    print("Strategy mNAV update complete.")
    print(f"- latest file : {latest_path}")
    print(f"- history file: {history_path} ({len(history)} rows)")
    print(f"- mNAV        : {mnav.get('value')} ({mnav.get('band')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
