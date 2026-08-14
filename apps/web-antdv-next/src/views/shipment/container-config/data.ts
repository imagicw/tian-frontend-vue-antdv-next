import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ContainerConfig>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'clientCode', title: '客户代码', width: 120 },
    { field: 'freightForwarder', title: '货代', minWidth: 140 },
    { field: 'productionCountry', title: '生产国', width: 100 },
    { field: 'containerType', title: '箱型', width: 100 },
    { field: 'minVolume', title: '最小体积(CBM)', width: 130 },
    { field: 'maxVolume', title: '最大体积(CBM)', width: 130 },
    { field: 'minHangingRods', title: '最小杆数', width: 100 },
    { field: 'maxHangingRods', title: '最大杆数', width: 100 },
    { field: 'ropesPerRod', title: '每杆绳数', width: 100 },
    { field: 'packagesPerRope', title: '每绳包数', width: 100 },
    { field: 'knotsPerRope', title: '每绳绳结数', width: 110 },
    { field: 'sortOrder', title: '排序', width: 80 },
    {
      field: 'enabled',
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
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
    },
    {
      fieldName: 'containerType',
      label: '箱型',
      component: 'Input',
      componentProps: { placeholder: '如：40GP' },
    },
  ];
}
