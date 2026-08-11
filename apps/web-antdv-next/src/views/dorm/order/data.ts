import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DormApi } from '#/api/dorm';
import type { DescriptionItemSchema } from '#/components/description';

export const ORDER_STATUS_MAP: Record<number, { color: string; text: string }> =
  {
    0: { text: '待分配', color: 'processing' },
    1: { text: '已预订', color: 'success' },
    2: { text: '已取消', color: 'default' },
    3: { text: '已结算', color: 'purple' },
    4: { text: '已分摊', color: 'cyan' },
  };

export const ORDER_STATUS_OPTIONS = [0, 1, 2, 3, 4].map((value) => ({
  label: ORDER_STATUS_MAP[value]?.text ?? String(value),
  value,
}));

export const SUB_ORDER_STATUS_MAP: Record<
  number,
  { color: string; text: string }
> = {
  0: { text: '待入住', color: 'processing' },
  1: { text: '已入住', color: 'success' },
  2: { text: '已退宿', color: 'default' },
};

export function useOrderDetailSchema(): DescriptionItemSchema[] {
  return [
    { field: 'applicantName', label: '申请人' },
    { field: 'dormOrderSnapshot.areaName', label: '住宿区域' },
    { field: 'dormOrderSnapshot.buildName', label: '楼栋' },
    {
      field: 'serveStartTime',
      label: '入住时间',
      render: (val, data) =>
        val ?? data?.dormOrderSnapshot?.serveStartTime ?? '-',
    },
    {
      field: 'serveEndTime',
      label: '退宿时间',
      render: (val, data) =>
        val ?? data?.dormOrderSnapshot?.serveEndTime ?? '-',
    },
    {
      field: 'serviceDays',
      label: '入住天数',
      render: (val: number) => (val == null ? '-' : `${val} 天`),
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions<DormApi.DormOrder>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'orderSerial', title: '订单号', minWidth: 160 },
    { field: 'userName', title: '申请人', width: 100 },
    {
      field: 'dormOrderSnapshot',
      title: '楼栋',
      width: 120,
      formatter: ({ cellValue }) => cellValue?.buildName ?? '-',
    },
    {
      field: 'dormOrderSnapshot',
      title: '入住时间',
      minWidth: 140,
      formatter: ({ cellValue }) => cellValue?.serveStartTime ?? '-',
    },
    {
      field: 'orderFee',
      title: '费用',
      width: 120,
      formatter: ({ row }) => {
        if (!row.orderFee) return '-';
        const currency = row.dormOrderSnapshot?.checkInInfo?.[0] ? '' : '';
        return `${row.orderFee} ${currency}`.trim();
      },
    },
    {
      field: 'status',
      title: '状态',
      width: 100,
      slots: { default: 'status' },
    },
    { field: 'createTime', title: '创建时间', width: 180 },
    {
      field: 'actions',
      title: '操作',
      width: 100,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'orderSerial',
      label: '订单号',
      component: 'Input',
      componentProps: { placeholder: '请输入订单号' },
    },
    {
      fieldName: 'userName',
      label: '申请人',
      component: 'Input',
      componentProps: { placeholder: '请输入姓名' },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '待分配', value: 0 },
          { label: '已预订', value: 1 },
          { label: '已取消', value: 2 },
          { label: '已结算', value: 3 },
          { label: '已分摊', value: 4 },
        ],
        placeholder: '请选择状态',
        allowClear: true,
      },
    },
  ];
}
