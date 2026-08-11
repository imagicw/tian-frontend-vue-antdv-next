<script lang="ts" setup>
import type { FinanceEcApi } from '#/api/finance/ec';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createSkuMapping, updateSkuMapping } from '#/api/finance/ec';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<FinanceEcApi.ECSkuMapping>();
const getTitle = computed(() =>
  formData.value?.id ? '编辑 SKU 映射' : '新增 SKU 映射',
);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 90,
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as FinanceEcApi.ECSkuMapping;
    try {
      await (data.id ? updateSkuMapping(data) : createSkuMapping(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    const data = modalApi.getData<FinanceEcApi.ECSkuMapping>();
    if (!data) return;
    formData.value = data;
    await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal class="w-[520px]" :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
