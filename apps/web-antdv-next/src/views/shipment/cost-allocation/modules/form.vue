<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Divider, message, Table } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { calculateCostAllocation, saveCostAllocation } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const previewDetails = ref<ShipmentApi.ShipmentCostAllocationDetail[]>([]);
const previewLoading = ref(false);

const previewColumns = [
  { title: '运编号', dataIndex: 'shippingNo', key: 'shippingNo' },
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: '体积(CBM)', dataIndex: 'volume', key: 'volume' },
  {
    title: '体积占比',
    dataIndex: 'volumeRatio',
    key: 'volumeRatio',
    render: (value: number) => (value ? `${(value * 100).toFixed(2)}%` : '-'),
  },
  { title: '分摊金额', dataIndex: 'allocatedAmount', key: 'allocatedAmount' },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 130 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'docNo',
      label: '单据号',
      component: 'Input',
      componentProps: { placeholder: '请输入单据号（如订舱号）' },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'totalAmount',
      label: '总金额',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 2,
        class: 'w-full',
        placeholder: '请输入总金额',
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'currency',
      label: '货币',
      component: 'Select',
      componentProps: {
        options: [
          { label: 'USD', value: 'USD' },
          { label: 'CNY', value: 'CNY' },
          { label: 'EUR', value: 'EUR' },
          { label: 'GBP', value: 'GBP' },
        ],
      },
      defaultValue: 'USD',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'customsFeePerNo',
      label: '每运编号关税',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 2,
        class: 'w-full',
        placeholder: '选填',
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'shippingNosText',
      label: '运编号列表',
      component: 'TextArea',
      componentProps: { rows: 5, placeholder: '每行或逗号分隔输入运编号' },
      rules: 'required',
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

function parseShippingNos(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,，;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

async function handlePreview() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = (await formApi.getValues()) as any;
  const shippingNos = parseShippingNos(values.shippingNosText ?? '');
  if (shippingNos.length === 0) {
    message.warning('请输入至少一个运编号');
    return;
  }
  previewLoading.value = true;
  try {
    const res = await calculateCostAllocation({
      totalAmount: values.totalAmount,
      customsFeePerNo: values.customsFeePerNo,
      shippingNos,
    });
    previewDetails.value = Array.isArray(res) ? res : ((res as any).data ?? []);
  } finally {
    previewLoading.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const values = (await formApi.getValues()) as any;
    const shippingNos = parseShippingNos(values.shippingNosText ?? '');
    if (shippingNos.length === 0) {
      message.warning('请输入至少一个运编号');
      modalApi.unlock();
      return;
    }
    try {
      await saveCostAllocation({
        id: values.id || undefined,
        docNo: values.docNo,
        totalAmount: values.totalAmount,
        customsFeePerNo: values.customsFeePerNo,
        currency: values.currency,
        shippingNos,
      });
      await modalApi.close();
      emit('success');
      message.success('保存成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      previewDetails.value = [];
      return;
    }
    const data = modalApi.getData<ShipmentApi.ShipmentCostAllocation>();
    await formApi.resetForm();
    if (data) {
      const shippingNosText = (data.shippingNos ?? []).join('\n');
      await formApi.setValues({ ...data, shippingNosText });
    }
  },
});
</script>

<template>
  <Modal title="费用分摊" class="w-[800px]">
    <Form class="mx-4" />
    <div class="mx-4 mb-2">
      <Button :loading="previewLoading" @click="handlePreview">
        预览分摊结果
      </Button>
    </div>
    <template v-if="previewDetails.length > 0">
      <Divider title-placement="start">分摊明细预览</Divider>
      <Table
        :data-source="previewDetails"
        :columns="previewColumns"
        :pagination="false"
        size="small"
        row-key="id"
        class="mx-4"
      />
    </template>
  </Modal>
</template>
