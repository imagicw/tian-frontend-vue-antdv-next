<script lang="ts" setup>
import type { FinanceEcApi } from '#/api/finance/ec';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Descriptions, DescriptionsItem, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { manualFixInventory } from '#/api/finance/ec';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 110,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'newQuantity',
      label: '修正后剩余数量',
      component: 'InputNumber',
      componentProps: {
        class: '!w-full',
        min: 0,
        placeholder: '请输入修正后的剩余数量',
      },
      rules: 'required',
    },
    {
      fieldName: 'reason',
      label: '修正原因',
      component: 'Textarea',
      componentProps: { placeholder: '请填写修正原因', rows: 3 },
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

const inventory = computed(() => modalApi.getData<FinanceEcApi.ECInventory>());

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const values = await formApi.getValues();
    try {
      await manualFixInventory({
        batchId: inventory.value!.id,
        newQuantity: values.newQuantity,
        reason: values.reason,
      });
      await modalApi.close();
      emit('success');
      message.success('库存修正成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<FinanceEcApi.ECInventory>();
    if (data) {
      await formApi.setValues({ newQuantity: data.remainingQuantity });
    }
  },
});
</script>

<template>
  <Modal class="w-[480px]" title="库存手动修正">
    <div v-if="inventory" class="mb-4">
      <Descriptions :column="2" size="small" bordered>
        <DescriptionsItem label="GT SKU">
{{
          inventory.gtSku
        }}
</DescriptionsItem>
        <DescriptionsItem label="运编号">
{{
          inventory.shipmentNo
        }}
</DescriptionsItem>
        <DescriptionsItem label="初始数量">
{{
          inventory.initialQuantity
        }}
</DescriptionsItem>
        <DescriptionsItem label="当前剩余">
{{
          inventory.remainingQuantity
        }}
</DescriptionsItem>
      </Descriptions>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
