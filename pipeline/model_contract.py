"""Shared current-model contract loaded by pipeline and validation code."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List


CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts" / "current_model.json"


@lru_cache(maxsize=1)
def load_current_model_contract() -> Dict[str, Any]:
    with CONTRACT_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict):
        raise ValueError(f"Current model contract must be an object: {CONTRACT_PATH}")
    return payload


def _contract_str(key: str) -> str:
    value = load_current_model_contract().get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Current model contract missing string field: {key}")
    return value


def _contract_str_list(key: str) -> List[str]:
    value = load_current_model_contract().get(key)
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"Current model contract missing string list field: {key}")
    return list(value)


SCHEMA_VERSION = _contract_str("schemaVersion")
CANONICAL_MODEL = _contract_str("canonicalModel")
SCORING_MODEL_VERSION = _contract_str("scoringModelVersion")
LEGACY_SCORING_MODEL_VERSION = _contract_str("legacyScoringModelVersion")
INDICATOR_SET = _contract_str("indicatorSet")
DISPLAY_INDICATORS = _contract_str_list("displayIndicators")
CANONICAL_SIGNAL_KEYS = _contract_str_list("canonicalSignalKeys")
COMPATIBILITY_FIELDS = _contract_str_list("compatibilityFields")
LEGACY_COMPATIBILITY = _contract_str_list("legacyCompatibility")
LATEST_CANONICAL_FIELD = _contract_str("latestCanonicalField")
LATEST_LEGACY_FIELD = _contract_str("latestLegacyField")
