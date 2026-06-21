import ast
import unittest
from pathlib import Path

from fetch_btc_indicators_history_files import (
    CANONICAL_MODEL,
    COMPATIBILITY_FIELDS,
    DISPLAY_INDICATORS,
)
from pipeline import config
from pipeline.model_contract import (
    CANONICAL_SIGNAL_KEYS,
    INDICATOR_SET,
    LEGACY_SCORING_MODEL_VERSION,
    SCHEMA_VERSION,
    SCORING_MODEL_VERSION,
    load_current_model_contract,
)
from validate_btc_data_quality import (
    EXPECTED_CANONICAL_MODEL,
    EXPECTED_CANONICAL_SIGNAL_KEYS,
    EXPECTED_COMPATIBILITY_FIELDS,
    EXPECTED_DISPLAY_INDICATORS,
)


ROOT = Path(__file__).resolve().parents[1]


class ModelContractTests(unittest.TestCase):
    def test_pipeline_and_validation_share_current_model_contract(self) -> None:
        contract = load_current_model_contract()

        self.assertEqual(CANONICAL_MODEL, contract["canonicalModel"])
        self.assertEqual(DISPLAY_INDICATORS, contract["displayIndicators"])
        self.assertEqual(COMPATIBILITY_FIELDS, contract["compatibilityFields"])
        self.assertEqual(config.SCHEMA_VERSION, SCHEMA_VERSION)
        self.assertEqual(config.SCORING_MODEL_VERSION, SCORING_MODEL_VERSION)
        self.assertEqual(config.LEGACY_SCORING_MODEL_VERSION, LEGACY_SCORING_MODEL_VERSION)
        self.assertEqual(config.INDICATOR_SET, INDICATOR_SET)
        self.assertEqual(EXPECTED_CANONICAL_MODEL, contract["canonicalModel"])
        self.assertEqual(EXPECTED_DISPLAY_INDICATORS, contract["displayIndicators"])
        self.assertEqual(EXPECTED_CANONICAL_SIGNAL_KEYS, CANONICAL_SIGNAL_KEYS)
        self.assertEqual(EXPECTED_COMPATIBILITY_FIELDS, contract["compatibilityFields"])

    def test_python_json_serializers_do_not_define_duplicate_literal_keys(self) -> None:
        source = (ROOT / "fetch_btc_indicators_history_files.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        duplicate_keys = []

        for node in ast.walk(tree):
            if not isinstance(node, ast.Dict):
                continue
            seen = set()
            for key in node.keys:
                if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
                    continue
                if key.value in seen:
                    duplicate_keys.append((key.lineno, key.value))
                seen.add(key.value)

        self.assertEqual(duplicate_keys, [])


if __name__ == "__main__":
    unittest.main()
