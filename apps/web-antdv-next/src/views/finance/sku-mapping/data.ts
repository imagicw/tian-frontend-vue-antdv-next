import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

export const PLATFORM_OPTIONS = [
  { label: '亚马逊US', value: 'AMAZON_US' },
  { label: '亚马逊CA', value: 'AMAZON_CA' },
  { label: '沃尔玛US', value: 'WALMART_US' },
  { label: '沃尔玛CA', value: 'WALMART_CA' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'platform',
      label: '平台',
      component: 'Select',
      componentProps: { options: PLATFORM_OPTIONS, placeholder: '请选择平台' },
      rules: 'required',
    },
    {
      fieldName: 'productName',
      label: '品名',
      component: 'Input',
      componentProps: { placeholder: '请输入品名' },
      rules: 'required',
    },
    {
      fieldName: 'originalSku',
      label: '原始 SKU',
      component: 'Input',
      componentProps: { placeholder: '平台原始 SKU' },
      rules: 'required',
    },
    {
      fieldName: 'gtSku',
      label: 'GT SKU',
      component: 'Input',
      componentProps: { placeholder: '公司内部 SKU' },
      rules: 'required',
    },
  ];
}

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
      fieldName: 'originalSku',
      label: '原始 SKU',
      component: 'Input',
      componentProps: { placeholder: '请输入原始 SKU', allowClear: true },
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
      minWidth: 120,
      slots: { default: 'platform' },
    },
    {
      field: 'originalSku',
      title: '原始 SKU',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    { field: 'gtSku', title: 'GT SKU', minWidth: 140, showOverflow: 'tooltip' },
    {
      field: 'productName',
      title: '品名',
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    { field: 'creator', title: '创建人', width: 100 },
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
      formatter: 'formatDateTime',
    },
    { field: 'updater', title: '更新人', width: 100 },
    {
      field: 'updateTime',
      title: '更新时间',
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
