<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { updateOrderRemark } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const order = ref<ShipmentApi.ShipmentOrder>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 80 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'remark',
      label: '备注',
      component: 'TextArea',
      componentProps: { rows: 4, placeholder: '请填写备注' },
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!order.value) return;
    modalApi.lock();
    const { remark } = await formApi.getValues();
    try {
      await updateOrderRemark({ id: order.value.id, remark });
      await modalApi.close();
      emit('success');
      message.success('备注已更新');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    order.value = modalApi.getData<ShipmentApi.ShipmentOrder>();
    await formApi.resetForm();
    await formApi.setValues({ remark: order.value?.remark });
  },
});
</script>

<template>
  <Modal title="修改备注" class="w-[480px]">
    <div class="mx-4 mb-2 text-sm text-gray-500">
      备注属于非履约字段，即使 PO 已最终数据确认也可直接修改，不会触发撤回确认。
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
