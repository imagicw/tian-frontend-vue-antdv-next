import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { PLATFORM_OPTIONS } from '../sku-mapping/data';

export { PLATFORM_OPTIONS };

export const TASK_STATUS_MAP: Record<string, { color: string; text: string }> =
  {
    WAITING_PREVIEW: { text: '待预览', color: 'processing' },
    WAIT_DEDUCT_CONFIRM: { text: '待扣减确认', color: 'warning' },
    PROCESSED: { text: '已处理', color: 'success' },
    ROLLED_BACK: { text: '已回滚', color: 'default' },
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
      fieldName: 'billingYear',
      label: '账期年份',
      component: 'InputNumber',
      componentProps: {
        min: 2024,
        max: 2050,
        placeholder: '账期年份',
        allowClear: true,
      },
    },
    {
      fieldName: 'taskStatus',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: Object.entries(TASK_STATUS_MAP).map(([value, { text }]) => ({
          label: text,
          value,
        })),
        placeholder: '请选择状态',
        allowClear: true,
      },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'taskNo',
      title: '任务编号',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'platform',
      title: '平台',
      width: 120,
      slots: { default: 'platform' },
    },
    {
      field: 'fileName',
      title: '文件名',
      minWidth: 200,
      showOverflow: 'tooltip',
    },
    { field: 'billingYear', title: '账期年份', width: 100 },
    { field: 'billingPeriod', title: '账期', width: 130 },
    {
      field: 'taskStatus',
      title: '状态',
      width: 130,
      slots: { default: 'taskStatus' },
    },
    { field: 'totalRecords', title: '记录数', width: 90 },
    {
      field: 'errorMsg',
      title: '错误信息',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'processedTime',
      title: '处理时间',
      width: 180,
      formatter: 'formatDateTime',
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
      width: 160,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
