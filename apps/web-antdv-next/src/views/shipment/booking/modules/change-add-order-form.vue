<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  getNotBookedOrderPage,
  saveBookingChangeOrder,
  ShipmentApi as ShipmentApiNs,
} from '#/api/shipment';

import { filterAddableOrders } from '../change-logic';

const emit = defineEmits<{ success: [] }>();
const userStore = useUserStore();

interface OpenData {
  changeId: number;
  clientCode: string;
}

const orderOptions = ref<{ label: string; value: number }[]>([]);

async function loadOrderOptions(clientCode: string) {
  if (!clientCode) {
    orderOptions.value = [];
    return;
  }
  const res = await getNotBookedOrderPage({
    pageNo: 1,
    pageSize: 200,
    clientCode,
  });
  const candidates = filterAddableOrders(
    userStore.userInfo?.userId,
    ((res as any).list ?? []) as ShipmentApi.ShipmentOrder[],
  );
  orderOptions.value = candidates.map((item) => ({
    label: `${item.poNo ?? '-'} / ${item.packId ?? '-'} / ${item.deliveryDate ?? '-'}`,
    value: item.id,
  }));
}

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 110 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'orderId',
      label: '替代 PO',
      component: 'Select',
      componentProps: {
        options: orderOptions,
        optionFilterProp: 'label',
        showSearch: true,
        placeholder: '请选择本人负责、同客户已发布未占用的 PO',
      },
      rules: 'required',
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'reason',
      label: '更换原因',
      component: 'Textarea',
      componentProps: { rows: 2, placeholder: '请输入本次更换原因' },
      rules: 'required',
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
      const data = modalApi.getData<OpenData>();
      const values = (await formApi.getValues()) as {
        orderId: number;
        reason: string;
      };
      await saveBookingChangeOrder({
        changeId: data.changeId,
        orderId: values.orderId,
        action: ShipmentApiNs.CHANGE_ACTION_ADD,
        reason: values.reason,
      });
      await modalApi.close();
      emit('success');
      message.success('已计入待发布变更，发布后生效');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<OpenData>();
    await formApi.resetForm();
    orderOptions.value = [];
    if (data?.clientCode) await loadOrderOptions(data.clientCode);
  },
});
</script>

<template>
  <Modal title="添加替代 PO（PO 更换）" class="w-[640px]">
    <Form class="mx-4" />
  </Modal>
</template>
