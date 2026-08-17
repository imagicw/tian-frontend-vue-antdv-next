<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Input, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { saveBookingChangeOrder } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

interface OrderFormData {
  changeId: number;
  order: ShipmentApi.ShipmentOrder;
}

const reason = ref('');

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 130 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'poNo',
      label: 'PO号',
      component: 'Input',
      componentProps: { disabled: true },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'packId',
      label: 'Pack ID',
      component: 'Input',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'destinationCountry',
      label: '目的国',
      component: 'Input',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'color',
      label: '颜色',
      component: 'Input',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'deliveryDate',
      label: '交期',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'warehouseDeliveryDate',
      label: '仓库交货日',
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalQty',
      label: '总数量',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalVolume',
      label: '总体积(CBM)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 4, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'grossWeight',
      label: '单箱毛重(kg)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'netWeight',
      label: '单箱净重(kg)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'shortShipmentQty',
      label: '短装数量',
      component: 'InputNumber',
      componentProps: { min: 0, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'unitPrice',
      label: '单价',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 4, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'TextArea',
      componentProps: { rows: 2 },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

let changeId = 0;
let orderId = 0;

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    if (!reason.value.trim()) {
      message.warning('请填写本次编辑原因');
      return;
    }
    modalApi.lock();
    // 后端 change/order/save 按非空字段合并到当前订单上（ignoreNullValue），
    // 因此这里必须提交表单的完整取值（包含未改动字段），而不是只提交本次改动的字段，
    // 否则未在此表单出现的字段虽然安全（本就不会被清空），但表单内被用户清空的字段
    // 也会因为值变成 null/undefined 而被后端忽略、不会真正清空——这是已知的后端限制，
    // 不在本次改动范围内解决。
    const values = (await formApi.getValues()) as ShipmentApi.ShipmentOrder;
    try {
      await saveBookingChangeOrder({
        changeId,
        orderId,
        action: 1,
        order: values,
        reason: reason.value.trim(),
      });
      await modalApi.close();
      emit('success');
      message.success('已保存到变更草稿');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<OrderFormData>();
    changeId = data?.changeId ?? 0;
    orderId = data?.order.id ?? 0;
    reason.value = '';
    await formApi.resetForm();
    if (data?.order) await formApi.setValues(data.order);
  },
});
</script>

<template>
  <Modal title="编辑 PO（变更草稿）" class="w-[860px]">
    <Form class="mx-4" />
    <div class="mx-4 mt-2">
      <div class="mb-1 text-sm font-medium">编辑原因</div>
      <Input.TextArea
        v-model:value="reason"
        :rows="2"
        :maxlength="255"
        placeholder="请填写本次编辑原因"
        show-count
      />
    </div>
  </Modal>
</template>
