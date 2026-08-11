import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export const COST_STATUS_MAP: Record<string, { color: string; text: string; }> =
  {
    APPLIED: { text: '已生效', color: 'success' },
    REVOKED: { text: '已撤销', color: 'error' },
  };

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShipmentCostAllocation>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'batchNo', title: '批次号', width: 150 },
    { field: 'docNo', title: '单据号', width: 150 },
    { field: 'totalAmount', title: '总金额', width: 120 },
    { field: 'currency', title: '货币', width: 80 },
    { field: 'customsFeePerNo', title: '每运编号关税', width: 140 },
    {
      field: 'status',
      title: '状态',
      width: 100,
      formatter: ({ cellValue }) =>
        COST_STATUS_MAP[cellValue]?.text ?? cellValue ?? '-',
    },
    { field: 'operator', title: '操作人', width: 100 },
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
      fieldName: 'batchNo',
      label: '批次号',
      component: 'Input',
      componentProps: { placeholder: '请输入批次号' },
    },
    {
      fieldName: 'docNo',
      label: '单据号',
      component: 'Input',
      componentProps: { placeholder: '请输入单据号' },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: Object.entries(COST_STATUS_MAP).map(([value, { text }]) => ({
          label: text,
          value,
        })),
        allowClear: true,
      },
    },
  ];
}
