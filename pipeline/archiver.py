"""Archive current JSON outputs and restore from snapshots."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def write_json(path: Path, payload: object) -> None:
    """Write JSON with stable formatting and UTF-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_json_if_exists(path: Path) -> object | None:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def archive_existing_outputs(
    output_paths: Dict[str, Path],
    archive_root: Path,
    release_label: str = "",
    rollback_metadata_file: str = "release_metadata.json",
) -> Path | None:
    existing_paths = {key: path for key, path in output_paths.items() if path.exists()}
    if not existing_paths:
        return None

    archive_root.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = f"_{release_label.strip()}" if release_label.strip() else ""
    snapshot_dir = archive_root / f"snapshot_{timestamp}{suffix}"
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    latest_payload = load_json_if_exists(existing_paths.get("latest", Path()))
    manifest_payload = load_json_if_exists(existing_paths.get("manifest", Path()))
    metadata: Dict[str, Any] = {
        "archivedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotId": snapshot_dir.name,
        "previousLatestDate": (
            latest_payload.get("date")
            if isinstance(latest_payload, dict)
            else None
        ),
        "previousSchemaVersion": (
            manifest_payload.get("schemaVersion")
            if isinstance(manifest_payload, dict)
            else None
        ),
        "previousScoringModelVersion": (
            manifest_payload.get("scoringModelVersion")
            if isinstance(manifest_payload, dict)
            else None
        ),
        "releaseLabel": release_label or None,
        "files": {},
    }

    for key, path in existing_paths.items():
        target = snapshot_dir / path.name
        shutil.copy2(path, target)
        metadata["files"][key] = {
            "source": str(path),
            "snapshot": str(target),
        }

    write_json(snapshot_dir / rollback_metadata_file, metadata)
    return snapshot_dir


def restore_outputs_from_archive(
    snapshot_dir: Path,
    output_paths: Dict[str, Path],
) -> Dict[str, Path]:
    if not snapshot_dir.exists():
        raise FileNotFoundError(f"Snapshot directory does not exist: {snapshot_dir}")

    restored: Dict[str, Path] = {}
    for key, target_path in output_paths.items():
        snapshot_path = snapshot_dir / target_path.name
        if not snapshot_path.exists():
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(snapshot_path, target_path)
        restored[key] = target_path
    return restored
