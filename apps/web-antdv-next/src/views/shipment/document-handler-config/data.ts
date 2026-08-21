import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export function useConfigColumns(): VxeTableGridOptions<ShipmentApi.DocumentHandlerConfig>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'clientCode', title: '客户代码', width: 140 },
    {
      field: 'destinationCountry',
      title: '目的国',
      minWidth: 140,
      formatter: ({ cellValue }) => cellValue || '客户默认',
    },
    { field: 'docUserId', title: '单证责任人 ID', width: 140 },
    { field: 'createTime', title: '创建时间', width: 170 },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 130,
    },
  ];
}

export function useConfigQuerySchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
    },
    {
      fieldName: 'destinationCountry',
      label: '目的国',
      component: 'Input',
      componentProps: { placeholder: '请输入目的国' },
    },
  ];
}

export function useBackfillColumns(): VxeTableGridOptions<ShipmentApi.DocumentHandlerBackfillRecord>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'bookingNo', title: '订舱单号', minWidth: 150 },
    { field: 'bookingId', title: '订舱 ID', width: 100 },
    { field: 'clientCode', title: '客户', width: 110 },
    { field: 'destinationCountry', title: '目的国', width: 100 },
    { field: 'resolvedDocUserId', title: '补写责任人 ID', width: 140 },
    { field: 'status', title: '结果', width: 100 },
    { field: 'message', title: '说明', minWidth: 200 },
    { field: 'createTime', title: '执行时间', width: 170 },
  ];
}

export function useBackfillQuerySchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'bookingId',
      label: '订舱 ID',
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0 },
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
    },
    {
      fieldName: 'status',
      label: '结果',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '成功', value: 'SUCCESS' },
          { label: '跳过', value: 'SKIPPED' },
          { label: '失败', value: 'FAILED' },
        ],
      },
    },
  ];
}
