#!/usr/bin/env python3
"""
Fetch BTC indicator history from BGeometrics chart JSON files.

This is the CLI entry point. Core logic lives in the pipeline/ package:
  - pipeline/config.py   : constants
  - pipeline/fetcher.py  : HTTP, parsing, data-source management
  - pipeline/scoring.py  : V4 layered scoring and enrichment
  - pipeline/archiver.py : archive / rollback

Backward-compatible re-exports are kept so that tests and CI scripts
can continue to import from this module directly.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd

# ---- pipeline imports ----------------------------------------------------
from pipeline.config import (  # noqa: F401 — re-exported for backward compat
    ARCHIVE_ROOT_DEFAULT,
    DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
    INDICATOR_SET,
    LEGACY_SCORING_MODEL_VERSION,
    ROLLBACK_METADATA_FILE,
    SCHEMA_VERSION,
    SCORING_MODEL_VERSION,
    SIGNAL_EVENTS_V4_JSON_PATH_DEFAULT,
)
from pipeline.fetcher import (  # noqa: F401 — re-exported for backward compat
    _safe_float,
    _safe_iso_date,
    _safe_int,
    build_base_dataframe,
    build_reserve_risk_history_dataframe,
    build_reserve_risk_source_diagnostics,
    fetch_reserve_risk_point_sources,
    merge_reserve_risk_history_sources,
    patch_reserve_risk_tail,
)
from pipeline.scoring import (  # noqa: F401 — re-exported for backward compat
    _classify_score_band,
    _score_band_thresholds,
    enrich_for_frontend,
)
from pipeline.archiver import (  # noqa: F401 — re-exported for backward compat
    archive_existing_outputs,
    load_json_if_exists,
    restore_outputs_from_archive,
    write_json,
)


# =========================================================================
# Serializer / output functions
# =========================================================================


def build_tabular_view(frontend_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare human-readable table used for CSV/XLSX exports."""
    return frontend_df.rename(
        columns={
            "date": "Date",
            "price_200w_ma_ratio": "BTC_Price_200W_MA_Ratio",
            "price_realized_ratio": "BTC_Price_Realized_Price_Ratio",
            "reserve_risk": "Reserve_Risk",
            "lth_mvrv": "LTH_MVRV",
            "sth_sopr": "STH_SOPR",
            "sth_mvrv": "STH_MVRV",
            "puell_multiple": "Puell_Multiple",
            "signal_score_v2": "Signal_Score_V2",
            "valuation_score": "Valuation_Score_V4",
            "trigger_score": "Trigger_Score_V4",
            "confirmation_score": "Confirmation_Score_V4",
            "total_score_v4": "Total_Score_V4",
            "signal_count": "Signal_Count",
            "signal_count_v4": "Signal_Count_V4",
        }
    )[
        [
            "Date",
            "BTC_Price_200W_MA_Ratio",
            "BTC_Price_Realized_Price_Ratio",
            "Reserve_Risk",
            "LTH_MVRV",
            "STH_SOPR",
            "STH_MVRV",
            "Puell_Multiple",
            "Signal_Score_V2",
            "Valuation_Score_V4",
            "Trigger_Score_V4",
            "Confirmation_Score_V4",
            "Total_Score_V4",
            "Signal_Count",
            "Signal_Count_V4",
        ]
    ].reset_index(drop=True)


def dataframe_to_history_json(frontend_df: pd.DataFrame) -> List[Dict[str, object]]:
    """Convert enriched DataFrame to frontend history JSON format."""
    records: List[Dict[str, object]] = []

    for row in frontend_df.itertuples(index=False):
        date_value = _safe_iso_date(getattr(row, "date"))
        if not date_value:
            continue

        ts = datetime.strptime(date_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        unix_ts = int(ts.timestamp())

        records.append(
            {
                "d": date_value,
                "unixTs": unix_ts,
                "btcPrice": _safe_float(getattr(row, "btc_price")),
                "ma200w": _safe_float(getattr(row, "ma200w")),
                "realizedPrice": _safe_float(getattr(row, "realized_price")),
                "priceMa200wRatio": _safe_float(getattr(row, "price_200w_ma_ratio")),
                "priceRealizedRatio": _safe_float(getattr(row, "price_realized_ratio")),
                "reserveRisk": _safe_float(getattr(row, "reserve_risk")),
                "lthMvrv": _safe_float(getattr(row, "lth_mvrv")),
                "lthSopr": _safe_float(getattr(row, "lth_sopr")),
                "mvrvZscore": _safe_float(getattr(row, "mvrv_zscore")),
                "sthSopr": _safe_float(getattr(row, "sth_sopr")),
                "sthMvrv": _safe_float(getattr(row, "sth_mvrv")),
                "puellMultiple": _safe_float(getattr(row, "puell_multiple")),
                "signalPriceMa200w": bool(getattr(row, "signal_price_ma200w")),
                "signalPriceRealized": bool(getattr(row, "signal_price_realized")),
                "signalReserveRisk": bool(getattr(row, "signal_reserve_risk")),
                "signalSthSopr": bool(getattr(row, "signal_sth_sopr")),
                "signalSthMvrv": bool(getattr(row, "signal_sth_mvrv")),
                "signalSthGroup": bool(getattr(row, "signal_sth_group")),
                "signalReserveRiskV4": bool(getattr(row, "signal_reserve_risk_v4")),
                "signalMvrvZscoreCore": bool(
                    getattr(row, "signal_mvrv_zscore_core")
                ),
                "signalLthMvrv": bool(getattr(row, "signal_lth_mvrv")),
                "signalLthSopr": bool(getattr(row, "signal_lth_sopr")),
                "signalSthSoprTrigger": bool(getattr(row, "signal_sth_sopr_trigger")),
                "signalSthSoprAux": bool(getattr(row, "signal_sth_sopr_aux")),
                "signalPuell": bool(getattr(row, "signal_puell")),
                "signalCount": int(getattr(row, "signal_count")),
                "activeIndicatorCount": int(getattr(row, "active_indicator_count")),
                "signalCountV4": int(getattr(row, "signal_count_v4")),
                "activeIndicatorCountV4": int(
                    getattr(row, "active_indicator_count_v4")
                ),
                "scorePriceMa200w": int(getattr(row, "score_price_ma200w")),
                "scorePriceRealized": int(getattr(row, "score_price_realized")),
                "scoreReserveRisk": int(getattr(row, "score_reserve_risk")),
                "scoreReserveRiskV4": int(getattr(row, "score_reserve_risk_v4")),
                "scoreReserveRiskPrimary": int(
                    getattr(row, "score_reserve_risk_primary")
                ),
                "scoreReserveRiskReplacement": int(
                    getattr(row, "score_reserve_risk_replacement")
                ),
                "scoreLthMvrv": int(getattr(row, "score_lth_mvrv")),
                "scoreLthSopr": int(getattr(row, "score_lth_sopr")),
                "scoreMvrvZscore": int(getattr(row, "score_mvrv_zscore")),
                "scoreMvrvZscoreCore": int(getattr(row, "score_mvrv_zscore_core")),
                "scoreSthSopr": int(getattr(row, "score_sth_sopr")),
                "scoreSthMvrv": int(getattr(row, "score_sth_mvrv")),
                "scoreSthGroup": int(getattr(row, "score_sth_group")),
                "scorePuell": int(getattr(row, "score_puell")),
                "signalScoreV2": int(getattr(row, "signal_score_v2")),
                "maxSignalScoreV2": int(getattr(row, "max_signal_score_v2")),
                "signalScoreV2Min3d": _safe_float(
                    getattr(row, "signal_score_v2_min3d")
                ),
                "signalConfirmed3d": bool(getattr(row, "signal_confirmed_3d")),
                "signalBandV2": str(getattr(row, "signal_band_v2")),
                "valuationScore": int(getattr(row, "valuation_score")),
                "maxValuationScore": int(getattr(row, "max_valuation_score")),
                "triggerScore": int(getattr(row, "trigger_score")),
                "maxTriggerScore": int(getattr(row, "max_trigger_score")),
                "confirmationScore": int(getattr(row, "confirmation_score")),
                "maxConfirmationScore": int(
                    getattr(row, "max_confirmation_score")
                ),
                "auxiliaryScore": int(getattr(row, "auxiliary_score")),
                "maxAuxiliaryScore": int(getattr(row, "max_auxiliary_score")),
                "totalScoreV4": int(getattr(row, "total_score_v4")),
                "maxTotalScoreV4": int(getattr(row, "max_total_score_v4")),
                "totalScoreV4Min3d": _safe_float(
                    getattr(row, "total_score_v4_min3d")
                ),
                "signalConfirmed3dV4": bool(
                    getattr(row, "signal_confirmed_3d_v4")
                ),
                "signalBandV4": str(getattr(row, "signal_band_v4")),
                "reserveRiskActive": bool(
                    getattr(row, "reserve_risk_active")
                ),
                "signalConfidence": _safe_float(getattr(row, "signal_confidence")),
                "dataFreshnessScore": _safe_float(
                    getattr(row, "data_freshness_score")
                ),
                "thresholds": {
                    "reserveRisk": {
                        "trigger": _safe_float(getattr(row, "reserve_risk_trigger")),
                        "deep": _safe_float(getattr(row, "reserve_risk_deep")),
                    },
                    "sthSopr": {
                        "trigger": _safe_float(getattr(row, "sth_sopr_trigger")),
                        "deep": _safe_float(getattr(row, "sth_sopr_deep")),
                    },
                    "sthMvrv": {
                        "trigger": _safe_float(getattr(row, "sth_mvrv_trigger")),
                        "deep": _safe_float(getattr(row, "sth_mvrv_deep")),
                    },
                },
                "staleIndicators": getattr(row, "stale_indicators", []),
                "reserveRiskActive": bool(
                    getattr(row, "reserve_risk_active")
                ),
                "reserveRiskReplacementActive": bool(
                    getattr(row, "reserve_risk_replacement_active")
                ),
                "reserveRiskReplacementSource": getattr(
                    row, "reserve_risk_replacement_source", None
                ),
                "reserveRiskSourceMode": str(
                    getattr(row, "reserve_risk_source_mode") or ""
                ),
                "reserveRiskLagDays": _safe_int(
                    getattr(row, "reserve_risk_lag_days")
                ),
                "reserveRiskPrimaryLagDays": _safe_int(
                    getattr(row, "reserve_risk_primary_lag_days")
                ),
                "reserveRiskReplacementLagDays": _safe_int(
                    getattr(row, "reserve_risk_replacement_lag_days")
                ),
                "reserveRiskSourceModeV4": str(
                    getattr(row, "reserve_risk_source_mode_v4") or ""
                ),
                "reserveRiskSoftFallbackActive": bool(
                    getattr(row, "reserve_risk_soft_fallback_active")
                ),
                "reserveRiskFallbackLagDaysV4": _safe_int(
                    getattr(row, "reserve_risk_fallback_lag_days_v4")
                ),
                "fallbackMode": str(getattr(row, "fallback_mode")),
                "staleIndicators": list(
                    getattr(row, "stale_indicators", [])
                ),
                "coreIndicatorSet": INDICATOR_SET,
                "scoringModelVersion": SCORING_MODEL_VERSION,
                "legacyScoringModelVersion": LEGACY_SCORING_MODEL_VERSION,
                "api_data_date": {
                    "price_ma200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "price_realized": _safe_iso_date(
                        getattr(row, "realized_price_date")
                    ),
                    "reserve_risk": _safe_iso_date(
                        getattr(row, "reserve_risk_date")
                    ),
                    "lth_mvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "lth_sopr": _safe_iso_date(getattr(row, "lth_sopr_date")),
                    "mvrv_zscore": _safe_iso_date(
                        getattr(row, "mvrv_zscore_date")
                    ),
                    "sth_sopr": _safe_iso_date(getattr(row, "sth_sopr_date")),
                    "sth_mvrv": _safe_iso_date(getattr(row, "sth_mvrv_date")),
                    "puell": _safe_iso_date(
                        getattr(row, "puell_multiple_date")
                    ),
                },
                "indicatorDates": {
                    "priceMa200w": _safe_iso_date(getattr(row, "btc_price_date")),
                    "priceRealized": _safe_iso_date(
                        getattr(row, "realized_price_date")
                    ),
                    "reserveRisk": _safe_iso_date(
                        getattr(row, "reserve_risk_date")
                    ),
                    "lthMvrv": _safe_iso_date(getattr(row, "lth_mvrv_date")),
                    "lthSopr": _safe_iso_date(getattr(row, "lth_sopr_date")),
                    "mvrvZscore": _safe_iso_date(
                        getattr(row, "mvrv_zscore_date")
                    ),
                    "sthSopr": _safe_iso_date(getattr(row, "sth_sopr_date")),
                    "sthMvrv": _safe_iso_date(getattr(row, "sth_mvrv_date")),
                    "puell": _safe_iso_date(
                        getattr(row, "puell_multiple_date")
                    ),
                },
            }
        )

    return records


def build_latest_json(
    frontend_df: pd.DataFrame,
    thresholds: Dict[str, Dict[str, object]],
    reserve_risk_diagnostics: Dict[str, object] | None = None,
) -> Dict[str, object]:
    """Build the latest-point-in-time JSON payload from the last row."""
    if frontend_df.empty:
        return {
            "date": "",
            "btcPrice": None,
            "priceMa200wRatio": None,
            "priceRealizedRatio": None,
            "reserveRisk": None,
            "sthSopr": None,
            "sthMvrv": None,
            "puellMultiple": None,
            "signalCount": 0,
        }

    last = frontend_df.iloc[-1]
    reserve_risk_source_mode = str(last.get("reserve_risk_source_mode") or "")
    reserve_risk_replacement_active = bool(
        last.get("reserve_risk_replacement_active") or False
    )
    reserve_risk_replacement_source = (
        str(last.get("reserve_risk_replacement_source"))
        if reserve_risk_replacement_active
        else None
    )
    reserve_risk_replacement_lag_days = _safe_float(
        last.get("reserve_risk_replacement_lag_days")
    )

    reserve_risk_source_mode_v4 = str(last.get("reserve_risk_source_mode_v4") or "")
    reserve_risk_soft_fallback_active = bool(
        last.get("reserve_risk_soft_fallback_active") or False
    )
    reserve_risk_fallback_lag_days_v4 = _safe_float(
        last.get("reserve_risk_fallback_lag_days_v4")
    )

    stale_indicators: list = last.get("stale_indicators", [])
    if not isinstance(stale_indicators, list):
        stale_indicators = []

    inactive_indicators: List[Dict[str, object]] = []
    if not bool(last.get("reserve_dimension_active")):
        inactive_indicators.append(
            {
                "key": "reserveRisk",
                "reason": "stale_source_lag",
                "lagDays": _safe_float(last.get("reserve_risk_lag_days")),
                "maxLagDays": _safe_float(
                    last.get("reserve_risk_disable_lag_days")
                ),
                "sourceDate": _safe_iso_date(last.get("reserve_risk_date")),
            }
        )

    for indicator_key, stale_flag_field in [
        ("mvrvZscore", "mvrvZscore"),
    ]:
        if any(stale_flag_field in str(s) for s in stale_indicators):
            inactive_indicators.append(
                {
                    "key": indicator_key,
                    "reason": "stale_mvrv_zscore",
                }
            )

    indicator_lag_days: Dict[str, object] = {}
    for col_key, label in [
        ("btc_price", "btcPrice"),
        ("ma200w", "ma200w"),
        ("realized_price", "realizedPrice"),
        ("reserve_risk", "reserveRisk"),
        ("lth_mvrv", "lthMvrv"),
        ("lth_sopr", "lthSopr"),
        ("mvrv_zscore", "mvrvZscore"),
        ("sth_sopr", "sthSopr"),
        ("sth_mvrv", "sthMvrv"),
        ("puell_multiple", "puell"),
    ]:
        lag_val = _safe_float(getattr(last, f"{col_key}_lag_days", None))
        if lag_val is not None:
            indicator_lag_days[label] = lag_val

    indicator_dates: Dict[str, object] = {}
    for col_key, label in [
        ("btc_price", "btcPrice"),
        ("ma200w", "priceMa200w"),
        ("realized_price", "priceRealized"),
        ("reserve_risk", "reserveRisk"),
        ("lth_mvrv", "lthMvrv"),
        ("lth_sopr", "lthSopr"),
        ("mvrv_zscore", "mvrvZscore"),
        ("sth_sopr", "sthSopr"),
        ("sth_mvrv", "sthMvrv"),
        ("puell_multiple", "puell"),
    ]:
        date_val = _safe_iso_date(getattr(last, f"{col_key}_date", None))
        if date_val:
            indicator_dates[label] = date_val

    latest_date_value = _safe_iso_date(last.get("date")) or ""
    if latest_date_value:
        ts = datetime.strptime(latest_date_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        unix_ts = int(ts.timestamp())
    else:
        unix_ts = None

    latest_payload: Dict[str, object] = {
        "date": latest_date_value,
        "unixTs": unix_ts,
        "btcPrice": _safe_float(last.get("btc_price")),
        "ma200w": _safe_float(last.get("ma200w")),
        "realizedPrice": _safe_float(last.get("realized_price")),
        "priceMa200wRatio": _safe_float(last.get("price_200w_ma_ratio")),
        "priceRealizedRatio": _safe_float(last.get("price_realized_ratio")),
        "reserveRisk": _safe_float(last.get("reserve_risk")),
        "mvrvZscore": _safe_float(last.get("mvrv_zscore")),
        "lthMvrv": _safe_float(last.get("lth_mvrv")),
        "sthSopr": _safe_float(last.get("sth_sopr")),
        "lthSopr": _safe_float(last.get("lth_sopr")),
        "sthMvrv": _safe_float(last.get("sth_mvrv")),
        "puellMultiple": _safe_float(last.get("puell_multiple")),
        "signalCount": int(last.get("signal_count") or 0),
        "activeIndicatorCount": int(last.get("active_indicator_count") or 0),
        "signalCountV4": int(last.get("signal_count_v4") or 0),
        "activeIndicatorCountV4": int(
            last.get("active_indicator_count_v4") or 0
        ),
        "maxSignalScoreV2": int(last.get("max_signal_score_v2") or 0),
        "valuationScore": int(last.get("valuation_score") or 0),
        "maxValuationScore": int(last.get("max_valuation_score") or 0),
        "triggerScore": int(last.get("trigger_score") or 0),
        "maxTriggerScore": int(last.get("max_trigger_score") or 0),
        "confirmationScore": int(last.get("confirmation_score") or 0),
        "maxConfirmationScore": int(last.get("max_confirmation_score") or 0),
        "auxiliaryScore": int(last.get("auxiliary_score") or 0),
        "maxAuxiliaryScore": int(last.get("max_auxiliary_score") or 0),
        "totalScoreV4": int(last.get("total_score_v4") or 0),
        "maxTotalScoreV4": int(last.get("max_total_score_v4") or 0),
        "totalScoreV4Min3d": _safe_float(last.get("total_score_v4_min3d")),
        "signalConfirmed3dV4": bool(
            last.get("signal_confirmed_3d_v4") or False
        ),
        "signalBandV4": str(last.get("signal_band_v4") or ""),
        "signalConfidence": _safe_float(last.get("signal_confidence")),
        "dataFreshnessScore": _safe_float(
            last.get("data_freshness_score")
        ),
        "signalScoreV2": int(last.get("signal_score_v2") or 0),
        "signalScoreV2Min3d": _safe_float(
            last.get("signal_score_v2_min3d")
        ),
        "signalConfirmed3d": bool(
            last.get("signal_confirmed_3d") or False
        ),
        "signalBandV2": str(last.get("signal_band_v2") or ""),
        "scorePriceMa200w": int(last.get("score_price_ma200w") or 0),
        "scorePriceRealized": int(last.get("score_price_realized") or 0),
        "scoreReserveRisk": int(last.get("score_reserve_risk") or 0),
        "scoreReserveRiskPrimary": int(
            last.get("score_reserve_risk_primary") or 0
        ),
        "scoreReserveRiskReplacement": int(
            last.get("score_reserve_risk_replacement") or 0
        ),
        "scoreReserveRiskV4": int(last.get("score_reserve_risk_v4") or 0),
        "scoreMvrvZscore": int(last.get("score_mvrv_zscore") or 0),
        "scoreMvrvZscoreCore": int(
            last.get("score_mvrv_zscore_core") or 0
        ),
        "scoreLthMvrv": int(last.get("score_lth_mvrv") or 0),
        "scoreLthSopr": int(last.get("score_lth_sopr") or 0),
        "scoreSthSopr": int(last.get("score_sth_sopr") or 0),
        "scoreSthMvrv": int(last.get("score_sth_mvrv") or 0),
        "scoreSthGroup": int(last.get("score_sth_group") or 0),
        "scorePuell": int(last.get("score_puell") or 0),
        "signalPriceMa200w": bool(last.get("signal_price_ma200w") or False),
        "signalPriceRealized": bool(
            last.get("signal_price_realized") or False
        ),
        "signalReserveRisk": bool(last.get("signal_reserve_risk") or False),
        "signalReserveRiskV4": bool(
            last.get("signal_reserve_risk_v4") or False
        ),
        "signalMvrvZscoreCore": bool(
            last.get("signal_mvrv_zscore_core") or False
        ),
        "signalSthSopr": bool(last.get("signal_sth_sopr") or False),
        "signalSthMvrv": bool(last.get("signal_sth_mvrv") or False),
        "signalSthGroup": bool(last.get("signal_sth_group") or False),
        "signalLthMvrv": bool(last.get("signal_lth_mvrv") or False),
        "signalLthSopr": bool(last.get("signal_lth_sopr") or False),
        "signalPuell": bool(last.get("signal_puell") or False),
        "signalSthSoprTrigger": bool(
            last.get("signal_sth_sopr_trigger") or False
        ),
        "signalSthSoprAux": bool(
            last.get("signal_sth_sopr_aux") or False
        ),
        "reserveRiskActive": bool(last.get("reserve_risk_active") or False),
        "reserveRiskDimensionsActive": bool(
            last.get("reserve_dimension_active") or False
        ),
        "reserveRiskV4Active": bool(
            last.get("reserve_dimension_active_v4") or False
        ),
        "reserveRiskReplacementActive": reserve_risk_replacement_active,
        "reserveRiskReplacementSource": reserve_risk_replacement_source,
        "reserveRiskReplacementLagDays": reserve_risk_replacement_lag_days,
        "reserveRiskSourceMode": reserve_risk_source_mode,
        "reserveRiskSourceModeV4": reserve_risk_source_mode_v4,
        "reserveRiskSoftFallbackActive": reserve_risk_soft_fallback_active,
        "reserveRiskFallbackLagDaysV4": reserve_risk_fallback_lag_days_v4,
        "reserveRiskLagDays": _safe_float(last.get("reserve_risk_lag_days")),
        "reserveRiskPrimaryLagDays": _safe_float(
            last.get("reserve_risk_primary_lag_days")
        ),
        "inactiveIndicators": inactive_indicators,
        "staleIndicators": stale_indicators,
        "indicatorLagDays": indicator_lag_days,
        "signals": {
            "priceMa200w": bool(last["signal_price_ma200w"]),
            "priceRealized": bool(last["signal_price_realized"]),
            "reserveRisk": bool(last["signal_reserve_risk"]),
            "sthSopr": bool(last["signal_sth_sopr"]),
            "sthMvrv": bool(last["signal_sth_mvrv"]),
            "sthGroup": bool(last["signal_sth_group"]),
            "puell": bool(last["signal_puell"]),
        },
        "signalsV4": {
            "priceMa200w": bool(last["signal_price_ma200w"]),
            "priceRealized": bool(last["signal_price_realized"]),
            "reserveRisk": bool(last["signal_reserve_risk_v4"]),
            "mvrvZscore": bool(last["signal_mvrv_zscore_core"]),
            "sthMvrv": bool(last["signal_sth_mvrv"]),
            "lthMvrv": bool(last["signal_lth_mvrv"]),
            "lthSopr": bool(last["signal_lth_sopr"]),
            "puell": bool(last["signal_puell"]),
            "sthSoprTrigger": bool(last["signal_sth_sopr_trigger"]),
        },
        "indicatorDates": indicator_dates,
        "coreIndicatorSet": INDICATOR_SET,
        "schemaVersion": SCHEMA_VERSION,
        "thresholds": thresholds,
        "reserveRiskDiagnostics": reserve_risk_diagnostics or {},
        "reserveRiskShadowCompare": (
            reserve_risk_diagnostics.get("shadowCompare")
            if isinstance(reserve_risk_diagnostics, dict)
            else None
        ),
        "scoringModelVersion": SCORING_MODEL_VERSION,
        "legacyScoringModelVersion": LEGACY_SCORING_MODEL_VERSION,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }
    return latest_payload


def build_light_history_json(
    history_json: List[Dict[str, object]],
    years: int = 8,
) -> List[Dict[str, object]]:
    """Build lightweight recent history subset for frontend default loading."""
    if not history_json:
        return []

    latest_date_str = str(history_json[-1].get("d", ""))
    latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d")
    cutoff = latest_date - pd.Timedelta(days=365 * years)

    light: List[Dict[str, object]] = []
    for row in history_json:
        date_str = str(row.get("d", ""))
        if not date_str:
            continue
        row_date = datetime.strptime(date_str, "%Y-%m-%d")
        if row_date >= cutoff:
            light.append(row)
    return light


def build_manifest_json(
    latest_json: Dict[str, object],
    history_rows: int,
    light_rows: int,
    thresholds: Dict[str, Dict[str, object]],
    reserve_risk_diagnostics: Dict[str, object] | None = None,
    signal_events_rows: int = 0,
    archived_snapshot_path: str | None = None,
    archive_root: str | None = None,
) -> Dict[str, object]:
    """Build a small manifest for observability/debugging and cache-busting hints."""
    reserve_risk_diagnostics = (
        reserve_risk_diagnostics
        if reserve_risk_diagnostics is not None
        else latest_json.get("reserveRiskDiagnostics", {})
    )
    primary_series = (
        reserve_risk_diagnostics.get("primarySeries", {})
        if isinstance(reserve_risk_diagnostics, dict)
        else {}
    )
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "latestDate": latest_json.get("date"),
        "lastUpdated": latest_json.get("lastUpdated"),
        "historyRows": history_rows,
        "historyLightRows": light_rows,
        "signalEventsV4Rows": signal_events_rows,
        "schemaVersion": SCHEMA_VERSION,
        "indicatorSet": INDICATOR_SET,
        "scoringModelVersion": latest_json.get(
            "scoringModelVersion", SCORING_MODEL_VERSION
        ),
        "legacyScoringModelVersion": latest_json.get(
            "legacyScoringModelVersion", LEGACY_SCORING_MODEL_VERSION
        ),
        "thresholdVersion": "v4_dynamic",
        "dynamicThresholds": {
            k: v
            for k, v in thresholds.items()
            if isinstance(v, dict) and v.get("method") == "rolling_quantile_no_lookahead"
        },
        "reserveRiskHealth": {
            "primaryStatus": (
                primary_series.get("healthStatus")
                if isinstance(primary_series, dict)
                else None
            ),
            "sourceMode": (
                reserve_risk_diagnostics.get("selectedPointSourceKey")
                if isinstance(reserve_risk_diagnostics, dict)
                else None
            ),
        },
        "archivedSnapshot": archived_snapshot_path,
        "archiveRoot": archive_root or ARCHIVE_ROOT_DEFAULT,
    }


def build_signal_events_v4_json(frontend_df: pd.DataFrame) -> List[Dict[str, object]]:
    if frontend_df.empty:
        return []

    events: List[Dict[str, object]] = []
    confirmed = frontend_df["signal_confirmed_3d_v4"].fillna(False).astype(bool)
    starts = frontend_df.index[confirmed & ~confirmed.shift(1, fill_value=False)]
    ends = frontend_df.index[confirmed & ~confirmed.shift(-1, fill_value=False)]

    for s_idx, e_idx in zip(starts, ends):
        start_row = frontend_df.iloc[s_idx]
        window = frontend_df.iloc[s_idx : e_idx + 1]
        entry_price = _safe_float(start_row.get("btc_price")) or 0.0
        event: Dict[str, object] = {
            "startDate": _safe_iso_date(start_row.get("date")),
            "endDate": _safe_iso_date(frontend_df.iloc[e_idx].get("date")),
            "days": int(e_idx - s_idx + 1),
            "entryPrice": entry_price,
            "signalBandV4": str(start_row.get("signal_band_v4")),
            "signalConfidence": _safe_float(start_row.get("signal_confidence")),
            "valuationScore": int(start_row.get("valuation_score")),
            "triggerScore": int(start_row.get("trigger_score")),
            "confirmationScore": int(start_row.get("confirmation_score")),
            "totalScoreV4": int(start_row.get("total_score_v4")),
            "maxTotalScoreV4": int(start_row.get("max_total_score_v4")),
            "fallbackMode": str(start_row.get("fallback_mode")),
            "maxScoreDuringEvent": int(window["total_score_v4"].max()),
            "minPriceDuringEvent": _safe_float(window["btc_price"].min()),
        }

        for horizon in [30, 90, 180, 365]:
            target_idx = min(s_idx + horizon, len(frontend_df) - 1)
            target_price = _safe_float(frontend_df.iloc[target_idx].get("btc_price"))
            if entry_price > 0 and target_price is not None:
                event[f"return{horizon}d"] = round((target_price / entry_price) - 1, 6)
            else:
                event[f"return{horizon}d"] = None

        events.append(event)

    return events


# =========================================================================
# Output helpers
# =========================================================================


def save_tabular_outputs(
    df: pd.DataFrame, output_dir: Path, file_prefix: str
) -> Dict[str, Path]:
    """Save DataFrame to CSV and XLSX."""
    output_dir.mkdir(parents=True, exist_ok=True)
    saved: Dict[str, Path] = {}

    csv_path = output_dir / f"{file_prefix}.csv"
    df.to_csv(csv_path, index=False)
    saved["csv"] = csv_path

    xlsx_path = output_dir / f"{file_prefix}.xlsx"
    try:
        df.to_excel(xlsx_path, index=False, sheet_name="BTC_Indicators")
        saved["xlsx"] = xlsx_path
    except Exception as exc:
        print(f"Excel save skipped: {exc}")

    return saved


def print_summary(
    tabular_df: pd.DataFrame,
    sources: Dict[str, str],
    reserve_risk_diagnostics: Dict[str, object],
    history_path: Path,
    history_light_path: Path,
    latest_path: Path,
    manifest_path: Path,
    history_rows: int,
    light_rows: int,
) -> None:
    """Print concise run summary."""
    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)

    print(f"Rows: {len(tabular_df):,}")
    if not tabular_df.empty:
        print(
            f"Date range: {tabular_df['Date'].min().date()} -> {tabular_df['Date'].max().date()}"
        )
        print("Latest 5 rows:")
        print(tabular_df.tail(5).to_string(index=False))

    print()
    print("Source URLs used:")
    for key in [
        "btc_price",
        "ma200w",
        "realized_price",
        "reserve_risk",
        "lth_mvrv",
        "mvrv_zscore",
        "sth_sopr",
        "sth_mvrv",
        "puell_multiple",
    ]:
        print(f"  - {key}: {sources.get(key, '-')}")

    reserve_primary = reserve_risk_diagnostics.get("primarySeries", {})
    reserve_supporting = reserve_risk_diagnostics.get("supportingSeries", [])
    reserve_shadow = reserve_risk_diagnostics.get("shadowCompare", {})
    if reserve_primary:
        print()
        print("Reserve Risk health:")
        print(
            f"  Primary ({reserve_primary.get('key')}): "
            f"status={reserve_primary.get('healthStatus')}, "
            f"latestNonNull={reserve_primary.get('latestNonNullDate')}, "
            f"trailingNullRows={reserve_primary.get('trailingNullRows')}"
        )
        for sup in reserve_supporting if isinstance(reserve_supporting, list) else []:
            if isinstance(sup, dict):
                print(
                    f"  Supporting ({sup.get('key')}): "
                    f"status={sup.get('healthStatus')}, "
                    f"latestNonNull={sup.get('latestNonNullDate')}"
                )
    if reserve_shadow and isinstance(reserve_shadow, dict):
        print(
            f"  Shadow: candidate={reserve_shadow.get('candidateKey')}, "
            f"status={reserve_shadow.get('status')}, "
            f"sameDayDelta={reserve_shadow.get('sameDayDelta')}"
        )

    print()
    print("Output files:")
    print(f"  Full history : {history_path} ({history_rows} rows)")
    print(f"  Light history: {history_light_path} ({light_rows} rows)")
    print(f"  Latest       : {latest_path}")
    print(f"  Manifest     : {manifest_path}")


# =========================================================================
# CLI entry point
# =========================================================================


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch BTC indicator history with BGeometrics chart-file endpoints."
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Output folder for CSV/XLSX files (default: current directory).",
    )
    parser.add_argument(
        "--file-prefix",
        default="btc_indicators_from_files",
        help="Output file name prefix (default: btc_indicators_from_files).",
    )
    parser.add_argument(
        "--start-date",
        default=None,
        help="Optional start date, format YYYY-MM-DD.",
    )
    parser.add_argument(
        "--end-date",
        default=None,
        help="Optional end date, format YYYY-MM-DD.",
    )
    parser.add_argument(
        "--history-json-path",
        default="app/public/btc_indicators_history.json",
        help="Frontend history JSON output path.",
    )
    parser.add_argument(
        "--latest-json-path",
        default="app/public/btc_indicators_latest.json",
        help="Frontend latest JSON output path.",
    )
    parser.add_argument(
        "--history-light-json-path",
        default="app/public/btc_indicators_history_light.json",
        help="Frontend lightweight history JSON output path.",
    )
    parser.add_argument(
        "--history-light-years",
        type=int,
        default=8,
        help="Number of recent years to keep in lightweight history JSON.",
    )
    parser.add_argument(
        "--manifest-json-path",
        default="app/public/btc_indicators_manifest.json",
        help="Frontend manifest JSON output path.",
    )
    parser.add_argument(
        "--signal-events-v4-json-path",
        default=SIGNAL_EVENTS_V4_JSON_PATH_DEFAULT,
        help="V4 event backtest JSON output path.",
    )
    parser.add_argument(
        "--skip-tabular",
        action="store_true",
        help="Skip CSV/XLSX outputs and only write frontend JSON files.",
    )
    parser.add_argument(
        "--archive-root",
        default=ARCHIVE_ROOT_DEFAULT,
        help="Directory used to archive current JSON outputs before overwrite.",
    )
    parser.add_argument(
        "--release-label",
        default="",
        help="Optional suffix added to archived snapshot directory names.",
    )
    parser.add_argument(
        "--skip-archive",
        action="store_true",
        help="Do not archive current JSON outputs before writing a new release.",
    )
    parser.add_argument(
        "--rollback-from",
        default="",
        help="Restore JSON outputs from a previously archived snapshot directory and exit.",
    )
    parser.add_argument(
        "--reserve-risk-disable-lag-days",
        type=int,
        default=DEFAULT_RESERVE_RISK_DISABLE_LAG_DAYS,
        help=(
            "Auto-exclude Reserve Risk from scoring when its source date lags behind latest date "
            "by more than this many days."
        ),
    )
    args = parser.parse_args()

    history_path = Path(args.history_json_path)
    history_light_path = Path(args.history_light_json_path)
    latest_path = Path(args.latest_json_path)
    manifest_path = Path(args.manifest_json_path)
    signal_events_v4_path = Path(args.signal_events_v4_json_path)
    output_paths = {
        "history": history_path,
        "historyLight": history_light_path,
        "latest": latest_path,
        "manifest": manifest_path,
        "signalEventsV4": signal_events_v4_path,
    }

    rollback_from = args.rollback_from.strip()
    if rollback_from:
        snapshot_dir = Path(rollback_from)
        restored = restore_outputs_from_archive(snapshot_dir, output_paths)
        print(f"Rolled back {len(restored)} file(s) from {snapshot_dir}")
        return 0

    if not args.skip_archive:
        archive_root = Path(args.archive_root)
        archived = archive_existing_outputs(
            output_paths,
            archive_root,
            release_label=args.release_label,
            rollback_metadata_file=ROLLBACK_METADATA_FILE,
        )
        if archived:
            print(f"Archived previous outputs to {archived}")

    base_df, sources, reserve_primary_last_date, reserve_risk_diagnostics = (
        build_base_dataframe(
            start_date=args.start_date,
            end_date=args.end_date,
        )
    )

    frontend_df, thresholds = enrich_for_frontend(
        base_df,
        reserve_risk_disable_lag_days=args.reserve_risk_disable_lag_days,
        reserve_risk_primary_last_date=reserve_primary_last_date,
    )

    if not args.skip_tabular:
        tabular_df = build_tabular_view(frontend_df)
        save_tabular_outputs(tabular_df, Path(args.output_dir), args.file_prefix)
    else:
        tabular_df = build_tabular_view(frontend_df)

    history_json = dataframe_to_history_json(frontend_df)
    latest_json = build_latest_json(
        frontend_df, thresholds, reserve_risk_diagnostics=reserve_risk_diagnostics
    )
    light_history_json = build_light_history_json(
        history_json, years=args.history_light_years
    )
    signal_events_v4_json = build_signal_events_v4_json(frontend_df)
    manifest_json = build_manifest_json(
        latest_json=latest_json,
        history_rows=len(history_json),
        light_rows=len(light_history_json),
        thresholds=thresholds,
        reserve_risk_diagnostics=reserve_risk_diagnostics,
        signal_events_rows=len(signal_events_v4_json),
    )

    write_json(history_path, history_json)
    write_json(history_light_path, light_history_json)
    write_json(latest_path, latest_json)
    write_json(manifest_path, manifest_json)
    write_json(signal_events_v4_path, signal_events_v4_json)

    print_summary(
        tabular_df,
        sources,
        reserve_risk_diagnostics,
        history_path,
        history_light_path,
        latest_path,
        manifest_path,
        len(history_json),
        len(light_history_json),
    )

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
