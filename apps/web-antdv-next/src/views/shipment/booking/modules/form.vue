<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createBooking,
  getNotBookedOrderPage,
  updateBooking,
} from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const orderOptions = ref<{ label: string; value: number }[]>([]);

async function loadOrderOptions(clientCode: string) {
  if (!clientCode) return;
  const res = await getNotBookedOrderPage({
    pageNo: 1,
    pageSize: 200,
    clientCode,
  });
  orderOptions.value = ((res as any).list ?? []).map(
    (item: ShipmentApi.ShipmentOrder) => ({
      label: `${item.poNo ?? '-'} / ${item.packId ?? '-'} / ${item.shippingNo ?? '-'}`,
      value: item.id,
    }),
  );
}

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
      fieldName: 'bookingNo',
      label: '订舱号',
      component: 'Input',
      componentProps: { placeholder: '系统自动生成，可留空' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'bookingType',
      label: '订舱类型',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '拼柜', value: 1 },
          { label: '散货', value: 2 },
        ],
        optionType: 'button',
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
      rules: 'required',
      formItemClass: 'col-span-2',
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
      fieldName: 'productionCountry',
      label: '生产国家',
      component: 'Input',
      componentProps: { placeholder: '请输入生产国家' },
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
      fieldName: 'orderIds',
      label: '关联订单',
      component: 'Select',
      componentProps: {
        mode: 'multiple',
        options: orderOptions,
        optionFilterProp: 'label',
        showSearch: true,
        placeholder: '请选择关联订单（需先填写客户代码）',
      },
      rules: 'required',
      formItemClass: 'col-span-4',
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

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data =
      (await formApi.getValues()) as ShipmentApi.ShipmentBookingSaveParams & {
        id?: number;
      };
    try {
      await (data.id
        ? updateBooking({ ...data, id: data.id })
        : createBooking(data as ShipmentApi.ShipmentBookingSaveParams));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<
      ShipmentApi.ShipmentBooking & { orderIds?: number[] }
    >();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data) {
      const orderIds = data.orderIds ?? data.orders?.map((o) => o.id) ?? [];
      await formApi.setValues({ ...data, orderIds });
      if (data.clientCode) await loadOrderOptions(data.clientCode);
    }
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑订舱' : '新建订舱'" class="w-[860px]">
    <Form class="mx-4" />
  </Modal>
</template>
