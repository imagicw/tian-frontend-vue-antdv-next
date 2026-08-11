import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export const LOCATION_MAP: Record<string, string> = {
  DOMESTIC: '国内',
  OVERSEAS: '海外',
};

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShipmentPackingList>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'styleNo', title: '款号', width: 130 },
    { field: 'projectNo', title: '项目号', width: 140 },
    { field: 'brand', title: '品牌', width: 120 },
    { field: 'shippingCountry', title: '出运国', width: 80 },
    { field: 'productNameCn', title: '中文品名', minWidth: 150 },
    { field: 'productNameEn', title: '英文品名', minWidth: 150 },
    {
      field: 'productionLocation',
      title: '生产地',
      width: 80,
      formatter: ({ cellValue }) => LOCATION_MAP[cellValue] ?? cellValue ?? '-',
    },
    {
      field: 'isThirdParty',
      title: '第三方',
      width: 70,
      formatter: ({ cellValue }) => (cellValue ? '是' : '否'),
    },
    { field: 'createTime', title: '创建时间', width: 180 },
    {
      field: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'styleNo',
      label: '款号',
      component: 'Input',
      componentProps: { placeholder: '请输入款号' },
    },
    {
      fieldName: 'projectNo',
      label: '项目号',
      component: 'Input',
      componentProps: { placeholder: '请输入项目号' },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'Input',
      componentProps: { placeholder: '请输入品牌' },
    },
    {
      fieldName: 'shippingCountry',
      label: '出运国',
      component: 'Input',
      componentProps: { placeholder: '请输入出运国' },
    },
  ];
}
