<script lang="ts" setup>
import type { DescriptionItemSchema } from '#/components/description';

import { h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Divider, Spin, Table, Tag } from 'antdv-next';

import { getBookingDetail } from '#/api/shipment';
import { useDescription } from '#/components/description';

import { BOOKING_STATUS_MAP, BOOKING_TYPE_MAP } from '../data';

const bookingDetail = ref<any>(null);
const loading = ref(false);

function useBookingDetailSchema(): DescriptionItemSchema[] {
  return [
    { field: 'bookingNo', label: '订舱号' },
    {
      field: 'bookingType',
      label: '订舱类型',
      render: (val: number) => BOOKING_TYPE_MAP[val] ?? '-',
    },
    {
      field: 'status',
      label: '状态',
      render: (val: string) =>
        h(
          Tag,
          { color: BOOKING_STATUS_MAP[val]?.color ?? 'default' },
          () => BOOKING_STATUS_MAP[val]?.text ?? val,
        ),
    },
    { field: 'clientCode', label: '客户代码' },
    { field: 'clientName', label: '客户名称' },
    { field: 'freightForwarder', label: '货代' },
    { field: 'productionCountry', label: '生产国家' },
    { field: 'applicant', label: '申请人' },
    { field: 'booker', label: '订舱人' },
    { field: 'blNo', label: '提单号' },
    { field: 'ensDate', label: 'ENS日期' },
    { field: 'vesselDate', label: '船期' },
    { field: 'closingDate', label: '截关日期' },
    { field: 'rejectReason', label: '驳回原因' },
    { field: 'cancelReason', label: '取消原因' },
    { field: 'remarks', label: '备注' },
    { field: 'createTime', label: '创建时间' },
  ];
}

const [Descriptions] = useDescription({
  bordered: true,
  column: 3,
  schema: useBookingDetailSchema(),
  useCard: false,
});

const orderColumns = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: 'Pack ID', dataIndex: 'packId', key: 'packId' },
  { title: '颜色', dataIndex: 'color', key: 'color' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  { title: '总体积(CBM)', dataIndex: 'totalVolume', key: 'totalVolume' },
  { title: '运编号', dataIndex: 'shippingNo', key: 'shippingNo' },
];

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      bookingDetail.value = null;
      return;
    }
    const data = modalApi.getData<{ id: number }>();
    if (!data?.id) return;
    loading.value = true;
    try {
      bookingDetail.value = await getBookingDetail(data.id);
    } finally {
      loading.value = false;
    }
  },
});
</script>

<template>
  <Modal title="订舱详情" :footer="false" class="w-[900px]">
    <Spin :spinning="loading">
      <Descriptions
        v-if="bookingDetail"
        :data="bookingDetail"
        size="small"
        class="mb-4"
      />
      <Tag v-if="bookingDetail?.pendingChange" color="processing" class="mb-4">
        有待发布变更 · 发起人：{{
          bookingDetail.pendingChange.initiatorName ||
          bookingDetail.pendingChange.initiatorId
        }}
      </Tag>
      <template v-if="bookingDetail?.orders?.length">
        <Divider title-placement="start">关联订单</Divider>
        <Table
          :data-source="bookingDetail.orders"
          :columns="orderColumns"
          :pagination="false"
          size="small"
          row-key="id"
        />
      </template>
    </Spin>
  </Modal>
</template>
