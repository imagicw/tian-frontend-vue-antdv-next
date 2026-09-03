import type { ShipmentApi } from '#/api/shipment';

export interface LoadingManifestContainer {
  cargoType: 'carton' | 'hanging';
  containerType: string;
  hanging?: {
    knotsPerRope?: number;
    packagesPerRope?: number;
    ropesPerRod?: number;
    totalRods?: number;
  };
  id: number;
  poAllocations: Array<{
    allocatedPackages?: number;
    allocatedRods?: number;
    id: number;
    poNo?: string;
  }>;
}

/**
 * 将分柜接口的实际柜快照投影为装柜单视图数据。
 * 挂装参数和杆数均直接使用实际柜响应中的冻结值，绝不回读客户配置再计算。
 */
export function buildLoadingManifest(
  containers: ShipmentApi.ShipmentContainer[],
): LoadingManifestContainer[] {
  return containers.map((container) => {
    const poAllocations = (container.cargos ?? [])
      .filter(
        (cargo) =>
          cargo.allocatedPackages !== undefined &&
          cargo.allocatedPackages !== null,
      )
      .map((cargo) => ({
        allocatedPackages: cargo.allocatedPackages,
        allocatedRods: cargo.allocatedRods,
        id: cargo.id,
        poNo: cargo.poNo,
      }));
    const cargoType = poAllocations.length > 0 ? 'hanging' : 'carton';

    return {
      cargoType,
      containerType: container.containerType,
      ...(cargoType === 'hanging'
        ? {
            hanging: {
              knotsPerRope: container.knotsPerRope,
              packagesPerRope: container.packagesPerRope,
              ropesPerRod: container.ropesPerRod,
              totalRods: container.totalHangingRods,
            },
          }
        : {}),
      id: container.id,
      poAllocations,
    };
  });
}
