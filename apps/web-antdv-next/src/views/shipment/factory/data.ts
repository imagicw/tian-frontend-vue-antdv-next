import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export const LOCATION_MAP: Record<string, string> = {
  DOMESTIC: '国内',
  OVERSEAS: '海外',
};

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ProductFactory>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'factoryCode', title: '工厂简码', width: 120 },
    { field: 'factoryNameCn', title: '工厂中文名', minWidth: 160 },
    { field: 'factoryNameEn', title: '工厂英文名', minWidth: 160 },
    { field: 'country', title: '国家', width: 100 },
    { field: 'region', title: '区域', width: 100 },
    {
      field: 'location',
      title: '位置',
      width: 90,
      formatter: ({ cellValue }) => LOCATION_MAP[cellValue] ?? cellValue,
    },
    {
      field: 'isActive',
      title: '状态',
      width: 80,
      formatter: ({ cellValue }) => (cellValue ? '启用' : '停用'),
    },
    {
      field: 'actions',
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'factoryCode',
      label: '工厂简码',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂简码' },
    },
    {
      fieldName: 'factoryName',
      label: '工厂名称',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂名称' },
    },
    {
      fieldName: 'location',
      label: '位置',
      component: 'Select',
      componentProps: {
        options: [
          { label: '国内', value: 'DOMESTIC' },
          { label: '海外', value: 'OVERSEAS' },
        ],
        allowClear: true,
      },
    },
  ];
}
