import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DormApi } from '#/api/dorm';
import type { DescriptionItemSchema } from '#/components/description';

import { h } from 'vue';

import { Tag } from 'antdv-next';

export const ALLOCATION_STATUS_MAP: Record<
  number,
  { color: string; text: string; }
> = {
  0: { text: '有效', color: 'success' },
  1: { text: '已撤销', color: 'default' },
};

export const ALLOCATION_TYPE_MAP: Record<number, string> = {
  1: '按比例分摊',
  2: '按金额分摊',
};

export function useAllocationDetailSchema(): DescriptionItemSchema[] {
  return [
    { field: 'allocationOrderNo', label: '分摊单号' },
    {
      field: 'status',
      label: '状态',
      render: (val: number) =>
        h(
          Tag,
          { color: ALLOCATION_STATUS_MAP[val ?? 0]?.color ?? 'default' },
          () => ALLOCATION_STATUS_MAP[val ?? 0]?.text ?? String(val),
        ),
    },
    {
      field: 'allocationType',
      label: '分摊方式',
      render: (val: number) => ALLOCATION_TYPE_MAP[val ?? 1] ?? '-',
    },
    { field: 'settlementYear', label: '统计年份' },
    {
      field: 'settlementMonth',
      label: '统计月份',
      render: (val: number) => (val ? `${val} 月` : '-'),
    },
    {
      field: 'totalAmount',
      label: '总金额',
      render: (val: number, data: any) =>
        val ? `${val} ${data?.settleCurrencyCode ?? ''}` : '-',
    },
    { field: 'orderCount', label: '订单数' },
    { field: 'deptCount', label: '部门数' },
    { field: 'remark', label: '备注', render: (val: string) => val ?? '-' },
    { field: 'creator', label: '创建人' },
    { field: 'createTime', label: '创建时间' },
  ];
}

export function useGridColumns(): VxeTableGridOptions<DormApi.DormFeeAllocation>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'allocationOrderNo', title: '分摊单号', minWidth: 160 },
    { field: 'orderCount', title: '订单数', width: 80 },
    { field: 'deptCount', title: '部门数', width: 80 },
    { field: 'settlementYear', title: '统计年', width: 80 },
    { field: 'settlementMonth', title: '统计月', width: 80 },
    {
      field: 'allocationType',
      title: '分摊方式',
      width: 110,
      formatter: ({ cellValue }) => ALLOCATION_TYPE_MAP[cellValue] ?? '-',
    },
    {
      field: 'totalAmount',
      title: '总金额',
      width: 120,
      formatter: ({ row }) =>
        row.totalAmount
          ? `${row.totalAmount} ${row.settleCurrencyCode ?? ''}`
          : '-',
    },
    {
      field: 'status',
      title: '状态',
      width: 90,
      slots: { default: 'status' },
    },
    { field: 'creator', title: '创建人', width: 90 },
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
      fieldName: 'allocationOrderNo',
      label: '分摊单号',
      component: 'Input',
      componentProps: { placeholder: '请输入分摊单号' },
    },
    {
      fieldName: 'settlementYear',
      label: '统计年份',
      component: 'InputNumber',
      componentProps: { placeholder: '如：2024' },
    },
    {
      fieldName: 'settlementMonth',
      label: '统计月份',
      component: 'Select',
      componentProps: {
        options: Array.from({ length: 12 }, (_, i) => ({
          label: `${i + 1} 月`,
          value: i + 1,
        })),
        placeholder: '请选择月份',
        allowClear: true,
      },
    },
  ];
}
