<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { handoverOrderResponsibility } from '#/api/shipment';
import { getSimpleUserList } from '#/api/system/user';

const emit = defineEmits<{ success: [] }>();

const orders = ref<ShipmentApi.ShipmentOrder[]>([]);

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 100 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'toUserId',
      label: '交接给',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleUserList,
        labelField: 'nickname',
        valueField: 'id',
        placeholder: '请选择交接对象',
      },
      rules: 'required',
    },
    {
      fieldName: 'reason',
      label: '交接原因',
      component: 'TextArea',
      componentProps: { rows: 3, placeholder: '请填写交接原因' },
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const { toUserId, reason } = await formApi.getValues();
    try {
      await handoverOrderResponsibility({
        orderIds: orders.value.map((row) => row.id),
        toUserId,
        reason,
      });
      await modalApi.close();
      emit('success');
      message.success('交接成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    orders.value =
      (modalApi.getData() as ShipmentApi.ShipmentOrder[] | undefined) ?? [];
    await formApi.resetForm();
  },
});
</script>

<template>
  <Modal title="责任人数据交接" class="w-[520px]">
    <div class="mx-4 mb-2 text-sm text-gray-500">
      将 {{ orders.length }} 个 PO
      的责任业务员交接给指定对象；不会修改履约数据、订舱归属或已存在的最终数据确认。
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
