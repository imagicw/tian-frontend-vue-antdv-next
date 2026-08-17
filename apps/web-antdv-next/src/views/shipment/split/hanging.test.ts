import { describe, expect, it } from 'vitest';

import {
  deriveHangingRods,
  hasHangingConfig,
  isMixedCargoContainer,
  verifyHangingAllocationTotal,
} from './hanging';

describe('hasHangingConfig', () => {
  it('is true only when both ropesPerRod and packagesPerRope are set', () => {
    expect(hasHangingConfig({ ropesPerRod: 4, packagesPerRope: 12 })).toBe(
      true,
    );
  });

  it('is false when config is missing or incomplete (缺少挂装配置)', () => {
    expect(hasHangingConfig(undefined)).toBe(false);
    expect(hasHangingConfig({ ropesPerRod: 4 })).toBe(false);
    expect(hasHangingConfig({ packagesPerRope: 12 })).toBe(false);
    expect(hasHangingConfig({ ropesPerRod: 0, packagesPerRope: 12 })).toBe(
      false,
    );
  });
});

describe('deriveHangingRods', () => {
  it('computes 获配包数 ÷（每杆绳数 × 每绳包数）', () => {
    expect(
      deriveHangingRods(480, { ropesPerRod: 4, packagesPerRope: 12 }),
    ).toBe(10);
  });

  it('returns null when packages or config are missing', () => {
    expect(
      deriveHangingRods(undefined, { ropesPerRod: 4, packagesPerRope: 12 }),
    ).toBeNull();
    expect(deriveHangingRods(480, undefined)).toBeNull();
    expect(deriveHangingRods(480, { ropesPerRod: 4 })).toBeNull();
  });
});

describe('verifyHangingAllocationTotal', () => {
  it('is ok when the allocations exactly cover the PO package count', () => {
    expect(verifyHangingAllocationTotal(500, [300, 200])).toBe('ok');
  });

  it('flags over-allocation', () => {
    expect(verifyHangingAllocationTotal(500, [300, 300])).toBe('over');
  });

  it('flags under-allocation', () => {
    expect(verifyHangingAllocationTotal(500, [300])).toBe('under');
  });

  it('flags fractional (non-integer) packages', () => {
    expect(verifyHangingAllocationTotal(500, [300.5, 199.5])).toBe(
      'fractional',
    );
  });

  it('flags non-positive or missing values as invalid', () => {
    expect(verifyHangingAllocationTotal(500, [0, 500])).toBe('invalid');
    expect(
      verifyHangingAllocationTotal(500, [undefined as unknown as number]),
    ).toBe('invalid');
  });
});

describe('isMixedCargoContainer', () => {
  it('rejects a container mixing carton-range and hanging-package cargo', () => {
    expect(
      isMixedCargoContainer([{ cartonNoFrom: 1 }, { allocatedPackages: 100 }]),
    ).toBe(true);
  });

  it('allows a container with only one cargo type', () => {
    expect(
      isMixedCargoContainer([{ cartonNoFrom: 1 }, { cartonNoFrom: 51 }]),
    ).toBe(false);
    expect(
      isMixedCargoContainer([
        { allocatedPackages: 100 },
        { allocatedPackages: 200 },
      ]),
    ).toBe(false);
  });
});
