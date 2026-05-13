"""BTC data pipeline — modular data fetching, scoring, and archiving."""

from .config import *
from .fetcher import (
    _safe_float,
    _safe_iso_date,
    _safe_int,
    build_base_dataframe,
    build_reserve_risk_history_dataframe,
    build_reserve_risk_source_diagnostics,
    fetch_json,
    fetch_json_payload,
    fetch_metric,
    fetch_reserve_risk_point_sources,
    fetch_reserve_risk_series_sources,
    merge_reserve_risk_history_sources,
    parse_reserve_risk_history_series,
    parse_series,
    patch_reserve_risk_tail,
    select_best_reserve_risk_point_source,
)
from .scoring import (
    enrich_for_frontend,
    _classify_score_band,
    _score_band_thresholds,
)
from .archiver import (
    archive_existing_outputs,
    load_json_if_exists,
    restore_outputs_from_archive,
    write_json,
)
