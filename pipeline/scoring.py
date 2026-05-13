"""Scoring and enrichment: V4 layered model, rolling thresholds, signal generation."""

from __future__ import annotations

import math
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from .config import (
    INDICATOR_FRESHNESS_MAX_LAG_DAYS,
    LEGACY_SCORING_INDICATOR_COUNT,
    RESERVE_RISK_DEEP_QUANTILE,
    RESERVE_RISK_TRIGGER_QUANTILE,
    ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
    ROLLING_THRESHOLD_WINDOW_DAYS,
    SCORE_CONFIRM_RATIO,
    STH_DEEP_QUANTILE,
    STH_TRIGGER_QUANTILE,
    THRESHOLD_STATIC,
    GROUPED_SIGNAL_COLUMNS,
    GROUPED_SCORE_COLUMNS,
)
from .fetcher import _safe_float  # noqa: F401 — re-exported for legacy compatibility


def _score_by_lt(value: object, trigger: float, deep: float) -> int:
    parsed = _safe_float(value)
    if parsed is None:
        return 0
    if parsed < deep:
        return 2
    if parsed < trigger:
        return 1
    return 0


def _score_by_lt_series(
    values: pd.Series,
    trigger_series: pd.Series,
    deep_series: pd.Series,
) -> pd.Series:
    numeric_values = pd.to_numeric(values, errors="coerce")
    trigger_values = pd.to_numeric(trigger_series, errors="coerce")
    deep_values = pd.to_numeric(deep_series, errors="coerce")
    deep_values = pd.concat([deep_values, trigger_values], axis=1).min(axis=1)

    scores = pd.Series(0, index=values.index, dtype="int64")
    valid_mask = numeric_values.notna() & trigger_values.notna() & deep_values.notna()
    scores.loc[valid_mask & (numeric_values < trigger_values)] = 1
    scores.loc[valid_mask & (numeric_values < deep_values)] = 2
    return scores


def _build_rolling_lt_thresholds(
    values: pd.Series,
    trigger_quantile: float,
    deep_quantile: float,
    fallback_trigger: float,
    fallback_deep: float,
    window_days: int = ROLLING_THRESHOLD_WINDOW_DAYS,
    min_history_days: int = ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
) -> Tuple[pd.Series, pd.Series]:
    numeric_values = pd.to_numeric(values, errors="coerce")
    history = numeric_values.shift(1).rolling(
        window=max(2, int(window_days)), min_periods=max(2, int(min_history_days))
    )
    trigger_series = history.quantile(trigger_quantile).fillna(fallback_trigger)
    deep_series = history.quantile(deep_quantile).fillna(fallback_deep)
    deep_series = pd.concat([deep_series, trigger_series], axis=1).min(axis=1)
    return trigger_series, deep_series


def _classify_score_band(score: int, max_score: int) -> str:
    if max_score <= 0:
        return "watch"

    normalized_score = (score / max_score) * 12
    if normalized_score < 4:
        return "watch"
    if normalized_score < 7:
        return "focus"
    if normalized_score < 10:
        return "accumulate"
    return "extreme_bottom"


def _freshness_score_series(lag_days: pd.Series, max_lag_days: int) -> pd.Series:
    safe_max_lag = max(1, int(max_lag_days))
    numeric_lag = pd.to_numeric(lag_days, errors="coerce")
    freshness = 1 - (numeric_lag.clip(lower=0) / safe_max_lag)
    freshness = freshness.clip(lower=0, upper=1)
    return freshness.where(numeric_lag.notna(), 0.0)


def _score_band_thresholds(max_score: int) -> Dict[str, int]:
    safe_max = max(1, int(max_score))
    return {
        "focus": max(1, math.ceil((safe_max * 4) / 12)),
        "accumulate": max(1, math.ceil((safe_max * 7) / 12)),
        "extreme_bottom": max(1, math.ceil((safe_max * 10) / 12)),
    }


def enrich_for_frontend(
    base_df: pd.DataFrame,
    reserve_risk_disable_lag_days: int = 30,
    reserve_risk_primary_last_date: pd.Timestamp | None = None,
) -> Tuple[pd.DataFrame, Dict[str, Dict[str, object]]]:
    """Build frontend-ready columns including legacy V2 and layered V4 scores."""
    df = base_df.copy()
    reserve_risk_disable_lag_days = max(0, int(reserve_risk_disable_lag_days))

    metric_cols = [
        "btc_price",
        "ma200w",
        "realized_price",
        "reserve_risk",
        "lth_mvrv",
        "lth_sopr",
        "mvrv_zscore",
        "sth_sopr",
        "sth_mvrv",
        "puell_multiple",
    ]

    for col in metric_cols:
        if col not in df.columns:
            df[col] = pd.NA

    for col in metric_cols:
        date_col = f"{col}_date"
        df[date_col] = df["date"].where(df[col].notna(), pd.NaT).ffill()

    for col in metric_cols:
        df[col] = df[col].ffill()

    if reserve_risk_primary_last_date is None:
        reserve_primary_series = df.loc[df["reserve_risk"].notna(), "date"]
        reserve_risk_primary_last_date = (
            pd.to_datetime(reserve_primary_series.max())
            if not reserve_primary_series.empty
            else None
        )

    for col in metric_cols:
        lag_col = f"{col}_lag_days"
        df[lag_col] = (df["date"] - df[f"{col}_date"]).dt.days
        freshness_limit = INDICATOR_FRESHNESS_MAX_LAG_DAYS[col]
        df[f"{col}_freshness_score"] = _freshness_score_series(
            df[lag_col], freshness_limit
        )
        df[f"{col}_is_fresh"] = (
            pd.to_numeric(df[lag_col], errors="coerce")
            .fillna(freshness_limit + 1)
            .le(freshness_limit)
        )

    reserve_primary_date = (
        pd.to_datetime(reserve_risk_primary_last_date)
        if reserve_risk_primary_last_date is not None
        else pd.NaT
    )
    df["reserve_risk_primary_date"] = reserve_primary_date
    if pd.isna(reserve_primary_date):
        df["reserve_risk_primary_lag_days"] = pd.NA
        reserve_primary_is_fresh = pd.Series(False, index=df.index)
    else:
        df["reserve_risk_primary_lag_days"] = (
            df["date"] - reserve_primary_date
        ).dt.days
        reserve_primary_is_fresh = df["reserve_risk_primary_lag_days"].le(
            reserve_risk_disable_lag_days
        )

    df["reserve_risk_active"] = (
        df["reserve_risk_date"].notna()
        & reserve_primary_is_fresh
        & df["reserve_risk_lag_days"]
        .fillna(reserve_risk_disable_lag_days + 1)
        .le(reserve_risk_disable_lag_days)
    )
    df["reserve_risk_disable_lag_days"] = reserve_risk_disable_lag_days

    df["price_200w_ma_ratio"] = df["btc_price"] / df["ma200w"].replace(0, pd.NA)
    df["price_realized_ratio"] = df["btc_price"] / df["realized_price"].replace(
        0, pd.NA
    )

    reserve_trigger_series, reserve_deep_series = _build_rolling_lt_thresholds(
        values=df["reserve_risk"],
        trigger_quantile=RESERVE_RISK_TRIGGER_QUANTILE,
        deep_quantile=RESERVE_RISK_DEEP_QUANTILE,
        fallback_trigger=0.0016,
        fallback_deep=0.0012,
    )
    sth_sopr_trigger_series, sth_sopr_deep_series = _build_rolling_lt_thresholds(
        values=df["sth_sopr"],
        trigger_quantile=STH_TRIGGER_QUANTILE,
        deep_quantile=STH_DEEP_QUANTILE,
        fallback_trigger=THRESHOLD_STATIC["sth_sopr"]["trigger"],
        fallback_deep=THRESHOLD_STATIC["sth_sopr"]["deep"],
    )
    sth_mvrv_trigger_series, sth_mvrv_deep_series = _build_rolling_lt_thresholds(
        values=df["sth_mvrv"],
        trigger_quantile=STH_TRIGGER_QUANTILE,
        deep_quantile=STH_DEEP_QUANTILE,
        fallback_trigger=THRESHOLD_STATIC["sth_mvrv"]["trigger"],
        fallback_deep=THRESHOLD_STATIC["sth_mvrv"]["deep"],
    )
    df["reserve_risk_trigger"] = reserve_trigger_series
    df["reserve_risk_deep"] = reserve_deep_series
    df["sth_sopr_trigger"] = sth_sopr_trigger_series
    df["sth_sopr_deep"] = sth_sopr_deep_series
    df["sth_mvrv_trigger"] = sth_mvrv_trigger_series
    df["sth_mvrv_deep"] = sth_mvrv_deep_series

    df["score_price_ma200w"] = df["price_200w_ma_ratio"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["price_ma200w_ratio"]["trigger"],
            THRESHOLD_STATIC["price_ma200w_ratio"]["deep"],
        )
    )
    df["score_price_realized"] = df["price_realized_ratio"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["price_realized_ratio"]["trigger"],
            THRESHOLD_STATIC["price_realized_ratio"]["deep"],
        )
    )
    df["score_reserve_risk_primary"] = _score_by_lt_series(
        values=df["reserve_risk"],
        trigger_series=reserve_trigger_series,
        deep_series=reserve_deep_series,
    )
    df["score_sth_sopr"] = _score_by_lt_series(
        values=df["sth_sopr"],
        trigger_series=sth_sopr_trigger_series,
        deep_series=sth_sopr_deep_series,
    )
    df["score_sth_mvrv"] = _score_by_lt_series(
        values=df["sth_mvrv"],
        trigger_series=sth_mvrv_trigger_series,
        deep_series=sth_mvrv_deep_series,
    )
    df["score_sth_group"] = df[["score_sth_sopr", "score_sth_mvrv"]].max(axis=1)
    df["score_puell"] = df["puell_multiple"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["puell_multiple"]["trigger"],
            THRESHOLD_STATIC["puell_multiple"]["deep"],
        )
    )
    df["score_lth_mvrv"] = df["lth_mvrv"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["lth_mvrv"]["trigger"],
            THRESHOLD_STATIC["lth_mvrv"]["deep"],
        )
    )
    df["score_lth_sopr"] = df["lth_sopr"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["lth_sopr"]["trigger"],
            THRESHOLD_STATIC["lth_sopr"]["deep"],
        )
    )
    df["score_mvrv_zscore"] = df["mvrv_zscore"].apply(
        lambda v: _score_by_lt(
            v,
            THRESHOLD_STATIC["mvrv_zscore"]["trigger"],
            THRESHOLD_STATIC["mvrv_zscore"]["deep"],
        )
    )
    df["lth_mvrv_lag_days"] = (df["date"] - df["lth_mvrv_date"]).dt.days
    df["lth_sopr_lag_days"] = (df["date"] - df["lth_sopr_date"]).dt.days
    df["mvrv_zscore_lag_days"] = (df["date"] - df["mvrv_zscore_date"]).dt.days
    df["mvrv_zscore_core_active"] = (
        df["mvrv_zscore_date"].notna() & df["mvrv_zscore_is_fresh"]
    )
    df["score_mvrv_zscore_core"] = np.where(
        df["mvrv_zscore_core_active"], df["score_mvrv_zscore"], 0
    ).astype(int)

    # Legacy V2/V3 Reserve Risk replacement logic kept for rollback compatibility.
    df["score_reserve_risk_replacement"] = df[
        ["score_lth_mvrv", "score_mvrv_zscore"]
    ].max(axis=1)
    replacement_lag_legacy = df[["lth_mvrv_lag_days", "mvrv_zscore_lag_days"]].min(
        axis=1, skipna=True
    )
    replacement_available_mask = (
        df[["lth_mvrv_date", "mvrv_zscore_date"]].notna().any(axis=1)
    )
    df["reserve_risk_replacement_lag_days"] = replacement_lag_legacy.where(
        replacement_available_mask, pd.NA
    )
    df["reserve_risk_replacement_active"] = ~df["reserve_risk_active"] & df[
        "reserve_risk_replacement_lag_days"
    ].fillna(reserve_risk_disable_lag_days + 1).le(reserve_risk_disable_lag_days)
    reserve_replacement_source = pd.Series(
        np.where(
            df["score_lth_mvrv"] >= df["score_mvrv_zscore"],
            "lth_mvrv",
            "mvrv_zscore_data",
        ),
        index=df.index,
        dtype="object",
    )
    df["reserve_risk_replacement_source"] = reserve_replacement_source.where(
        df["reserve_risk_replacement_active"],
        None,
    )
    df["reserve_risk_source_mode"] = np.where(
        df["reserve_risk_active"],
        "primary",
        np.where(df["reserve_risk_replacement_active"], "replacement", "inactive"),
    )
    df["reserve_dimension_active"] = df["reserve_risk_source_mode"] != "inactive"
    df["score_reserve_risk"] = df["score_reserve_risk_primary"]
    legacy_replacement_mask = (
        ~df["reserve_risk_active"] & df["reserve_risk_replacement_active"]
    )
    df.loc[legacy_replacement_mask, "score_reserve_risk"] = df.loc[
        legacy_replacement_mask, "score_reserve_risk_replacement"
    ]
    df.loc[~df["reserve_dimension_active"], "score_reserve_risk"] = 0
    df["score_reserve_risk"] = df["score_reserve_risk"].fillna(0).astype(int)

    # V4 layered model: MVRV Z-Score occupies the valuation slot directly.
    df["reserve_risk_soft_fallback_active"] = False
    df["reserve_risk_soft_fallback_source"] = None
    df["score_reserve_risk_v4"] = df["score_mvrv_zscore_core"].astype(int)
    df["max_reserve_risk_score_v4"] = np.where(
        df["mvrv_zscore_core_active"], 2, 0
    ).astype(int)
    df["reserve_risk_source_mode_v4"] = np.where(
        df["mvrv_zscore_core_active"], "compat_mvrv_zscore", "inactive"
    )
    df["reserve_dimension_active_v4"] = df["mvrv_zscore_core_active"]
    df["reserve_risk_fallback_lag_days_v4"] = pd.NA

    thresholds = {
        "priceMa200wRatio": THRESHOLD_STATIC["price_ma200w_ratio"],
        "priceRealizedRatio": THRESHOLD_STATIC["price_realized_ratio"],
        "reserveRisk": {
            "trigger": float(reserve_trigger_series.iloc[-1]),
            "deep": float(reserve_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": RESERVE_RISK_TRIGGER_QUANTILE,
            "deepQuantile": RESERVE_RISK_DEEP_QUANTILE,
        },
        "sthSopr": {
            "trigger": float(sth_sopr_trigger_series.iloc[-1]),
            "deep": float(sth_sopr_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": STH_TRIGGER_QUANTILE,
            "deepQuantile": STH_DEEP_QUANTILE,
        },
        "sthMvrv": {
            "trigger": float(sth_mvrv_trigger_series.iloc[-1]),
            "deep": float(sth_mvrv_deep_series.iloc[-1]),
            "method": "rolling_quantile_no_lookahead",
            "windowDays": ROLLING_THRESHOLD_WINDOW_DAYS,
            "minHistoryDays": ROLLING_THRESHOLD_MIN_HISTORY_DAYS,
            "triggerQuantile": STH_TRIGGER_QUANTILE,
            "deepQuantile": STH_DEEP_QUANTILE,
        },
        "puellMultiple": THRESHOLD_STATIC["puell_multiple"],
        "lthMvrv": THRESHOLD_STATIC["lth_mvrv"],
        "lthSopr": THRESHOLD_STATIC["lth_sopr"],
        "mvrvZscore": THRESHOLD_STATIC["mvrv_zscore"],
        "mvrvZscoreCore": {
            **THRESHOLD_STATIC["mvrv_zscore"],
            "role": "valuation_core_v4",
        },
        "reserveRiskReplacementLegacy": {
            "lthMvrv": THRESHOLD_STATIC["lth_mvrv"],
            "mvrvZscore": THRESHOLD_STATIC["mvrv_zscore"],
        },
        "reserveRiskV4Compatibility": {
            "aliasOf": "mvrvZscoreCore",
            "deprecated": True,
        },
    }

    # Legacy V2/V3 signal fields.
    df["signal_price_ma200w"] = df["score_price_ma200w"] > 0
    df["signal_price_realized"] = df["score_price_realized"] > 0
    df["signal_reserve_risk"] = df["score_reserve_risk"] > 0
    df["signal_sth_sopr"] = df["score_sth_sopr"] > 0
    df["signal_sth_mvrv"] = df["score_sth_mvrv"] > 0
    df["signal_sth_group"] = df["score_sth_group"] > 0
    df["signal_puell"] = df["score_puell"] > 0
    df["inactive_indicator_count"] = (~df["reserve_dimension_active"]).astype(int)
    df["active_indicator_count"] = (
        LEGACY_SCORING_INDICATOR_COUNT - df["inactive_indicator_count"]
    )
    df["max_signal_score_v2"] = df["active_indicator_count"] * 2
    df["signal_count"] = df[GROUPED_SIGNAL_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2"] = df[GROUPED_SCORE_COLUMNS].sum(axis=1).astype(int)
    df["signal_score_v2_min3d"] = (
        df["signal_score_v2"].rolling(window=3, min_periods=3).min()
    )
    min3d_ratio_legacy = (
        df["signal_score_v2_min3d"] / df["max_signal_score_v2"].replace(0, pd.NA)
    ).fillna(0)
    df["signal_confirmed_3d"] = min3d_ratio_legacy >= SCORE_CONFIRM_RATIO
    df["signal_band_v2"] = [
        _classify_score_band(int(score), int(max_score))
        for score, max_score in zip(df["signal_score_v2"], df["max_signal_score_v2"])
    ]

    # V5 layered scores and signals.
    df["signal_mvrv_zscore_core"] = df["score_mvrv_zscore_core"] > 0
    df["signal_reserve_risk_v4"] = df["signal_mvrv_zscore_core"]
    df["signal_lth_mvrv"] = df["score_lth_mvrv"] > 0
    df["signal_lth_sopr"] = df["score_lth_sopr"] > 0
    df["signal_sth_sopr_trigger"] = df["score_sth_sopr"] > 0
    df["valuation_score"] = (
        df["score_price_ma200w"]
        + df["score_price_realized"]
        + df["score_mvrv_zscore_core"]
        + df["score_puell"]
    ).astype(int)
    df["max_valuation_score"] = (
        6 + (df["mvrv_zscore_core_active"].astype(int) * 2)
    ).astype(int)
    # V5 trigger: composite STH signal — either unrealized pain (STH-MVRV) or
    # realized pain (STH-SOPR) activates the trigger layer.
    # STH-SOPR promoted to trigger layer (V5), kept as legacy auxiliary alias.
    df["trigger_score"] = df[["score_sth_mvrv", "score_sth_sopr"]].max(axis=1).astype(int)
    df["max_trigger_score"] = 2
    df["auxiliary_score"] = df["score_sth_sopr"].astype(int)
    df["max_auxiliary_score"] = 2
    # V5 confirmation: dual LTH signal — unrealized (LTH-MVRV) + realized (LTH-SOPR).
    df["confirmation_score"] = (df["score_lth_mvrv"] + df["score_lth_sopr"]).astype(int)
    df["max_confirmation_score"] = 4
    df["active_indicator_count_v4"] = (
        6 + df["mvrv_zscore_core_active"].astype(int)
    ).astype(int)
    df["signal_count_v4"] = (
        df[
            [
                "signal_price_ma200w",
                "signal_price_realized",
                "signal_mvrv_zscore_core",
                "signal_sth_mvrv",
                "signal_lth_mvrv",
                "signal_lth_sopr",
                "signal_puell",
            ]
        ]
        .sum(axis=1)
        .astype(int)
    )
    df["max_total_score_v4"] = (
        df["max_valuation_score"]
        + df["max_trigger_score"]
        + df["max_confirmation_score"]
    ).astype(int)
    df["total_score_v4"] = (
        df["valuation_score"] + df["trigger_score"] + df["confirmation_score"]
    ).astype(int)
    df["total_score_v4_min3d"] = (
        df["total_score_v4"].rolling(window=3, min_periods=3).min()
    )
    min3d_ratio_v4 = (
        df["total_score_v4_min3d"] / df["max_total_score_v4"].replace(0, pd.NA)
    ).fillna(0)
    df["signal_confirmed_3d_v4"] = min3d_ratio_v4 >= SCORE_CONFIRM_RATIO
    df["signal_band_v4"] = [
        _classify_score_band(int(score), int(max_score))
        for score, max_score in zip(df["total_score_v4"], df["max_total_score_v4"])
    ]

    mvrv_core_freshness = df["mvrv_zscore_freshness_score"].where(
        df["mvrv_zscore_core_active"], 0.0
    ).fillna(0.0)
    df["data_freshness_score"] = (
        df[
            [
                "btc_price_freshness_score",
                "realized_price_freshness_score",
                "ma200w_freshness_score",
                "sth_mvrv_freshness_score",
                "lth_mvrv_freshness_score",
                "lth_sopr_freshness_score",
                "puell_multiple_freshness_score",
            ]
        ].sum(axis=1)
        + mvrv_core_freshness
    ) / 8
    base_score_ratio = (
        df["total_score_v4"] / df["max_total_score_v4"].replace(0, pd.NA)
    ).fillna(0)
    trigger_bonus = np.where(df["signal_sth_sopr_trigger"], 0.05, 0.0)
    confirmation_bonus = np.where(df["signal_confirmed_3d_v4"], 0.1, 0.0)
    lth_sopr_bonus = np.where(df["signal_lth_sopr"], 0.05, 0.0)
    fallback_penalty = np.where(~df["mvrv_zscore_core_active"], 0.2, 0.0)
    df["signal_confidence"] = (
        (
            0.5 * base_score_ratio
            + 0.3 * df["data_freshness_score"]
            + trigger_bonus
            + confirmation_bonus
            + lth_sopr_bonus
            - fallback_penalty
        )
        .clip(lower=0, upper=1)
        .round(4)
    )

    stale_flags = pd.DataFrame(
        {
            "priceMa200w": ~df["ma200w_is_fresh"],
            "priceRealized": ~df["realized_price_is_fresh"],
            "reserveRisk": ~df["reserve_risk_is_fresh"],
            "sthSopr": ~df["sth_sopr_is_fresh"],
            "sthMvrv": ~df["sth_mvrv_is_fresh"],
            "lthMvrv": ~df["lth_mvrv_is_fresh"],
            "lthSopr": ~df["lth_sopr_is_fresh"],
            "puell": ~df["puell_multiple_is_fresh"],
            "mvrvZscore": ~df["mvrv_zscore_core_active"],
        }
    )
    df["stale_indicators"] = [
        [key for key, is_stale in flags.items() if bool(is_stale)]
        for flags in stale_flags.to_dict(orient="records")
    ]
    df["fallback_mode"] = np.where(
        ~df["mvrv_zscore_core_active"],
        "mvrv_zscore_inactive",
        "none",
    )

    return df, thresholds
