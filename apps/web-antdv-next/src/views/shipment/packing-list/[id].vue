<script lang="ts" setup>
import type { DescriptionItemSchema } from '#/components/description';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, Card, Spin, Table } from 'antdv-next';

import { getOrderPage, getPackingList } from '#/api/shipment';
import { useDescription } from '#/components/description';

import { LOCATION_MAP } from './data';
import PackingListForm from './modules/form.vue';

const route = useRoute();
const packingListId = Number(route.params.id);

const loading = ref(false);
const packingList = ref<any>(null);
const linkedOrders = ref<any[]>([]);

function usePackingListDetailSchema(): DescriptionItemSchema[] {
  return [
    { field: 'id', label: 'ID' },
    { field: 'styleNo', label: '款号' },
    { field: 'projectNo', label: '项目号' },
    { field: 'brand', label: '品牌' },
    { field: 'shippingCountry', label: '出运国' },
    { field: 'productNameCn', label: '中文品名' },
    { field: 'productNameEn', label: '英文品名' },
    {
      field: 'productionLocation',
      label: '生产地',
      render: (val: string) => LOCATION_MAP[val] ?? val ?? '-',
    },
    {
      field: 'isThirdParty',
      label: '是否第三方',
      render: (val: boolean) => (val ? '是' : '否'),
    },
    { field: 'supplierRef', label: '供应商参考号' },
    { field: 'sizeDesc', label: '尺码描述' },
    { field: 'remark', label: '备注' },
    { field: 'createTime', label: '创建时间' },
  ];
}

const [Descriptions] = useDescription({
  bordered: true,
  column: 3,
  schema: usePackingListDetailSchema(),
  useCard: false,
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: PackingListForm,
  destroyOnClose: true,
});

const orderColumns = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: 'Pack ID', dataIndex: 'packId', key: 'packId' },
  { title: '颜色', dataIndex: 'color', key: 'color' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty' },
  { title: '总体积(CBM)', dataIndex: 'totalVolume', key: 'totalVolume' },
  {
    title: '箱号',
    key: 'cartonRange',
    render: (_value: unknown, record: any) =>
      record.cartonNoFrom == null
        ? '-'
        : `${record.cartonNoFrom}~${record.cartonNoTo}`,
  },
  { title: '运编号', dataIndex: 'shippingNo', key: 'shippingNo' },
  {
    title: '装柜工厂',
    dataIndex: 'loadingFactoryName',
    key: 'loadingFactoryName',
  },
  { title: '状态', dataIndex: 'statusName', key: 'statusName' },
];

async function loadData() {
  loading.value = true;
  try {
    const [pl, orders] = await Promise.all([
      getPackingList(packingListId),
      getOrderPage({ pageNo: 1, pageSize: 500, packingListId }),
    ]);
    packingList.value = pl;
    linkedOrders.value = (orders as any).list ?? [];
  } finally {
    loading.value = false;
  }
}

function handleEdit() {
  if (packingList.value) formModalApi.setData(packingList.value).open();
}

onMounted(loadData);
</script>

<template>
  <Page>
    <FormModal @success="loadData" />
    <Spin :spinning="loading">
      <Card class="mb-4" size="small">
        <template #title>
          <span>装箱单详情</span>
          <span v-if="packingList?.styleNo" class="ml-2 text-gray-400 text-sm">款号：{{ packingList.styleNo }}</span>
        </template>
        <template #extra>
          <Button type="primary" size="small" @click="handleEdit">编辑</Button>
        </template>
        <Descriptions v-if="packingList" :data="packingList" size="small" />
      </Card>

      <Card title="关联订单" size="small">
        <template #extra>
          <span class="text-sm text-gray-400">共 {{ linkedOrders.length }} 条</span>
        </template>
        <Table
          :data-source="linkedOrders"
          :columns="orderColumns"
          :pagination="{ pageSize: 20 }"
          row-key="id"
          size="small"
          :scroll="{ x: 1000 }"
        />
      </Card>
    </Spin>
  </Page>
</template>
