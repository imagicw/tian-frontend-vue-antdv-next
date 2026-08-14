/** 出运方式：整柜挂装（与后端 ShippingModeEnum.FCL_HANGING 一致）。 */
export const SHIPPING_MODE_FCL_HANGING = 3;

export interface HangingCapacityConfig {
  packagesPerRope?: number;
  ropesPerRod?: number;
}

/** 该柜型是否已配置挂装冻结参数（每杆绳数 / 每绳包数）；缺失即视为“缺少挂装配置”，不允许分配。 */
export function hasHangingConfig(
  config: HangingCapacityConfig | undefined,
): boolean {
  return !!config && !!config.ropesPerRod && !!config.packagesPerRope;
}

/** 派生杆数 = 获配包数 ÷（每杆绳数 × 每绳包数）；缺配置时无法计算，返回 null。 */
export function deriveHangingRods(
  allocatedPackages: number | undefined,
  config: HangingCapacityConfig | undefined,
): null | number {
  if (
    !allocatedPackages ||
    allocatedPackages <= 0 ||
    !hasHangingConfig(config)
  ) {
    return null;
  }
  const denominator = config!.ropesPerRod! * config!.packagesPerRope!;
  return allocatedPackages / denominator;
}

export type HangingAllocationVerdict =
  | 'fractional'
  | 'invalid'
  | 'ok'
  | 'over'
  | 'under';

/**
 * 校验一批分配的合计包数是否恰好覆盖该 PO 的总包数：非正整数视为非法输入，
 * 有分数包视为 fractional，合计超出为 over，合计不足为 under。
 */
export function verifyHangingAllocationTotal(
  totalPackages: number,
  allocatedPackagesList: number[],
): HangingAllocationVerdict {
  if (allocatedPackagesList.some((n) => n === undefined || n === null)) {
    return 'invalid';
  }
  if (allocatedPackagesList.some((n) => !Number.isInteger(n))) {
    return 'fractional';
  }
  if (allocatedPackagesList.some((n) => n <= 0)) {
    return 'invalid';
  }
  const sum = allocatedPackagesList.reduce((a, b) => a + b, 0);
  if (sum > totalPackages) return 'over';
  if (sum < totalPackages) return 'under';
  return 'ok';
}

/** 同一实际柜内不能既有纸箱分配又有挂装分配。 */
export function isMixedCargoContainer(
  cargos: Array<{ allocatedPackages?: number; cartonNoFrom?: number }>,
): boolean {
  const hasCarton = cargos.some(
    (c) => c.cartonNoFrom !== undefined && c.cartonNoFrom !== null,
  );
  const hasHanging = cargos.some(
    (c) => c.allocatedPackages !== undefined && c.allocatedPackages !== null,
  );
  return hasCarton && hasHanging;
}
