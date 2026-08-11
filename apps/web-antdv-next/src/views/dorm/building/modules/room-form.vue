<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createRoom, updateRoom } from '#/api/dorm';

const emit = defineEmits<{ success: [] }>();

const ROOM_TYPE_OPTIONS = [
  { label: '单人间', value: 1 },
  { label: '多人间', value: 2 },
];
const STATUS_OPTIONS = [
  { label: '正常可用', value: 0 },
  { label: '锁定停用', value: 1 },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 112 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'storeyId',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'roomAlias',
      label: '房间名称',
      component: 'Input',
      componentProps: { maxlength: 50, placeholder: '例如：101、行政套间' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'roomCode',
      label: '房间编号',
      component: 'Input',
      componentProps: { maxlength: 30, placeholder: '用于内部识别的编号' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'roomType',
      label: '房间类型',
      component: 'Select',
      componentProps: { options: ROOM_TYPE_OPTIONS },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'capacity',
      label: '可容纳人数',
      component: 'InputNumber',
      componentProps: { min: 1, max: 10, class: 'w-full', addonAfter: '人' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'settleAmount',
      label: '结算金额',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 2,
        class: 'w-full',
        addonAfter: '/ 人 / 晚',
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'settleCurrencyCode',
      label: '结算币种',
      component: 'Input',
      componentProps: { placeholder: '如：CNY' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'status',
      label: '可用状态',
      component: 'RadioGroup',
      componentProps: { options: STATUS_OPTIONS, optionType: 'button' },
      defaultValue: 0,
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as DormApi.DormRoom;
    try {
      await (data.id ? updateRoom(data) : createRoom(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data =
      modalApi.getData<Partial<DormApi.DormRoom & { storeyId: number }>>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑房间' : '新增房间'" class="w-[720px]">
    <div class="border-border bg-muted mx-4 mb-5 rounded-lg border px-4 py-3">
      <div class="text-foreground text-sm font-medium">房间配置</div>
      <div class="text-muted-foreground mt-1 text-xs leading-5">
        “可用状态”用于控制房间是否可预订；入住人数由住宿订单自动计算。
      </div>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
