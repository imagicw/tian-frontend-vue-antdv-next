import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { h } from 'vue';

import { Tag } from 'antdv-next';

export const BOOKING_STATUS_MAP: Record<
  string,
  { color: string; text: string; }
> = {
  '0': { text: '草稿', color: 'default' },
  '1': { text: '已提交', color: 'processing' },
  '2': { text: '已确认', color: 'success' },
  '3': { text: '已驳回', color: 'warning' },
  '4': { text: '已出运', color: 'green' },
  '5': { text: '已取消', color: 'error' },
};

export const BOOKING_TYPE_MAP: Record<number, string> = {
  1: '拼柜',
  2: '散货',
};

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShipmentBooking>['columns'] {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { type: 'seq', width: 60, title: '#' },
    { field: 'bookingNo', title: '订舱号', width: 150, fixed: 'left' },
    {
      field: 'bookingType',
      title: '订舱类型',
      width: 100,
      formatter: ({ cellValue }) => BOOKING_TYPE_MAP[cellValue] ?? '-',
    },
    {
      field: 'status',
      title: '状态',
      width: 110,
      slots: {
        default: ({ row }) => [
          h(
            Tag,
            { color: BOOKING_STATUS_MAP[row.status]?.color ?? 'default' },
            () => BOOKING_STATUS_MAP[row.status]?.text ?? row.status ?? '-',
          ),
        ],
      },
    },
    { field: 'clientCode', title: '客户代码', width: 110 },
    { field: 'clientName', title: '客户名称', width: 140 },
    { field: 'freightForwarder', title: '货代', width: 140 },
    { field: 'productionCountry', title: '生产国家', width: 110 },
    { field: 'applicant', title: '申请人', width: 100 },
    { field: 'booker', title: '订舱人', width: 100 },
    { field: 'vesselDate', title: '船期', width: 110 },
    { field: 'blNo', title: '提单号', width: 140 },
    { field: 'createTime', title: '创建时间', width: 180 },
    {
      field: 'actions',
      title: '操作',
      width: 280,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'bookingNo',
      label: '订舱号',
      component: 'Input',
      componentProps: { placeholder: '请输入订舱号' },
    },
    {
      fieldName: 'bookingType',
      label: '订舱类型',
      component: 'Select',
      componentProps: {
        options: [
          { label: '拼柜', value: 1 },
          { label: '散货', value: 2 },
        ],
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: Object.entries(BOOKING_STATUS_MAP).map(
          ([value, { text }]) => ({ label: text, value }),
        ),
        allowClear: true,
      },
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
    },
    {
      fieldName: 'applicant',
      label: '申请人',
      component: 'Input',
      componentProps: { placeholder: '请输入申请人' },
    },
  ];
}
