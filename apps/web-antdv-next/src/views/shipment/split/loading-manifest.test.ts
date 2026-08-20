import type { ShipmentApi } from '#/api/shipment';

import { describe, expect, it } from 'vitest';

import { buildLoadingManifest } from './loading-manifest';

describe('buildLoadingManifest', () => {
  it('renders a hanging container with its frozen rope settings and PO package/rod allocation', () => {
    const manifest = buildLoadingManifest([
      {
        bookingId: 1,
        containerType: '40HQ',
        id: 101,
        knotsPerRope: 2,
        packagesPerRope: 12,
        ropesPerRod: 4,
        totalHangingRods: 10,
        cargos: [
          {
            allocatedPackages: 480,
            allocatedRods: 10,
            containerId: 101,
            id: 1001,
            orderId: 11,
            poNo: 'PO-HANGING',
          },
        ],
      },
    ] as ShipmentApi.ShipmentContainer[]);

    expect(manifest).toEqual([
      {
        cargoType: 'hanging',
        containerType: '40HQ',
        hanging: {
          knotsPerRope: 2,
          packagesPerRope: 12,
          ropesPerRod: 4,
          totalRods: 10,
        },
        id: 101,
        poAllocations: [
          {
            allocatedPackages: 480,
            allocatedRods: 10,
            id: 1001,
            poNo: 'PO-HANGING',
          },
        ],
      },
    ]);
  });

  it('keeps carton and hanging containers distinct in a mixed booking', () => {
    const manifest = buildLoadingManifest([
      {
        bookingId: 1,
        containerType: '40GP',
        id: 101,
        cargos: [
          {
            allocatedPackages: null as unknown as number,
            cartonNoFrom: 1,
            cartonNoTo: 50,
            containerId: 101,
            id: 1001,
            orderId: 11,
            poNo: 'PO-CARTON',
          },
        ],
      },
      {
        bookingId: 1,
        containerType: '40HQ',
        id: 102,
        packagesPerRope: 12,
        ropesPerRod: 4,
        cargos: [
          {
            allocatedPackages: 240,
            allocatedRods: 5,
            containerId: 102,
            id: 1002,
            orderId: 12,
            poNo: 'PO-HANGING',
          },
        ],
      },
    ] as ShipmentApi.ShipmentContainer[]);

    expect(manifest.map(({ cargoType }) => cargoType)).toEqual([
      'carton',
      'hanging',
    ]);
    expect(manifest[0]?.poAllocations).toEqual([]);
    expect(manifest[1]?.poAllocations).toEqual([
      {
        allocatedPackages: 240,
        allocatedRods: 5,
        id: 1002,
        poNo: 'PO-HANGING',
      },
    ]);
  });

  it('uses the frozen response values instead of calculating from mutable client configuration', () => {
    const manifest = buildLoadingManifest([
      {
        bookingId: 1,
        containerType: '40HQ',
        id: 101,
        packagesPerRope: 10,
        ropesPerRod: 5,
        totalHangingRods: 9.6,
        cargos: [
          {
            allocatedPackages: 480,
            allocatedRods: 9.6,
            containerId: 101,
            id: 1001,
            orderId: 11,
            poNo: 'PO-SNAPSHOT',
          },
        ],
      },
    ] as ShipmentApi.ShipmentContainer[]);

    expect(manifest[0]?.hanging).toMatchObject({
      packagesPerRope: 10,
      ropesPerRod: 5,
      totalRods: 9.6,
    });
    expect(manifest[0]?.poAllocations[0]?.allocatedRods).toBe(9.6);
  });
});
