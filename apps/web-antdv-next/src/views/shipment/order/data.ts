import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { h } from 'vue';

import { Tag } from 'antdv-next';

export const ORDER_STATUS_MAP: Record<string, { color: string; text: string }> =
  {
    '0': { text: '草稿', color: 'default' },
    '5': { text: '已发布', color: 'blue' },
    '10': { text: '订舱中', color: 'processing' },
    '15': { text: '已提交', color: 'cyan' },
    '20': { text: '已确认', color: 'success' },
    '30': { text: '已出运', color: 'green' },
    '35': { text: '已驳回', color: 'warning' },
    '40': { text: '已取消', color: 'error' },
  };

export const SHIPPING_MODE_MAP: Record<number, string> = {
  1: '散货',
  2: '整柜纸箱',
  3: '整柜挂装',
};

export function useGridColumns(): VxeTableGridOptions<ShipmentApi.ShipmentOrder>['columns'] {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { type: 'seq', width: 60, title: '#' },
    { field: 'poNo', title: 'PO号', width: 150, fixed: 'left' },
    { field: 'packId', title: 'Pack ID', width: 140 },
    { field: 'clientCode', title: '客户代码', width: 110 },
    { field: 'shippingNo', title: '运编号', width: 130 },
    { field: 'destinationCountry', title: '目的国', width: 80 },
    { field: 'deliveryDate', title: '交期', width: 110 },
    { field: 'color', title: '颜色', width: 90 },
    {
      field: 'status',
      title: '状态',
      width: 100,
      slots: {
        default: ({ row }) => {
          const status = row.status == null ? '' : String(row.status);
          return [
            h(
              Tag,
              { color: ORDER_STATUS_MAP[status]?.color ?? 'default' },
              () => ORDER_STATUS_MAP[status]?.text ?? (status || '-'),
            ),
          ];
        },
      },
    },
    { field: 'totalVolume', title: '总体积(CBM)', width: 120 },
    { field: 'productionLocationName', title: '生产地', width: 80 },
    { field: 'loadingFactoryName', title: '装柜工厂', minWidth: 150 },
    { field: 'warehouseDeliveryDate', title: '仓库交货日', width: 130 },
    { field: 'createTime', title: '创建时间', width: 180 },
    {
      field: 'actions',
      title: '操作',
      width: 150,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'poNo',
      label: 'PO号',
      component: 'Input',
      componentProps: { placeholder: '请输入PO号' },
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: Object.entries(ORDER_STATUS_MAP).map(([value, { text }]) => ({
          label: text,
          value,
        })),
        placeholder: '请选择状态',
        allowClear: true,
      },
    },
    {
      fieldName: 'shippingNumberId',
      label: '运编号ID',
      component: 'InputNumber',
      componentProps: { placeholder: '请输入运编号ID' },
    },
  ];
}
