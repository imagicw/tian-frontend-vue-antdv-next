import { describe, expect, it } from 'vitest';

import {
  buildChangeSplitPlan,
  resolveCartonPlanOrders,
  validateCartonContainerCapacity,
  validateCartonPlan,
} from './carton-plan';

describe('validateCartonPlan', () => {
  const orders = [{ cartonNoFrom: 1, cartonNoTo: 100, id: 11, poNo: 'PO-100' }];

  it('accepts ranges that exactly cover a PO across actual containers', () => {
    expect(
      validateCartonPlan(orders, [
        {
          cargos: [
            {
              cartonNoFrom: 1,
              cartonNoTo: 50,
              containerId: 101,
              id: 1001,
              orderId: 11,
            },
          ],
          containerType: '40GP',
        },
        {
          cargos: [
            {
              cartonNoFrom: 51,
              cartonNoTo: 100,
              containerId: -1,
              id: -1001,
              orderId: 11,
            },
          ],
          containerType: '40HQ',
        },
      ]),
    ).toEqual([]);
  });

  it('reports the PO and actual container for overlapping and missing ranges', () => {
    expect(
      validateCartonPlan(orders, [
        {
          cargos: [{ cartonNoFrom: 1, cartonNoTo: 60, orderId: 11 }],
          containerType: '40GP',
        },
        {
          cargos: [{ cartonNoFrom: 50, cartonNoTo: 80, orderId: 11 }],
          containerType: '40HQ',
        },
      ]),
    ).toEqual([
      {
        containerIndex: 2,
        message: 'PO「PO-100」在第 2 柜的箱号 50 ~ 80 与已有范围重叠',
        orderId: 11,
        type: 'overlap',
      },
      {
        containerIndex: 1,
        message: 'PO「PO-100」缺少箱号范围 81 ~ 100',
        orderId: 11,
        type: 'gap',
      },
    ]);
  });
});

describe('resolveCartonPlanOrders', () => {
  it('excludes a PO that the same pending change removes', () => {
    expect(
      resolveCartonPlanOrders(
        [
          { cartonNoFrom: 1, cartonNoTo: 50, id: 11, poNo: 'PO-REMOVE' },
          { cartonNoFrom: 1, cartonNoTo: 50, id: 12, poNo: 'PO-KEEP' },
        ],
        [{ action: 2, orderId: 11 }],
      ),
    ).toEqual([{ cartonNoFrom: 1, cartonNoTo: 50, id: 12, poNo: 'PO-KEEP' }]);
  });

  it('uses proposed ranges for updates and includes newly added POs', () => {
    expect(
      resolveCartonPlanOrders(
        [{ cartonNoFrom: 1, cartonNoTo: 50, id: 11, poNo: 'PO-OLD' }],
        [
          {
            action: 1,
            orderId: 11,
            proposedOrderData: JSON.stringify({
              cartonNoFrom: 10,
              cartonNoTo: 60,
              poNo: 'PO-UPDATED',
            }),
          },
          {
            action: 3,
            orderId: 12,
            proposedOrderData: JSON.stringify({
              cartonNoFrom: 1,
              cartonNoTo: 20,
              poNo: 'PO-ADDED',
            }),
          },
        ],
      ),
    ).toEqual([
      { cartonNoFrom: 10, cartonNoTo: 60, id: 11, poNo: 'PO-UPDATED' },
      { cartonNoFrom: 1, cartonNoTo: 20, id: 12, poNo: 'PO-ADDED' },
    ]);
  });
});

describe('validateCartonContainerCapacity', () => {
  it('pinpoints the container and PO when an exact carton plan exceeds frozen capacity', () => {
    expect(
      validateCartonContainerCapacity(
        [
          {
            cartonNoFrom: 1,
            cartonNoTo: 100,
            id: 11,
            poNo: 'PO-CAPACITY',
            totalVolume: 60,
          },
        ],
        [
          {
            cargos: [{ cartonNoFrom: 1, cartonNoTo: 100, orderId: 11 }],
            containerType: '40GP',
            maxVolume: 50,
            minVolume: 10,
          },
        ],
      ),
    ).toEqual([
      {
        containerIndex: 1,
        message:
          '第 1 柜的 PO「PO-CAPACITY」合计体积 60 CBM 超出冻结柜容 10 ~ 50 CBM',
        orderId: 11,
        type: 'capacity',
      },
    ]);
  });
});

describe('buildChangeSplitPlan', () => {
  it('keeps the complete container list for the replacement request and omits local-only IDs', () => {
    expect(
      buildChangeSplitPlan(9, [
        {
          cargos: [{ cartonNoFrom: 1, cartonNoTo: 50, orderId: 11 }],
          containerType: '40GP',
          id: 101,
        },
        {
          cargos: [{ cartonNoFrom: 51, cartonNoTo: 100, orderId: 11 }],
          containerType: '40HQ',
          id: -1,
        },
      ]),
    ).toEqual({
      bookingId: 9,
      containers: [
        {
          cargos: [{ cartonNoFrom: 1, cartonNoTo: 50, orderId: 11 }],
          containerType: '40GP',
          id: 101,
        },
        {
          cargos: [{ cartonNoFrom: 51, cartonNoTo: 100, orderId: 11 }],
          containerType: '40HQ',
        },
      ],
    });
  });
});
