import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ClientProfile>['columns'] {
  return [
    { type: 'seq', width: 60, title: '#' },
    { field: 'clientCode', title: '客户代码', width: 120 },
    { field: 'clientName', title: '客户名称', minWidth: 160 },
    { field: 'allowedContainerTypes', title: '允许箱型', minWidth: 120 },
    {
      field: 'consolidationDeliveryDays',
      title: '拼柜交期跨度(天)',
      width: 140,
    },
    {
      field: 'allowMultiLocation',
      title: '两地装货',
      width: 100,
      formatter: ({ cellValue }) => (cellValue ? '允许' : '不允许'),
    },
    {
      field: 'leadTimeDomestic',
      title: '国内提前期',
      width: 110,
      formatter: ({ cellValue }) =>
        cellValue == null ? '-' : `${cellValue} 天`,
    },
    {
      field: 'leadTimeOverseas',
      title: '海外提前期',
      width: 110,
      formatter: ({ cellValue }) =>
        cellValue == null ? '-' : `${cellValue} 天`,
    },
    {
      field: 'enabled',
      title: '状态',
      width: 80,
      slots: { default: 'enabled' },
    },
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
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
    },
    {
      fieldName: 'clientName',
      label: '客户名称',
      component: 'Input',
      componentProps: { placeholder: '请输入客户名称' },
    },
  ];
}
