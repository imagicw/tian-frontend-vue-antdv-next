<script lang="ts" setup>
import type { TableColumnsType } from 'antdv-next';

import type { ShipmentApi, SplitCargoInput } from '#/api/shipment';

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
  Input,
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
  getBookingChange,
  getBookingDetail,
  getContainerConfigsByClientCode,
  getContainersByBooking,
  getUnallocatedCargoPool,
  recommendHangingContainerCount,
  saveBookingChangeSplitPlan,
} from '#/api/shipment';

import { BOOKING_STATUS_MAP, BOOKING_TYPE_MAP } from '../booking/data';
import {
  deriveHangingRods,
  hasHangingConfig,
  SHIPPING_MODE_FCL_HANGING,
  verifyHangingAllocationTotal,
} from './hanging';

const CONTAINER_TYPES = ['40GP', '40HQ', '20GP'];

const route = useRoute();
const bookingId = computed(() => Number(route.query.bookingId));
const changeId = computed(() =>
  route.query.changeId ? Number(route.query.changeId) : undefined,
);
const isChangeMode = computed(() => !!changeId.value);
const changeReason = ref('');

const loading = ref(false);
const booking = ref<null | ShipmentApi.ShipmentBooking>(null);
const containers = ref<ShipmentApi.ShipmentContainer[]>([]);
const unallocatedPool = ref<ShipmentApi.ShipmentPlanOrder[]>([]);
const containerConfigs = ref<ShipmentApi.ContainerConfig[]>([]);
const allocationVisible = ref(false);
const allocationSubmitting = ref(false);
const recommendedCount = ref<null | number>(null);
const allocationForm = ref({
  allocatedPackages: undefined as number | undefined,
  cartonNoFrom: undefined as number | undefined,
  cartonNoTo: undefined as number | undefined,
  containerType: CONTAINER_TYPES[0]!,
  orderId: undefined as number | undefined,
  targetContainerId: undefined as number | undefined,
});

const selectedOrder = computed(() =>
  (booking.value?.orders ?? []).find(
    (order) => order.id === allocationForm.value.orderId,
  ),
);
const isHangingMode = computed(
  () => selectedOrder.value?.shippingMode === SHIPPING_MODE_FCL_HANGING,
);

const cartonOrderOptions = computed(() =>
  (booking.value?.orders ?? [])
    .filter(
      (order) =>
        order.id !== null &&
        order.id !== undefined &&
        order.shippingMode !== SHIPPING_MODE_FCL_HANGING &&
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
const hangingOrderOptions = computed(() =>
  (booking.value?.orders ?? [])
    .filter(
      (order) =>
        order.id !== null &&
        order.id !== undefined &&
        order.shippingMode === SHIPPING_MODE_FCL_HANGING,
    )
    .map((order) => ({
      label: `${order.poNo ?? order.id}（挂装 ${order.hangingPackageCount ?? '-'} 包）`,
      value: order.id,
    })),
);
const orderOptions = computed(() =>
  isHangingMode.value ? hangingOrderOptions.value : cartonOrderOptions.value,
);

function configFor(containerType: string) {
  return containerConfigs.value.find(
    (c) =>
      c.containerType === containerType &&
      (!booking.value?.freightForwarder ||
        c.freightForwarder === booking.value.freightForwarder) &&
      (!booking.value?.productionCountry ||
        c.productionCountry === booking.value.productionCountry),
  );
}
const containerTypeOptions = computed(() =>
  CONTAINER_TYPES.map((containerType) => {
    const missingHangingConfig =
      isHangingMode.value && !hasHangingConfig(configFor(containerType));
    return {
      label: missingHangingConfig
        ? `${containerType}（缺少挂装配置）`
        : containerType,
      value: containerType,
      disabled: missingHangingConfig,
    };
  }),
);
const derivedRods = computed(() =>
  deriveHangingRods(
    allocationForm.value.allocatedPackages,
    configFor(allocationForm.value.containerType),
  ),
);
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
    if (bookingDetail?.clientCode) {
      const configs = await getContainerConfigsByClientCode(
        bookingDetail.clientCode,
      );
      containerConfigs.value = Array.isArray(configs)
        ? configs
        : ((configs as any).data ?? []);
    }
    // 变更草稿模式：若该草稿此前已保存过分柜方案，以草稿内容为准回显（草稿未落到官方分柜表，
    // 聚合字段如总体积/利用率不可用，仅作为编辑基础）。
    if (isChangeMode.value) {
      const change = await getBookingChange(changeId.value!);
      if (change?.proposedSplitPlanData) {
        const parsed = JSON.parse(change.proposedSplitPlanData);
        containers.value = (parsed.containers ?? []).map(
          (c: any, index: number) => ({
            id: c.id,
            bookingId: bookingId.value,
            containerType: c.containerType,
            containerSeq: index + 1,
            cargos: c.cargos ?? [],
          }),
        );
      }
    }
  } finally {
    loading.value = false;
  }
}

/** 将当前实际柜列表 + 一次新增分配，转换为“保存整份分柜方案”所需的完整 containers 数组。 */
function buildFullSplitPlanContainers(addition?: {
  cargo: SplitCargoInput;
  containerType: string;
  targetContainerId?: number;
}) {
  const list: Array<{
    cargos: SplitCargoInput[];
    containerType: string;
    id?: number;
  }> = containers.value.map((c) => ({
    id: c.id,
    containerType: c.containerType,
    cargos: (c.cargos ?? []).map((cg) => ({
      orderId: cg.orderId,
      cartonNoFrom: cg.cartonNoFrom,
      cartonNoTo: cg.cartonNoTo,
      allocatedPackages: cg.allocatedPackages,
    })),
  }));
  if (addition) {
    const target = addition.targetContainerId
      ? list.find((c) => c.id === addition.targetContainerId)
      : undefined;
    if (target) {
      target.cargos.push(addition.cargo);
    } else {
      list.push({
        containerType: addition.containerType,
        cargos: [addition.cargo],
      });
    }
  }
  return list;
}

async function saveChangeSplitPlan(
  containersPayload: ReturnType<typeof buildFullSplitPlanContainers>,
) {
  await saveBookingChangeSplitPlan({
    changeId: changeId.value!,
    reason: changeReason.value,
    splitPlan: { bookingId: bookingId.value, containers: containersPayload },
  });
}

function handleAddContainer() {
  allocationForm.value = {
    allocatedPackages: undefined,
    cartonNoFrom: undefined,
    cartonNoTo: undefined,
    containerType: CONTAINER_TYPES[0]!,
    orderId: undefined,
    targetContainerId: undefined,
  };
  recommendedCount.value = null;
  allocationVisible.value = true;
}

async function handleRecommendContainerCount() {
  if (!booking.value?.clientCode || !allocationForm.value.allocatedPackages) {
    message.warning('请先选择柜型并填写获配包数');
    return;
  }
  recommendedCount.value = await recommendHangingContainerCount({
    clientCode: booking.value.clientCode,
    freightForwarder: booking.value.freightForwarder,
    productionCountry: booking.value.productionCountry,
    containerType: allocationForm.value.containerType,
    packageCount: allocationForm.value.allocatedPackages,
  });
}

async function handleAllocateCartons() {
  const {
    allocatedPackages,
    cartonNoFrom,
    cartonNoTo,
    containerType,
    orderId,
    targetContainerId,
  } = allocationForm.value;
  if (!orderId) {
    message.warning('请选择 PO');
    return;
  }
  if (isChangeMode.value && !changeReason.value.trim()) {
    message.warning('请先填写分柜方案变更原因');
    return;
  }
  if (isHangingMode.value) {
    if (
      !allocatedPackages ||
      !Number.isInteger(allocatedPackages) ||
      allocatedPackages <= 0
    ) {
      message.warning('请填写有效的整数获配包数');
      return;
    }
    if (!hasHangingConfig(configFor(containerType))) {
      message.warning('该柜型缺少挂装配置（每杆绳数/每绳包数），无法分配');
      return;
    }
    const priorAllocations = containers.value.flatMap((c) =>
      (c.cargos ?? [])
        .filter((cg) => cg.orderId === orderId)
        .map((cg) => cg.allocatedPackages ?? 0),
    );
    const totalPackages = selectedOrder.value?.hangingPackageCount ?? 0;
    const verdict = verifyHangingAllocationTotal(totalPackages, [
      ...priorAllocations,
      allocatedPackages,
    ]);
    if (verdict === 'over') {
      message.warning(
        `该 PO 挂装总包数为 ${totalPackages}，本次分配后将超出，请调整获配包数`,
      );
      return;
    }
  } else if (
    cartonNoFrom === null ||
    cartonNoFrom === undefined ||
    cartonNoTo === null ||
    cartonNoTo === undefined ||
    cartonNoFrom > cartonNoTo
  ) {
    message.warning('请填写有效且连续的起止箱号');
    return;
  }
  allocationSubmitting.value = true;
  try {
    const cargo = isHangingMode.value
      ? { orderId, allocatedPackages }
      : { orderId, cartonNoFrom, cartonNoTo };
    if (isChangeMode.value) {
      await saveChangeSplitPlan(
        buildFullSplitPlanContainers({
          cargo,
          containerType,
          targetContainerId: targetContainerId || undefined,
        }),
      );
    } else {
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
    }
    message.success(isHangingMode.value ? '挂装包数已分配' : '纸箱范围已分配');
    allocationVisible.value = false;
    await loadData();
  } finally {
    allocationSubmitting.value = false;
  }
}

async function handleDeleteContainer(container: ShipmentApi.ShipmentContainer) {
  if (isChangeMode.value) {
    if (!changeReason.value.trim()) {
      message.warning('请先填写分柜方案变更原因');
      return;
    }
    // 变更草稿内的柜没有正式主键，按草稿内顺序号定位。
    await saveChangeSplitPlan(
      containers.value
        .filter((c) => c.containerSeq !== container.containerSeq)
        .map((c) => ({
          id: c.id,
          containerType: c.containerType,
          cargos: (c.cargos ?? []).map((cg) => ({
            orderId: cg.orderId,
            cartonNoFrom: cg.cartonNoFrom,
            cartonNoTo: cg.cartonNoTo,
            allocatedPackages: cg.allocatedPackages,
          })),
        })),
    );
  } else {
    await deleteContainer(container.id);
  }
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
          onConfirm: () => handleDeleteContainer(record),
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
          <div v-if="isChangeMode" class="mt-3 flex items-center gap-2">
            <Tag color="processing">变更草稿中：分柜方案发布后才生效</Tag>
            <Input
              v-model:value="changeReason"
              placeholder="请填写本次分柜方案改动原因"
              class="max-w-xs"
            />
          </div>
        </Card>

        <Row :gutter="16">
          <Col :span="16">
            <Card title="集装箱列表" size="small">
              <template #extra>
                <Button size="small" type="primary" @click="handleAddContainer">
                  新增分配
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
      title="新增分配"
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
            :options="orderOptions"
            placeholder="请选择 PO（纸箱 / 挂装分开列出）"
            show-search
          />
        </FormItem>
        <template v-if="isHangingMode">
          <Row :gutter="12">
            <Col :span="12">
              <FormItem label="获配包数" required>
                <InputNumber
                  v-model:value="allocationForm.allocatedPackages"
                  :min="1"
                  :precision="0"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="派生杆数">
                <span>{{ derivedRods ?? '需先配置柜型挂装参数' }}</span>
              </FormItem>
            </Col>
          </Row>
          <FormItem>
            <Button size="small" @click="handleRecommendContainerCount">
              获取该柜型最少柜数建议
            </Button>
            <span v-if="recommendedCount !== null" class="ml-2 text-sm">
              建议至少 {{ recommendedCount }} 柜
            </span>
          </FormItem>
        </template>
        <Row v-else :gutter="12">
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
        <template v-if="isHangingMode">
          挂装分配按包数计算，派生杆数 = 获配包数 ÷（每杆绳数 ×
          每绳包数）；跨实际柜合计必须恰好覆盖 PO
          包数，过分配/欠分配/非整数包将被拒绝。
        </template>
        <template v-else>
          箱号范围必须连续且不与已分配范围重叠；体积、重量与装载数量由后端按纸箱资料自动计算。
        </template>
      </p>
    </Modal>
  </Page>
</template>
