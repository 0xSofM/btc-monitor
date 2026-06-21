import type { DataManifest } from './contracts';
import { asRecord, asString, asStringArray, toFiniteNumber } from './normalizerPrimitives';
import { missingCoreHistoryFields } from './schema';

export function normalizeManifestData(raw: unknown): DataManifest | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const generatedAt = asString(record.generatedAt);
  const latestDate = asString(record.latestDate);
  const lastUpdated = asString(record.lastUpdated) ?? '';
  const historyRows = toFiniteNumber(record.historyRows, 0);
  const historyLightRows = toFiniteNumber(record.historyLightRows, Number.NaN);
  const historyFullLightRows = toFiniteNumber(record.historyFullLightRows, Number.NaN);
  const schemaVersion = asString(record.schemaVersion) ?? 'unknown';
  const signalEventsV4Rows = toFiniteNumber(record.signalEventsV4Rows, 0);
  const indicatorSet = asString(record.indicatorSet);
  const scoringModelVersion = asString(record.scoringModelVersion);
  const activeIndicatorCountV4 = toFiniteNumber(record.activeIndicatorCountV4, Number.NaN);
  const maxTotalScoreV4 = toFiniteNumber(record.maxTotalScoreV4, Number.NaN);
  const activeIndicatorCountV6 = toFiniteNumber(record.activeIndicatorCountV6, Number.NaN);
  const maxTotalScoreV6 = toFiniteNumber(record.maxTotalScoreV6, Number.NaN);
  const historyFilesPayload = asRecord(record.historyFiles);
  const historyFiles = historyFilesPayload
    ? {
        full: asString(historyFilesPayload.full),
        fullLight: asString(historyFilesPayload.fullLight),
        light: asString(historyFilesPayload.light),
        lightRecentDays: toFiniteNumber(historyFilesPayload.lightRecentDays, Number.NaN),
        lightFields: asStringArray(historyFilesPayload.lightFields),
      }
    : undefined;
  const dataHealth = asRecord(record.dataHealth) as DataManifest['dataHealth'] | null;
  const auxiliaryDataFiles = asRecord(record.auxiliaryDataFiles) as DataManifest['auxiliaryDataFiles'] | null;
  const strategyMnavHealth = asRecord(record.strategyMnavHealth) as DataManifest['strategyMnavHealth'] | null;
  const schemaContract = asRecord(record.schemaContract) as DataManifest['schemaContract'] | null;
  const schemaContractMissingFields = missingCoreHistoryFields(
    schemaContract?.historyRequiredFields ?? historyFiles?.lightFields,
  );

  if (!generatedAt || !latestDate) {
    return null;
  }

  return {
    generatedAt,
    latestDate,
    lastUpdated,
    historyRows,
    historyLightRows: Number.isNaN(historyLightRows) ? undefined : historyLightRows,
    historyFullLightRows: Number.isNaN(historyFullLightRows) ? undefined : historyFullLightRows,
    historyFiles: historyFiles
      ? {
          ...historyFiles,
          lightRecentDays: Number.isNaN(historyFiles.lightRecentDays ?? Number.NaN)
            ? undefined
            : historyFiles.lightRecentDays,
        }
      : undefined,
    schemaVersion,
    signalEventsV4Rows: signalEventsV4Rows > 0 ? signalEventsV4Rows : undefined,
    indicatorSet,
    scoringModelVersion,
    activeIndicatorCountV4: Number.isNaN(activeIndicatorCountV4) ? undefined : activeIndicatorCountV4,
    maxTotalScoreV4: Number.isNaN(maxTotalScoreV4) ? undefined : maxTotalScoreV4,
    activeIndicatorCountV6: Number.isNaN(activeIndicatorCountV6) ? undefined : activeIndicatorCountV6,
    maxTotalScoreV6: Number.isNaN(maxTotalScoreV6) ? undefined : maxTotalScoreV6,
    dataHealth: dataHealth ?? undefined,
    auxiliaryDataFiles: auxiliaryDataFiles ?? undefined,
    strategyMnavHealth: strategyMnavHealth ?? undefined,
    schemaContract: schemaContract
      ? {
          ...schemaContract,
          missingCoreHistoryFields: schemaContractMissingFields,
        }
      : {
          missingCoreHistoryFields: schemaContractMissingFields,
        },
  };
}
