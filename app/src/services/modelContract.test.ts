import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  CURRENT_MODEL_CONTRACT,
  CANONICAL_MODEL,
  COMPATIBILITY_FIELDS,
  CORE_INDICATOR_SET,
  DISPLAY_INDICATORS,
  LEGACY_SCORING_MODEL_VERSION,
  SCHEMA_VERSION,
  SCORING_MODEL_VERSION,
} from './generatedModelContract';

type CurrentModelContract = {
  schemaVersion: string;
  canonicalModel: string;
  scoringModelVersion: string;
  legacyScoringModelVersion: string;
  indicatorSet: string;
  displayIndicators: string[];
  compatibilityFields: string[];
};

const contract = JSON.parse(
  readFileSync(new URL('../../../contracts/current_model.json', import.meta.url), 'utf-8'),
) as CurrentModelContract;
const edgeSource = readFileSync(new URL('../../api/btc-data.js', import.meta.url), 'utf-8');
const edgeGeneratedSource = readFileSync(new URL('../../api/generated-model-contract.js', import.meta.url), 'utf-8');

describe('current model contract', () => {
  it('keeps generated frontend constants aligned with the shared contract', () => {
    expect(CURRENT_MODEL_CONTRACT).toEqual(contract);
    expect(SCHEMA_VERSION).toBe(contract.schemaVersion);
    expect(CANONICAL_MODEL).toBe(contract.canonicalModel);
    expect(SCORING_MODEL_VERSION).toBe(contract.scoringModelVersion);
    expect(LEGACY_SCORING_MODEL_VERSION).toBe(contract.legacyScoringModelVersion);
    expect(CORE_INDICATOR_SET).toBe(contract.indicatorSet);
    expect(DISPLAY_INDICATORS).toEqual(contract.displayIndicators);
    expect(COMPATIBILITY_FIELDS).toEqual(contract.compatibilityFields);
  });

  it('keeps Edge runtime model constants sourced from the generated contract', () => {
    expect(edgeGeneratedSource).toContain(`schemaVersion": "${contract.schemaVersion}"`);
    expect(edgeGeneratedSource).toContain(`canonicalModel": "${contract.canonicalModel}"`);
    expect(edgeGeneratedSource).toContain(`scoringModelVersion": "${contract.scoringModelVersion}"`);
    expect(edgeGeneratedSource).toContain(`legacyScoringModelVersion": "${contract.legacyScoringModelVersion}"`);
    expect(edgeGeneratedSource).toContain(`indicatorSet": "${contract.indicatorSet}"`);
    expect(edgeSource).toContain("from './generated-model-contract.js'");
    expect(edgeSource).not.toContain("model: 'v6'");
    expect(edgeSource).not.toContain('core8_independent_mvrv_nupl_sopr_refined');
  });

  it('keeps Edge canonical signals limited to current core indicators', () => {
    for (const indicator of contract.displayIndicators) {
      expect(edgeGeneratedSource).toContain(`"${indicator}"`);
    }

    for (const field of contract.compatibilityFields) {
      expect(edgeGeneratedSource).toContain(`"${field}"`);
    }

    expect(edgeSource).toContain('signals: {');
    expect(edgeSource).toContain('sthSoprTrigger: signalsV6.sthSoprTrigger');
    expect(edgeSource).not.toContain('signals: signalsV6');
  });
});
