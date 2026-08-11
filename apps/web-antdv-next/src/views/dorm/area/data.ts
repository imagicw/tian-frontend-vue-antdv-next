import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DormApi } from '#/api/dorm';

export function useGridColumns(): VxeTableGridOptions<DormApi.DormArea>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'areaName', title: '区域名称', minWidth: 120 },
    { field: 'regionName', title: '所在地区', minWidth: 100 },
    { field: 'timeZone', title: '时区', minWidth: 120 },
    { field: 'settleCurrencyCode', title: '结算币种', width: 100 },
    { field: 'position', title: '地址', minWidth: 150, showOverflow: true },
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
      fieldName: 'areaName',
      label: '区域名称',
      component: 'Input',
      componentProps: { placeholder: '请输入区域名称' },
    },
    {
      fieldName: 'regionName',
      label: '所在地区',
      component: 'Input',
      componentProps: { placeholder: '请输入地区' },
    },
  ];
}
