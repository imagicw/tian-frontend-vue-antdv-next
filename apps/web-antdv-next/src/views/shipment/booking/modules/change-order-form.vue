<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  saveBookingChangeOrder,
  ShipmentApi as ShipmentApiNs,
} from '#/api/shipment';

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
      fieldName: 'deliveryDate',
      label: '交期',
      component: 'DatePicker',
      componentProps: { class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalQty',
      label: '总件数',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'packsPerCarton',
      label: '每箱包数',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'cartonNoFrom',
      label: '起始箱号',
      component: 'InputNumber',
      componentProps: { min: 1, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'cartonNoTo',
      label: '结束箱号',
      component: 'InputNumber',
      componentProps: { min: 1, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'hangingPackageCount',
      label: '挂装包数',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remark',
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
  changeId: number;
  order: ShipmentApi.ShipmentOrder;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const data = modalApi.getData<OpenData>();
      const values = await formApi.getValues();
      const { reason, ...order } = values as any;
      await saveBookingChangeOrder({
        changeId: data.changeId,
        orderId: data.order.id!,
        action: ShipmentApiNs.CHANGE_ACTION_UPDATE,
        order,
        reason,
      });
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
    if (data?.order) await formApi.setValues(data.order);
  },
});
</script>

<template>
  <Modal title="编辑本人负责的 PO（变更草稿）" class="w-[720px]">
    <Form class="mx-4" />
  </Modal>
</template>
