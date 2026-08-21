<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { updateBookingHeader } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();
const booking = ref<ShipmentApi.ShipmentBooking>();

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
      fieldName: 'freightForwarder',
      label: '货代',
      component: 'Input',
      componentProps: { placeholder: '请输入货代' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'blNo',
      label: '提单号',
      component: 'Input',
      componentProps: { placeholder: '请输入提单号' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'ensDate',
      label: 'ENS日期',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'vesselDate',
      label: '船期',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'closingDate',
      label: '截关日期',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'ccUserIds',
      label: '邮件抄送人',
      component: 'Input',
      componentProps: { placeholder: '多个用户 ID 用英文逗号分隔' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remarks',
      label: '备注',
      component: 'TextArea',
      componentProps: { rows: 3 },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      await updateBookingHeader(
        (await formApi.getValues()) as ShipmentApi.ShipmentBookingHeaderUpdateParams,
      );
      await modalApi.close();
      emit('success');
      message.success('单证资料已更新，PO 最终确认保持不变');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    booking.value = modalApi.getData<ShipmentApi.ShipmentBooking>();
    await formApi.resetForm();
    if (booking.value) await formApi.setValues(booking.value);
  },
});
</script>

<template>
  <Modal title="维护单证资料" class="w-[760px]">
    <p class="mx-4 mb-3 text-sm text-muted-foreground">
      此操作只维护订舱抬头资料，不改变 PO 最终确认、关联订单或分柜方案。
    </p>
    <Form class="mx-4" />
  </Modal>
</template>
