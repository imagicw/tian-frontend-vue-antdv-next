<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createOrder, updateOrder } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 130 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'poNo',
      label: 'PO号',
      component: 'Input',
      componentProps: { placeholder: '请输入PO号' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'packId',
      label: 'Pack ID',
      component: 'Input',
      componentProps: { placeholder: '请输入Pack ID' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'destinationCountry',
      label: '目的国',
      component: 'Input',
      componentProps: { placeholder: '请输入目的国' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'color',
      label: '颜色',
      component: 'Input',
      componentProps: { placeholder: '请输入颜色' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'deliveryDate',
      label: '交期',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'warehouseDeliveryDate',
      label: '仓库交货日',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalQty',
      label: '总数量',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalVolume',
      label: '总体积(CBM)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 4, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'grossWeight',
      label: '单箱毛重(kg)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'netWeight',
      label: '单箱净重(kg)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'shippingMode',
      label: '运输方式',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '散货', value: 1 },
          { label: '整柜纸箱', value: 2 },
          { label: '整柜挂装', value: 3 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'hangingPackageCount',
      label: '挂装包数',
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0, class: 'w-full' },
      rules: 'required',
      dependencies: {
        triggerFields: ['shippingMode'],
        show: (values) => values.shippingMode === 3,
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'productionLocation',
      label: '生产地',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '国内', value: 'DOMESTIC' },
          { label: '海外', value: 'OVERSEAS' },
        ],
        optionType: 'button',
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'isAirFreight',
      label: '空运',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '是', value: true },
          { label: '否', value: false },
        ],
        optionType: 'button',
      },
      defaultValue: false,
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'unitPrice',
      label: '单价',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 4, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'currency',
      label: '货币',
      component: 'Select',
      componentProps: {
        options: [
          { label: 'CNY', value: 'CNY' },
          { label: 'USD', value: 'USD' },
          { label: 'GBP', value: 'GBP' },
          { label: 'EUR', value: 'EUR' },
        ],
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'TextArea',
      componentProps: { rows: 3 },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as ShipmentApi.ShipmentOrder;
    try {
      await (data.id ? updateOrder(data) : createOrder(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ShipmentOrder>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑订单' : '新建订单'" class="w-[860px]">
    <Form class="mx-4" />
  </Modal>
</template>
