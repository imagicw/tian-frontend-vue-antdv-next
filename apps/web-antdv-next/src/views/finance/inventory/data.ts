import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { PLATFORM_OPTIONS } from '../sku-mapping/data';

export { PLATFORM_OPTIONS };

export const BATCH_STATUS_MAP: Record<string, { color: string; text: string }> =
  {
    ACTIVE: { text: '正常', color: 'success' },
    DEPLETED: { text: '已耗尽', color: 'default' },
    FROZEN: { text: '冻结', color: 'warning' },
  };

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'platform',
      label: '平台',
      component: 'Select',
      componentProps: {
        options: PLATFORM_OPTIONS,
        placeholder: '请选择平台',
        allowClear: true,
      },
    },
    {
      fieldName: 'gtSku',
      label: 'GT SKU',
      component: 'Input',
      componentProps: { placeholder: '请输入 GT SKU', allowClear: true },
    },
    {
      fieldName: 'shipmentNo',
      label: '运编号',
      component: 'Input',
      componentProps: { placeholder: '请输入运编号', allowClear: true },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    { field: 'id', title: 'ID', width: 80 },
    {
      field: 'platform',
      title: '平台',
      width: 120,
      slots: { default: 'platform' },
    },
    { field: 'gtSku', title: 'GT SKU', minWidth: 140, showOverflow: 'tooltip' },
    {
      field: 'customsNo',
      title: '报关单号',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'shipmentNo',
      title: '运编号',
      minWidth: 130,
      showOverflow: 'tooltip',
    },
    { field: 'unitCost', title: '单位成本(CNY)', width: 130 },
    { field: 'initialQuantity', title: '初始数量', width: 100 },
    { field: 'remainingQuantity', title: '剩余数量', width: 100 },
    {
      field: 'batchStatus',
      title: '批次状态',
      width: 100,
      slots: { default: 'batchStatus' },
    },
    { field: 'creator', title: '创建人', width: 100 },
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
