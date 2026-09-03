<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createDocumentHandlerConfig,
  updateDocumentHandlerConfig,
} from '#/api/shipment';
import { getSimpleUserList } from '#/api/system/user';

const emit = defineEmits<{ success: [] }>();
const isEdit = ref(false);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 110,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '例如 PRIMARK' },
      rules: 'required',
    },
    {
      fieldName: 'destinationCountry',
      label: '目的国',
      component: 'Input',
      componentProps: { placeholder: '留空表示客户默认配置' },
    },
    {
      fieldName: 'docUserId',
      label: '单证责任人',
      component: 'Select',
      componentProps: { allowClear: false, options: [], showSearch: true },
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

async function loadUserOptions() {
  const users = await getSimpleUserList();
  await formApi.updateSchema([
    {
      fieldName: 'docUserId',
      componentProps: {
        allowClear: false,
        options: users.map((user) => ({
          label: `${user.nickname} (${user.username})`,
          value: user.id,
        })),
        showSearch: true,
      },
    },
  ]);
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const data =
        (await formApi.getValues()) as ShipmentApi.DocumentHandlerConfig;
      await (data.id
        ? updateDocumentHandlerConfig(data)
        : createDocumentHandlerConfig(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData() as
      | ShipmentApi.DocumentHandlerConfig
      | undefined;
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    await loadUserOptions();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑单证责任人配置' : '新增单证责任人配置'">
    <Form class="mx-4" />
  </Modal>
</template>
