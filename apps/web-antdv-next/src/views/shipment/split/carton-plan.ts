export interface CartonPlanCargo {
  allocatedPackages?: number;
  cartonNoFrom?: number;
  cartonNoTo?: number;
  containerId?: number;
  id?: number;
  orderId: number;
}

export interface CartonPlanContainer {
  cargos?: CartonPlanCargo[];
  containerType: string;
  /** 负数只用于本地草稿列表，提交整体替换请求时必须省略。 */
  id?: number;
  maxVolume?: number;
  minVolume?: number;
}

export interface CartonPlanOrder {
  cartonNoFrom?: number;
  cartonNoTo?: number;
  id: number;
  poNo?: string;
  totalVolume?: number;
}

export interface CartonPlanValidationIssue {
  containerIndex: number;
  message: string;
  orderId: number;
  type: 'capacity' | 'gap' | 'invalid-range' | 'overlap';
}

interface CartonRange extends CartonPlanCargo {
  containerIndex: number;
}

/**
 * 校验纸箱 PO 在整份实际柜方案中的箱号覆盖情况。
 * 挂装货物不携带箱号范围，不在此校验范围内。
 */
export function validateCartonPlan(
  orders: CartonPlanOrder[],
  containers: CartonPlanContainer[],
): CartonPlanValidationIssue[] {
  const rangesByOrderId = new Map<number, CartonRange[]>();
  for (const [index, container] of containers.entries()) {
    for (const cargo of container.cargos ?? []) {
      if (cargo.cartonNoFrom === undefined && cargo.cartonNoTo === undefined) {
        continue;
      }
      const ranges = rangesByOrderId.get(cargo.orderId) ?? [];
      ranges.push({ ...cargo, containerIndex: index + 1 });
      rangesByOrderId.set(cargo.orderId, ranges);
    }
  }

  const issues: CartonPlanValidationIssue[] = [];
  for (const order of orders) {
    if (order.cartonNoFrom === undefined || order.cartonNoTo === undefined) {
      continue;
    }
    const poLabel = order.poNo ?? String(order.id);
    const ranges = (rangesByOrderId.get(order.id) ?? []).toSorted(
      (left, right) =>
        (left.cartonNoFrom ?? Number.NEGATIVE_INFINITY) -
        (right.cartonNoFrom ?? Number.NEGATIVE_INFINITY),
    );
    let nextCartonNo = order.cartonNoFrom;
    for (const range of ranges) {
      const { cartonNoFrom, cartonNoTo } = range;
      if (
        cartonNoFrom === undefined ||
        cartonNoTo === undefined ||
        cartonNoFrom > cartonNoTo
      ) {
        issues.push({
          containerIndex: range.containerIndex,
          message: `PO「${poLabel}」在第 ${range.containerIndex} 柜的箱号范围无效`,
          orderId: order.id,
          type: 'invalid-range',
        });
        continue;
      }
      if (cartonNoFrom < order.cartonNoFrom || cartonNoTo > order.cartonNoTo) {
        issues.push({
          containerIndex: range.containerIndex,
          message: `PO「${poLabel}」在第 ${range.containerIndex} 柜的箱号范围超出 PO 原始范围`,
          orderId: order.id,
          type: 'invalid-range',
        });
        continue;
      }
      if (cartonNoFrom < nextCartonNo) {
        issues.push({
          containerIndex: range.containerIndex,
          message: `PO「${poLabel}」在第 ${range.containerIndex} 柜的箱号 ${cartonNoFrom} ~ ${cartonNoTo} 与已有范围重叠`,
          orderId: order.id,
          type: 'overlap',
        });
      } else if (cartonNoFrom > nextCartonNo) {
        issues.push({
          containerIndex: range.containerIndex,
          message: `PO「${poLabel}」缺少箱号范围 ${nextCartonNo} ~ ${cartonNoFrom - 1}`,
          orderId: order.id,
          type: 'gap',
        });
      }
      nextCartonNo = Math.max(nextCartonNo, cartonNoTo + 1);
    }
    if (nextCartonNo <= order.cartonNoTo) {
      issues.push({
        containerIndex: ranges[0]?.containerIndex ?? 0,
        message: `PO「${poLabel}」缺少箱号范围 ${nextCartonNo} ~ ${order.cartonNoTo}`,
        orderId: order.id,
        type: 'gap',
      });
    }
  }
  return issues;
}

/** 将本地草稿转换为后端要求的整份替换请求；不会泄漏前端的临时实际柜 ID。 */
export function buildChangeSplitPlan(
  bookingId: number,
  containers: CartonPlanContainer[],
) {
  return {
    bookingId,
    containers: containers.map((container) => ({
      cargos: container.cargos?.map((cargo) => ({
        ...(cargo.allocatedPackages === undefined
          ? {}
          : { allocatedPackages: cargo.allocatedPackages }),
        ...(cargo.cartonNoFrom === undefined
          ? {}
          : { cartonNoFrom: cargo.cartonNoFrom }),
        ...(cargo.cartonNoTo === undefined
          ? {}
          : { cartonNoTo: cargo.cartonNoTo }),
        orderId: cargo.orderId,
      })),
      containerType: container.containerType,
      ...(container.id && container.id > 0 ? { id: container.id } : {}),
    })),
  };
}

/** 变更发布会先处理移出 PO；前端完整性校验必须使用同一份有效订单集。 */
export function resolveCartonPlanOrders<T extends CartonPlanOrder>(
  orders: T[],
  changeOrders:
    | Array<{
        action: number;
        orderId: number;
        proposedOrderData?: string;
      }>
    | undefined,
): T[] {
  const changesByOrderId = new Map(
    (changeOrders ?? []).map((changeOrder) => [
      changeOrder.orderId,
      changeOrder,
    ]),
  );
  const parseProposedOrder = (changeOrder: {
    orderId: number;
    proposedOrderData?: string;
  }) => {
    if (!changeOrder.proposedOrderData) return;
    try {
      return {
        ...JSON.parse(changeOrder.proposedOrderData),
        id: changeOrder.orderId,
      } as T;
    } catch {
      // 损坏的历史草稿继续使用当前订单，避免前端校验因此中断。
    }
  };
  const effectiveOrders = orders.flatMap((order) => {
    const changeOrder = changesByOrderId.get(order.id);
    if (changeOrder?.action === 2) return [];
    if (changeOrder?.action === 1) {
      const proposedOrder = parseProposedOrder(changeOrder);
      return [proposedOrder ? { ...order, ...proposedOrder } : order];
    }
    return [order];
  });
  for (const changeOrder of changeOrders ?? []) {
    if (changeOrder.action !== 3) continue;
    const proposedOrder = parseProposedOrder(changeOrder);
    if (proposedOrder) effectiveOrders.push(proposedOrder);
  }
  return effectiveOrders;
}

/** 变更发布会先覆盖订舱头，柜容配置也必须按该拟议值匹配。 */
export function resolveChangeSnapshot<T extends object>(
  current: null | T | undefined,
  proposedData: string | undefined,
): T | undefined {
  if (!current) return;
  if (!proposedData) return current;
  try {
    return { ...current, ...JSON.parse(proposedData) } as T;
  } catch {
    return current;
  }
}

/**
 * 依据 PO 的总 CBM 与箱号范围比例预检每个纸箱实际柜的冻结柜容。
 * 后端仍是最终权威；此前端检查仅用于把失败定位到柜与 PO。
 */
export function validateCartonContainerCapacity(
  orders: CartonPlanOrder[],
  containers: CartonPlanContainer[],
): CartonPlanValidationIssue[] {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const issues: CartonPlanValidationIssue[] = [];

  for (const [index, container] of containers.entries()) {
    const cartonCargos = (container.cargos ?? []).filter(
      (cargo) =>
        (cargo.allocatedPackages === undefined ||
          cargo.allocatedPackages === null) &&
        cargo.cartonNoFrom !== undefined &&
        cargo.cartonNoTo !== undefined,
    );
    if (cartonCargos.length === 0) continue;

    const firstCargo = cartonCargos[0]!;
    const firstOrder = orderById.get(firstCargo.orderId);
    const containerIndex = index + 1;
    if (
      container.minVolume === undefined ||
      container.maxVolume === undefined ||
      container.minVolume > container.maxVolume
    ) {
      issues.push({
        containerIndex,
        message: `第 ${containerIndex} 柜的 PO「${firstOrder?.poNo ?? firstCargo.orderId}」缺少有效的冻结柜容配置`,
        orderId: firstCargo.orderId,
        type: 'capacity',
      });
      continue;
    }

    let totalVolume = 0;
    for (const cargo of cartonCargos) {
      const order = orderById.get(cargo.orderId);
      if (
        !order ||
        order.cartonNoFrom === undefined ||
        order.cartonNoTo === undefined ||
        order.totalVolume === undefined
      ) {
        continue;
      }
      const cartonCount = cargo.cartonNoTo! - cargo.cartonNoFrom! + 1;
      const totalCartons = order.cartonNoTo - order.cartonNoFrom + 1;
      totalVolume += (order.totalVolume * cartonCount) / totalCartons;
    }
    if (
      totalVolume < container.minVolume ||
      totalVolume > container.maxVolume
    ) {
      const displayVolume = Number(totalVolume.toFixed(3));
      issues.push({
        containerIndex,
        message: `第 ${containerIndex} 柜的 PO「${firstOrder?.poNo ?? firstCargo.orderId}」合计体积 ${displayVolume} CBM 超出冻结柜容 ${container.minVolume} ~ ${container.maxVolume} CBM`,
        orderId: firstCargo.orderId,
        type: 'capacity',
      });
    }
  }
  return issues;
}
