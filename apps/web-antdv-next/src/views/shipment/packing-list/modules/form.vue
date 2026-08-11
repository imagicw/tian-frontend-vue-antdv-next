<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createPackingList, updatePackingList } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 110 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'styleNo',
      label: '款号',
      component: 'Input',
      componentProps: { placeholder: '请输入款号' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'projectNo',
      label: '项目号',
      component: 'Input',
      componentProps: { placeholder: '请输入项目号' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'Input',
      componentProps: { placeholder: '请输入品牌' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'productNameCn',
      label: '中文品名',
      component: 'Input',
      componentProps: { placeholder: '请输入中文品名' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'productNameEn',
      label: '英文品名',
      component: 'Input',
      componentProps: { placeholder: '请输入英文品名' },
      rules: 'required',
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
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'shippingCountry',
      label: '出运国',
      component: 'Input',
      componentProps: { placeholder: '请输入出运国' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'sizeDesc',
      label: '尺码描述',
      component: 'Input',
      componentProps: { placeholder: '如：S/M/L/XL' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'isThirdParty',
      label: '是否第三方',
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
      fieldName: 'supplierRef',
      label: '供应商参考号',
      component: 'Input',
      componentProps: { placeholder: '第三方时填写' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: { rows: 3, placeholder: '备注信息' },
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
    const data = (await formApi.getValues()) as ShipmentApi.ShipmentPackingList;
    try {
      await (data.id ? updatePackingList(data) : createPackingList(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ShipmentPackingList>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑装箱单' : '新建装箱单'" class="w-[720px]">
    <Form class="mx-4" />
  </Modal>
</template>
