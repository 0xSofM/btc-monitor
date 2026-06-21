import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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

function expectEdgeConstant(name: string, value: string) {
  expect(edgeSource).toContain(`const ${name} = '${value}';`);
}

describe('current model contract', () => {
  it('keeps Edge runtime model constants aligned with the shared contract', () => {
    expectEdgeConstant('SCHEMA_VERSION', contract.schemaVersion);
    expectEdgeConstant('CANONICAL_MODEL', contract.canonicalModel);
    expectEdgeConstant('SCORING_MODEL_VERSION', contract.scoringModelVersion);
    expectEdgeConstant('LEGACY_SCORING_MODEL_VERSION', contract.legacyScoringModelVersion);
    expectEdgeConstant('CORE_INDICATOR_SET', contract.indicatorSet);
    expect(edgeSource).not.toContain("model: 'v6'");
    expect(edgeSource).not.toContain('core8_independent_mvrv_nupl_sopr_refined');
  });

  it('keeps Edge canonical signals limited to current core indicators', () => {
    for (const indicator of contract.displayIndicators) {
      expect(edgeSource).toContain(`'${indicator}'`);
    }

    for (const field of contract.compatibilityFields) {
      expect(edgeSource).toContain(`'${field}'`);
    }

    expect(edgeSource).toContain('signals: {');
    expect(edgeSource).toContain('sthSoprTrigger: signalsV6.sthSoprTrigger');
    expect(edgeSource).not.toContain('signals: signalsV6');
  });
});
