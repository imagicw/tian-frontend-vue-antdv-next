import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShippingNo>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'shippingNo', title: '运编号', minWidth: 160 },
    { field: 'relatedRefNo', title: '关联编号', minWidth: 160 },
    { field: 'costAllocation', title: '费用分摊金额', width: 140 },
    { field: 'createTime', title: '创建时间', width: 180 },
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
      fieldName: 'shippingNo',
      label: '运编号',
      component: 'Input',
      componentProps: { placeholder: '请输入运编号' },
    },
    {
      fieldName: 'relatedRefNo',
      label: '关联编号',
      component: 'Input',
      componentProps: { placeholder: '请输入关联编号' },
    },
  ];
}
