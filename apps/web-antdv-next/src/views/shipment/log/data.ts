import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShipmentOperationLog>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'businessType', title: '业务类型', width: 140 },
    { field: 'businessId', title: '业务ID', width: 100 },
    { field: 'operator', title: '操作人', width: 120 },
    { field: 'operateDesc', title: '操作描述', minWidth: 200 },
    { field: 'operateTime', title: '操作时间', width: 180 },
    { field: 'createTime', title: '创建时间', width: 180 },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'businessType',
      label: '业务类型',
      component: 'Input',
      componentProps: { placeholder: '请输入业务类型' },
    },
    {
      fieldName: 'businessId',
      label: '业务ID',
      component: 'InputNumber',
      componentProps: { placeholder: '请输入业务ID' },
    },
    {
      fieldName: 'operator',
      label: '操作人',
      component: 'Input',
      componentProps: { placeholder: '请输入操作人' },
    },
  ];
}
