<script lang="ts" setup>
import type { TableColumnsType } from 'antdv-next';

import type { ShipmentApi } from '#/api/shipment';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  FormItem,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  appendContainerCargos,
  createContainer,
  deleteContainer,
  getBookingDetail,
  getContainersByBooking,
  getUnallocatedCargoPool,
} from '#/api/shipment';

import { BOOKING_STATUS_MAP, BOOKING_TYPE_MAP } from '../booking/data';

const CONTAINER_TYPES = ['40GP', '40HQ', '20GP'];

const route = useRoute();
const bookingId = computed(() => Number(route.query.bookingId));

const loading = ref(false);
const booking = ref<null | ShipmentApi.ShipmentBooking>(null);
const containers = ref<ShipmentApi.ShipmentContainer[]>([]);
const unallocatedPool = ref<ShipmentApi.ShipmentPlanOrder[]>([]);
const allocationVisible = ref(false);
const allocationSubmitting = ref(false);
const allocationForm = ref({
  cartonNoFrom: undefined as number | undefined,
  cartonNoTo: undefined as number | undefined,
  containerType: CONTAINER_TYPES[0]!,
  orderId: undefined as number | undefined,
  targetContainerId: undefined as number | undefined,
});

const cartonOrderOptions = computed(() =>
  (booking.value?.orders ?? [])
    .filter(
      (order) =>
        order.id !== null &&
        order.id !== undefined &&
        order.cartonNoFrom !== null &&
        order.cartonNoFrom !== undefined &&
        order.cartonNoTo !== null &&
        order.cartonNoTo !== undefined,
    )
    .map((order) => ({
      label: `${order.poNo ?? order.id}（箱号 ${order.cartonNoFrom} ~ ${order.cartonNoTo}）`,
      value: order.id,
    })),
);
const containerTypeOptions = CONTAINER_TYPES.map((containerType) => ({
  label: containerType,
  value: containerType,
}));
const targetContainerOptions = computed(() => [
  { label: '新建实际柜', value: 0 },
  ...containers.value.map((container) => ({
    label: `第 ${container.containerSeq ?? container.id} 柜（${container.containerType}）`,
    value: container.id,
  })),
]);

async function loadData() {
  if (!bookingId.value) return;
  loading.value = true;
  try {
    const [bookingDetail, containerList, pool] = await Promise.all([
      getBookingDetail(bookingId.value),
      getContainersByBooking(bookingId.value),
      getUnallocatedCargoPool(bookingId.value),
    ]);
    booking.value = bookingDetail;
    containers.value = Array.isArray(containerList)
      ? containerList
      : ((containerList as any).data ?? []);
    unallocatedPool.value = Array.isArray(pool)
      ? pool
      : ((pool as any).data ?? []);
  } finally {
    loading.value = false;
  }
}

function handleAddContainer() {
  allocationForm.value = {
    cartonNoFrom: undefined,
    cartonNoTo: undefined,
    containerType: CONTAINER_TYPES[0]!,
    orderId: undefined,
    targetContainerId: undefined,
  };
  allocationVisible.value = true;
}

async function handleAllocateCartons() {
  const {
    cartonNoFrom,
    cartonNoTo,
    containerType,
    orderId,
    targetContainerId,
  } = allocationForm.value;
  if (
    !orderId ||
    cartonNoFrom === null ||
    cartonNoFrom === undefined ||
    cartonNoTo === null ||
    cartonNoTo === undefined ||
    cartonNoFrom > cartonNoTo
  ) {
    message.warning('请选择 PO，并填写有效且连续的起止箱号');
    return;
  }
  allocationSubmitting.value = true;
  try {
    const cargo = { cartonNoFrom, cartonNoTo, orderId };
    await (targetContainerId
      ? appendContainerCargos({
          containerId: targetContainerId,
          cargos: [cargo],
        })
      : createContainer({
          bookingId: bookingId.value,
          containerType,
          cargos: [cargo],
        }));
    message.success('纸箱范围已分配');
    allocationVisible.value = false;
    await loadData();
  } finally {
    allocationSubmitting.value = false;
  }
}

async function handleDeleteContainer(id: number) {
  await deleteContainer(id);
  message.success('删除成功');
  await loadData();
}

const containerColumns: TableColumnsType<ShipmentApi.ShipmentContainer> = [
  { title: '箱序', dataIndex: 'containerSeq', key: 'containerSeq', width: 60 },
  {
    title: '箱型',
    dataIndex: 'containerType',
    key: 'containerType',
    width: 80,
  },
  { title: '铅封号', dataIndex: 'sealNo', key: 'sealNo', width: 120 },
  {
    title: '总体积(CBM)',
    dataIndex: 'totalVolume',
    key: 'totalVolume',
    width: 120,
  },
  {
    title: '总箱数',
    dataIndex: 'totalCartons',
    key: 'totalCartons',
    width: 90,
  },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty', width: 90 },
  {
    title: '体积利用率',
    dataIndex: 'volumeUtilization',
    key: 'volumeUtilization',
    width: 110,
    render: (value: number) =>
      value === null || value === undefined
        ? '-'
        : `${(value * 100).toFixed(1)}%`,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (_value, record) =>
      h(
        Popconfirm,
        {
          title: '确定删除此集装箱？',
          onConfirm: () => handleDeleteContainer(record.id),
        },
        { default: () => h('a', { style: { color: 'red' } }, '删除') },
      ),
  },
];

const cargoColumns: TableColumnsType<ShipmentApi.ShipmentPlanOrder> = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: '款号', dataIndex: 'styleNo', key: 'styleNo' },
  { title: '颜色', dataIndex: 'color', key: 'color' },
  { title: '数量', dataIndex: 'qty', key: 'qty' },
  { title: '未分配数量', dataIndex: 'unallocatedQty', key: 'unallocatedQty' },
  { title: '体积', dataIndex: 'volume', key: 'volume' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  {
    title: '装柜工厂',
    dataIndex: 'loadingFactoryName',
    key: 'loadingFactoryName',
  },
];

const loadedCargoColumns: TableColumnsType<ShipmentApi.ShipmentContainerCargo> =
  [
    { dataIndex: 'poNo', key: 'poNo', title: 'PO号' },
    {
      render: (_value, record) =>
        `${record.cartonNoFrom ?? '-'} ~ ${record.cartonNoTo ?? '-'}`,
      key: 'cartonRange',
      title: '箱号范围',
    },
    { dataIndex: 'loadedCartons', key: 'loadedCartons', title: '已装箱数' },
    { dataIndex: 'loadedQty', key: 'loadedQty', title: '已装数量' },
    { dataIndex: 'loadedVolume', key: 'loadedVolume', title: '已装体积' },
  ];

onMounted(loadData);
</script>

<template>
  <Page>
    <Spin :spinning="loading">
      <div v-if="!bookingId" class="p-8 text-center text-gray-400">
        请通过订舱管理页面进入分柜工作台（需要 bookingId 参数）
      </div>
      <template v-else>
        <Card v-if="booking" class="mb-4" size="small">
          <div class="flex flex-wrap gap-4 text-sm">
            <span><b>订舱号：</b>{{ booking.bookingNo ?? '-' }}</span>
            <span><b>类型：</b>{{ BOOKING_TYPE_MAP[booking.bookingType] ?? '-' }}</span>
            <span>
              <b>状态：</b>
              <Tag
                :color="BOOKING_STATUS_MAP[booking.status]?.color ?? 'default'"
              >
                {{ BOOKING_STATUS_MAP[booking.status]?.text ?? booking.status }}
              </Tag>
            </span>
            <span><b>客户：</b>{{ booking.clientName ?? booking.clientCode }}</span>
            <span>
              <b>纸箱分柜：</b>
              {{
                booking.cartonSplitTiming === 2
                  ? '发布后（确认前完成）'
                  : '发布前完成'
              }}
            </span>
            <span><b>货代：</b>{{ booking.freightForwarder ?? '-' }}</span>
            <span><b>船期：</b>{{ booking.vesselDate ?? '-' }}</span>
          </div>
        </Card>

        <Row :gutter="16">
          <Col :span="16">
            <Card title="集装箱列表" size="small">
              <template #extra>
                <Button size="small" type="primary" @click="handleAddContainer">
                  分配纸箱到新箱
                </Button>
              </template>
              <Empty v-if="containers.length === 0" description="暂无集装箱" />
              <div
                v-for="container in containers"
                v-else
                :key="container.id"
                class="mb-4"
              >
                <Table
                  :data-source="[container]"
                  :columns="containerColumns"
                  :pagination="false"
                  size="small"
                  row-key="id"
                />
                <template v-if="container.cargos?.length">
                  <Divider title-placement="start" class="my-1 text-xs">
                    货物明细
                  </Divider>
                  <Table
                    :data-source="container.cargos"
                    :pagination="false"
                    size="small"
                    row-key="id"
                    :columns="loadedCargoColumns"
                  />
                </template>
              </div>
            </Card>
          </Col>
          <Col :span="8">
            <Card title="未分配货物池" size="small">
              <Empty
                v-if="unallocatedPool.length === 0"
                description="所有货物已分配"
              />
              <Table
                v-else
                :data-source="unallocatedPool"
                :columns="cargoColumns"
                :pagination="{ pageSize: 10 }"
                size="small"
                row-key="orderId"
              />
            </Card>
          </Col>
        </Row>
      </template>
    </Spin>
    <Modal
      v-model:open="allocationVisible"
      :confirm-loading="allocationSubmitting"
      title="分配纸箱到新集装箱"
      @ok="handleAllocateCartons"
    >
      <Form layout="vertical">
        <FormItem label="目标实际柜">
          <Select
            v-model:value="allocationForm.targetContainerId"
            :options="targetContainerOptions"
            allow-clear
            placeholder="不选择则新建实际柜"
          />
        </FormItem>
        <FormItem
          v-if="!allocationForm.targetContainerId"
          label="箱型"
          required
        >
          <Select
            v-model:value="allocationForm.containerType"
            :options="containerTypeOptions"
          />
        </FormItem>
        <FormItem label="PO（仅可维护本人负责的 PO）" required>
          <Select
            v-model:value="allocationForm.orderId"
            :options="cartonOrderOptions"
            placeholder="请选择纸箱 PO"
            show-search
          />
        </FormItem>
        <Row :gutter="12">
          <Col :span="12">
            <FormItem label="起始箱号" required>
              <InputNumber
                v-model:value="allocationForm.cartonNoFrom"
                :min="1"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="结束箱号" required>
              <InputNumber
                v-model:value="allocationForm.cartonNoTo"
                :min="1"
                class="w-full"
              />
            </FormItem>
          </Col>
        </Row>
      </Form>
      <p class="text-xs text-gray-500">
        箱号范围必须连续且不与已分配范围重叠；体积、重量与装载数量由后端按纸箱资料自动计算。
      </p>
    </Modal>
  </Page>
</template>
