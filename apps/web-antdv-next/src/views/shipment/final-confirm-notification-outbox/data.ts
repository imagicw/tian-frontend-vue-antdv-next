import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

const STATUS_LABEL: Record<number, string> = {
  0: '待投递',
  1: '已发送',
  2: '发送失败',
};
const RULE_LABEL: Record<number, string> = {
  1: '全部完成',
  2: '责任业务员',
  3: '交期规则',
};

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.FinalConfirmNotificationOutbox>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'bookingId', title: '订舱 ID', width: 100 },
    {
      field: 'ruleCode',
      title: '通知规则',
      width: 120,
      formatter: ({ cellValue }) => RULE_LABEL[cellValue] ?? cellValue,
    },
    { field: 'groupKey', title: '完成分组', minWidth: 160 },
    { field: 'recipientSnapshot', title: '收件人快照', minWidth: 200 },
    {
      field: 'status',
      title: '投递状态',
      width: 110,
      formatter: ({ cellValue }) => STATUS_LABEL[cellValue] ?? cellValue,
    },
    { field: 'retryCount', title: '失败次数', width: 100 },
    { field: 'lastError', title: '最近错误', minWidth: 200 },
    { field: 'completedTime', title: '完成时间', width: 170 },
    { field: 'sentTime', title: '发送时间', width: 170 },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 100,
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'bookingId',
      label: '订舱 ID',
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0 },
    },
    {
      fieldName: 'ruleCode',
      label: '通知规则',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '全部完成', value: 1 },
          { label: '责任业务员', value: 2 },
          { label: '交期规则', value: 3 },
        ],
      },
    },
    {
      fieldName: 'status',
      label: '投递状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '待投递', value: 0 },
          { label: '已发送', value: 1 },
          { label: '发送失败', value: 2 },
        ],
      },
    },
  ];
}
