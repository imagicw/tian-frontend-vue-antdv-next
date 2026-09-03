<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  processOrderFinalConfirmWithdrawRequest,
  submitOrderFinalConfirmWithdrawRequest,
  withdrawOrderFinalConfirm,
} from '#/api/shipment';

type WithdrawMode = 'direct' | 'process' | 'request';

interface WithdrawModalData {
  mode: WithdrawMode;
  order: ShipmentApi.ShipmentOrder;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<WithdrawMode>('direct');
const order = ref<ShipmentApi.ShipmentOrder>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 100 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'reason',
      label: '原因',
      component: 'TextArea',
      componentProps: { rows: 3, placeholder: '请填写原因' },
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

const title = computed(() => {
  if (mode.value === 'request') return '申请撤回最终数据确认';
  if (mode.value === 'process') return '处理最终数据确认撤回申请';
  return '撤回最终数据确认';
});

const description = computed(() => {
  if (!order.value) return '';
  if (mode.value === 'request') {
    return `将为 PO「${order.value.poNo}」提交撤回最终数据确认的申请，由单证人员或获授权人员处理。`;
  }
  if (mode.value === 'process') {
    return `处理 PO「${order.value.poNo}」的撤回申请（申请人：${order.value.pendingWithdrawRequestApplicantName ?? '-'}），确认后将立即撤回最终数据确认，并自动创建待发布订舱变更、阻止整票出运。`;
  }
  return `撤回 PO「${order.value.poNo}」的最终数据确认，将自动创建（或复用）待发布订舱变更并阻止整票出运，责任业务员须修改后重新发布并再次确认。`;
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!order.value) return;
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const { reason } = await formApi.getValues();
    try {
      if (mode.value === 'request') {
        await submitOrderFinalConfirmWithdrawRequest({
          orderId: order.value.id,
          reason,
        });
        message.success('申请已提交');
      } else if (mode.value === 'process') {
        await processOrderFinalConfirmWithdrawRequest({
          requestId: order.value.pendingWithdrawRequestId!,
          reason,
        });
        message.success('撤回成功');
      } else {
        await withdrawOrderFinalConfirm({ orderId: order.value.id, reason });
        message.success('撤回成功');
      }
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData() as undefined | WithdrawModalData;
    mode.value = data?.mode ?? 'direct';
    order.value = data?.order;
    await formApi.resetForm();
    if (mode.value === 'process' && order.value?.pendingWithdrawRequestReason) {
      await formApi.setValues({
        reason: order.value.pendingWithdrawRequestReason,
      });
    }
  },
});
</script>

<template>
  <Modal :title="title" class="w-[520px]">
    <div class="mx-4 mb-2 text-sm text-gray-500">{{ description }}</div>
    <Form class="mx-4" />
  </Modal>
</template>
