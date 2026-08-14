<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { saveBookingChangeHeader } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 130 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'reason',
      label: '变更原因',
      component: 'Textarea',
      componentProps: { rows: 2, placeholder: '请输入本次改动原因' },
      rules: 'required',
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'freightForwarder',
      label: '货代',
      component: 'Input',
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'productionCountry',
      label: '生产国',
      component: 'Input',
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'blNo',
      label: '提单号',
      component: 'Input',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'ensDate',
      label: 'ENS日期',
      component: 'DatePicker',
      componentProps: { class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'vesselDate',
      label: '船期',
      component: 'DatePicker',
      componentProps: { class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'closingDate',
      label: '截关日期',
      component: 'DatePicker',
      componentProps: { class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'ccUserIds',
      label: '抄送人IDs',
      component: 'Input',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remarks',
      label: '备注',
      component: 'Textarea',
      componentProps: { rows: 2 },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

interface OpenData {
  booking: ShipmentApi.ShipmentBooking;
  changeId: number;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const data = modalApi.getData<OpenData>();
      const values = await formApi.getValues();
      await saveBookingChangeHeader({
        changeId: data.changeId,
        ...values,
      } as any);
      await modalApi.close();
      emit('success');
      message.success('已保存至待发布变更');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<OpenData>();
    await formApi.resetForm();
    if (data?.booking) await formApi.setValues(data.booking);
  },
});
</script>

<template>
  <Modal title="编辑订舱头（变更草稿）" class="w-[720px]">
    <Form class="mx-4" />
  </Modal>
</template>
