<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createShippingNo, updateShippingNo } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'shippingNo',
      label: '运编号',
      component: 'Input',
      componentProps: { placeholder: '请输入运编号' },
      rules: 'required',
    },
    {
      fieldName: 'relatedRefNo',
      label: '关联编号',
      component: 'Input',
      componentProps: { placeholder: '请输入关联编号（选填）' },
    },
    {
      fieldName: 'costAllocation',
      label: '费用分摊金额',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 2 },
    },
  ],
  showDefaultActions: false,
});

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as ShipmentApi.ShippingNo;
    try {
      await (data.id ? updateShippingNo(data) : createShippingNo(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ShippingNo>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑运编号' : '新增运编号'">
    <Form class="mx-4" />
  </Modal>
</template>
