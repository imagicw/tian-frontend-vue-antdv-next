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
  buildChangeSplitPlan,
  resolveCartonPlanOrders,
  resolveChangeSnapshot,
  validateCartonContainerCapacity,
  validateCartonPlan,
} from './carton-plan';
import {
  deriveHangingRods,
  hasHangingConfig,
  isMixedCargoContainer,
  SHIPPING_MODE_FCL_HANGING,
  verifyHangingAllocationTotal,
} from './hanging';
import { buildLoadingManifest } from './loading-manifest';

const CONTAINER_TYPES = ['40GP', '40HQ', '20GP'];

const route = useRoute();
const bookingId = computed(() => Number(route.query.bookingId));
const changeId = computed(() =>
  route.query.changeId ? Number(route.query.changeId) : undefined,
);
const isChangeMode = computed(() => !!changeId.value);
const changeReason = ref('');
const changePlanDirty = ref(false);
const change = ref<null | ShipmentApi.ShipmentBookingChange>(null);
const nextDraftContainerId = ref(-1);
const nextDraftCargoId = ref(-1);

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
const editingCargo = ref<{
  cargoId: number;
  containerId: number;
}>();

const effectiveBooking = computed(() =>
  resolveChangeSnapshot(
    booking.value,
    isChangeMode.value ? change.value?.proposedBookingData : undefined,
  ),
);
const effectiveOrders = computed(() =>
  resolveCartonPlanOrders(
    booking.value?.orders ?? [],
    isChangeMode.value ? change.value?.orders : undefined,
  ),
);
const selectedOrder = computed(() =>
  effectiveOrders.value.find(
    (order) => order.id === allocationForm.value.orderId,
  ),
);
const isHangingMode = computed(
  () => selectedOrder.value?.shippingMode === SHIPPING_MODE_FCL_HANGING,
);

const cartonOrderOptions = computed(() =>
  effectiveOrders.value
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
  effectiveOrders.value
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
const orderOptions = computed(() => [
  ...cartonOrderOptions.value.map((option) => ({
    ...option,
    label: `[纸箱] ${option.label}`,
  })),
  ...hangingOrderOptions.value.map((option) => ({
    ...option,
    label: `[挂装] ${option.label}`,
  })),
]);

function configFor(containerType: string) {
  return containerConfigs.value.find(
    (c) =>
      c.containerType === containerType &&
      (!effectiveBooking.value?.freightForwarder ||
        c.freightForwarder === effectiveBooking.value.freightForwarder) &&
      (!effectiveBooking.value?.productionCountry ||
        c.productionCountry === effectiveBooking.value.productionCountry),
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
/** 该 PO 已在其它实际柜中分配的包数（不含本次表单正在填写的这一笔）。 */
const priorHangingAllocations = computed(() =>
  containers.value.flatMap((c) =>
    (c.cargos ?? [])
      .filter((cg) => cg.orderId === allocationForm.value.orderId)
      .map((cg) => cg.allocatedPackages ?? 0),
  ),
);
const hangingAllocationVerdict = computed(() => {
  if (!isHangingMode.value || !allocationForm.value.allocatedPackages) {
    return null;
  }
  return verifyHangingAllocationTotal(
    selectedOrder.value?.hangingPackageCount ?? 0,
    [...priorHangingAllocations.value, allocationForm.value.allocatedPackages],
  );
});
const hangingRemainingPackages = computed(() => {
  const total = selectedOrder.value?.hangingPackageCount ?? 0;
  const allocated = priorHangingAllocations.value.reduce((a, b) => a + b, 0);
  return total - allocated;
});
const targetContainerOptions = computed(() => [
  { label: '新建实际柜', value: 0 },
  ...containers.value.map((container) => ({
    label: `第 ${container.containerSeq ?? container.id} 柜（${container.containerType}）`,
    value: container.id,
    disabled: isTargetContainerIncompatible(container),
  })),
]);
const cartonPlanIssues = computed(() => {
  const cartonOrders = effectiveOrders.value.filter(
    (order) => order.shippingMode !== SHIPPING_MODE_FCL_HANGING,
  );
  return [
    ...validateCartonPlan(cartonOrders, containers.value),
    ...validateCartonContainerCapacity(cartonOrders, containers.value),
  ];
});

function capacitySummary(container: ShipmentApi.ShipmentContainer) {
  const hasHangingCargo = (container.cargos ?? []).some(
    (cargo) =>
      cargo.allocatedPackages !== undefined && cargo.allocatedPackages !== null,
  );
  if (hasHangingCargo) {
    return `${container.totalHangingRods ?? '-'} 杆 / ${container.minHangingRods ?? '-'} ~ ${container.maxHangingRods ?? '-'} 杆`;
  }
  return `${container.totalVolume ?? '-'} CBM / ${container.minVolume ?? '-'} ~ ${container.maxVolume ?? '-'} CBM`;
}

function planIssueFor(container: ShipmentApi.ShipmentContainer) {
  const containerIndex = containers.value.findIndex(
    (item) => item.id === container.id,
  );
  return cartonPlanIssues.value.find(
    (issue) => issue.containerIndex === containerIndex + 1,
  );
}

function isTargetContainerIncompatible(
  container: ShipmentApi.ShipmentContainer,
) {
  if (!selectedOrder.value) {
    return false;
  }
  const hasCartonCargo = (container.cargos ?? []).some(
    (cargo) => cargo.cartonNoFrom !== undefined && cargo.cartonNoFrom !== null,
  );
  const hasHangingCargo = (container.cargos ?? []).some(
    (cargo) =>
      cargo.allocatedPackages !== undefined && cargo.allocatedPackages !== null,
  );
  return (
    (isHangingMode.value && hasCartonCargo) ||
    (!isHangingMode.value && hasHangingCargo)
  );
}
const containersForDisplay = computed(() => {
  const manifests = buildLoadingManifest(containers.value);
  return containers.value.map((container, index) => ({
    container,
    manifest: manifests[index]!,
  }));
});

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
      change.value = await getBookingChange(changeId.value!);
      if (change.value?.proposedSplitPlanData) {
        const parsed = JSON.parse(change.value.proposedSplitPlanData);
        containers.value = (parsed.containers ?? []).map(
          (c: any, index: number) => ({
            ...(() => {
              const containerId = c.id ?? nextDraftContainerId.value--;
              const config = configFor(c.containerType);
              return {
                id: containerId,
                bookingId: bookingId.value,
                containerType: c.containerType,
                containerSeq: index + 1,
                minVolume: config?.minVolume,
                maxVolume: config?.maxVolume,
                cargos: (c.cargos ?? []).map((cargo: any) => ({
                  ...cargo,
                  containerId,
                  id: cargo.id ?? nextDraftCargoId.value--,
                })),
              };
            })(),
          }),
        );
      }
      changePlanDirty.value = false;
    }
  } finally {
    loading.value = false;
  }
}

async function saveChangeSplitPlan(
  splitPlan: ReturnType<typeof buildChangeSplitPlan>,
) {
  await saveBookingChangeSplitPlan({
    changeId: changeId.value!,
    reason: changeReason.value,
    splitPlan,
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
  editingCargo.value = undefined;
  recommendedCount.value = null;
  allocationVisible.value = true;
}

function updateChangePlanCargo(
  cargo: SplitCargoInput,
  containerType: string,
  targetContainerId?: number,
) {
  const nextContainers = containers.value.map((container) => ({
    ...container,
    cargos: [...(container.cargos ?? [])],
  }));
  const previous = editingCargo.value;
  if (previous) {
    const previousContainer = nextContainers.find(
      (container) => container.id === previous.containerId,
    );
    if (previousContainer) {
      previousContainer.cargos = previousContainer.cargos.filter(
        (item) => item.id !== previous.cargoId,
      );
    }
  }
  const target = targetContainerId
    ? nextContainers.find((container) => container.id === targetContainerId)
    : undefined;
  const newContainerId = nextDraftContainerId.value--;
  const cargoId = previous?.cargoId ?? nextDraftCargoId.value--;
  const cargoWithId = {
    ...cargo,
    containerId: target?.id ?? newContainerId,
    id: cargoId,
  };
  if (target) {
    target.cargos.push(cargoWithId);
  } else {
    const config = configFor(containerType);
    nextContainers.push({
      bookingId: bookingId.value,
      cargos: [cargoWithId],
      containerSeq: nextContainers.length + 1,
      containerType,
      id: newContainerId,
      maxVolume: config?.maxVolume,
      minVolume: config?.minVolume,
    });
  }
  containers.value = nextContainers.filter(
    (container) => container.cargos.length > 0,
  );
  changePlanDirty.value = true;
}

function handleEditCartonCargo(
  container: ShipmentApi.ShipmentContainer,
  cargo: ShipmentApi.ShipmentContainerCargo,
) {
  if (
    cargo.allocatedPackages !== undefined &&
    cargo.allocatedPackages !== null
  ) {
    message.warning('挂装包数请使用挂装分柜流程维护');
    return;
  }
  allocationForm.value = {
    allocatedPackages: undefined,
    cartonNoFrom: cargo.cartonNoFrom,
    cartonNoTo: cargo.cartonNoTo,
    containerType: container.containerType,
    orderId: cargo.orderId,
    targetContainerId: container.id,
  };
  editingCargo.value = { containerId: container.id, cargoId: cargo.id };
  allocationVisible.value = true;
}

function handleDeleteCartonCargo(
  container: ShipmentApi.ShipmentContainer,
  cargo: ShipmentApi.ShipmentContainerCargo,
) {
  containers.value = containers.value
    .map((item) =>
      item.id === container.id
        ? {
            ...item,
            cargos: (item.cargos ?? []).filter(
              (itemCargo) => itemCargo.id !== cargo.id,
            ),
          }
        : item,
    )
    .filter((item) => (item.cargos?.length ?? 0) > 0);
  changePlanDirty.value = true;
  message.success('已从变更草稿移除箱号范围，请保存完整方案后生效');
}

async function handleSaveChangeSplitPlan() {
  if (!changeReason.value.trim()) {
    message.warning('请先填写分柜方案变更原因');
    return;
  }
  const cartonOrders = effectiveOrders.value.filter(
    (order) => order.shippingMode !== SHIPPING_MODE_FCL_HANGING,
  );
  const issues = [
    ...validateCartonPlan(cartonOrders, containers.value),
    ...validateCartonContainerCapacity(cartonOrders, containers.value),
  ];
  if (issues.length > 0) {
    message.error(
      issues
        .slice(0, 3)
        .map((issue) => issue.message)
        .join('；'),
    );
    return;
  }
  allocationSubmitting.value = true;
  try {
    await saveChangeSplitPlan(
      buildChangeSplitPlan(bookingId.value, containers.value),
    );
    changePlanDirty.value = false;
    message.success('完整分柜方案已保存为变更草稿，发布后才生效');
    await loadData();
  } finally {
    allocationSubmitting.value = false;
  }
}

async function handleRecommendContainerCount() {
  if (
    !effectiveBooking.value?.clientCode ||
    !allocationForm.value.allocatedPackages
  ) {
    message.warning('请先选择柜型并填写获配包数');
    return;
  }
  recommendedCount.value = await recommendHangingContainerCount({
    clientCode: effectiveBooking.value.clientCode,
    freightForwarder: effectiveBooking.value.freightForwarder,
    productionCountry: effectiveBooking.value.productionCountry,
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
    if (hangingAllocationVerdict.value === 'over') {
      message.warning(
        `该 PO 挂装总包数为 ${selectedOrder.value?.hangingPackageCount ?? 0}，本次分配后将超出，请调整获配包数`,
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
    const targetContainer = containers.value.find(
      (container) => container.id === targetContainerId,
    );
    if (
      targetContainer &&
      isMixedCargoContainer([...(targetContainer.cargos ?? []), cargo])
    ) {
      message.warning('同一实际柜不能混装纸箱货与挂装货');
      return;
    }
    if (isChangeMode.value) {
      updateChangePlanCargo(
        cargo,
        containerType,
        targetContainerId || undefined,
      );
      message.success('已更新本地变更草稿，请保存完整分柜方案');
      allocationVisible.value = false;
      return;
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
    containers.value = containers.value.filter(
      (item) => item.id !== container.id,
    );
    changePlanDirty.value = true;
    message.success('已从变更草稿移除实际柜，请保存完整方案后生效');
    return;
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
    title: '柜容 / 占用',
    key: 'capacity',
    width: 190,
    render: (_value, record) => capacitySummary(record),
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
    title: '方案状态',
    key: 'planStatus',
    width: 180,
    render: (_value, record) => {
      const issue = planIssueFor(record);
      return h(
        Tag,
        { color: issue ? 'error' : 'success' },
        { default: () => issue?.message ?? '当前可执行' },
      );
    },
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

const cartonCargoColumns: TableColumnsType<ShipmentApi.ShipmentContainerCargo> =
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

const hangingCargoColumns: TableColumnsType<{
  allocatedPackages?: number;
  allocatedRods?: number;
  id: number;
  poNo?: string;
}> = [
  { dataIndex: 'poNo', key: 'poNo', title: 'PO号' },
  {
    dataIndex: 'allocatedPackages',
    key: 'allocatedPackages',
    title: '获配包数',
  },
  {
    dataIndex: 'allocatedRods',
    key: 'allocatedRods',
    title: '派生杆数',
  },
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
                <div class="flex gap-2">
                  <Button
                    v-if="isChangeMode"
                    :disabled="!changePlanDirty"
                    :loading="allocationSubmitting"
                    size="small"
                    type="primary"
                    @click="handleSaveChangeSplitPlan"
                  >
                    保存完整方案
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    @click="handleAddContainer"
                  >
                    新增分配
                  </Button>
                </div>
              </template>
              <Empty v-if="containers.length === 0" description="暂无集装箱" />
              <div
                v-for="{ container, manifest } in containersForDisplay"
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
                <div
                  v-if="manifest.cargoType === 'hanging'"
                  class="mt-2 rounded bg-blue-50 px-3 py-2 text-sm text-blue-950"
                >
                  <strong>挂装装柜信息：</strong>
                  {{ container.containerType }} · 总杆数
                  {{ manifest.hanging?.totalRods ?? '-' }}
                  · 每杆
                  {{ manifest.hanging?.ropesPerRod ?? '-' }}
                  绳 · 每绳
                  {{ manifest.hanging?.packagesPerRope ?? '-' }}
                  包 · 每绳
                  {{ manifest.hanging?.knotsPerRope ?? '-' }}
                  结
                </div>
                <template v-if="container.cargos?.length">
                  <Divider title-placement="start" class="my-1 text-xs">
                    货物明细
                  </Divider>
                  <Table
                    :data-source="
                      manifest.cargoType === 'hanging'
                        ? manifest.poAllocations
                        : container.cargos
                    "
                    :pagination="false"
                    size="small"
                    row-key="id"
                    :columns="
                      manifest.cargoType === 'hanging'
                        ? hangingCargoColumns
                        : cartonCargoColumns
                    "
                  />
                  <div
                    v-if="isChangeMode && manifest.cargoType === 'carton'"
                    class="mt-2 flex flex-wrap gap-2"
                  >
                    <template v-for="cargo in container.cargos" :key="cargo.id">
                      <Button
                        size="small"
                        @click="handleEditCartonCargo(container, cargo)"
                      >
                        编辑 {{ cargo.poNo ?? cargo.orderId }} 箱号
                      </Button>
                      <Popconfirm
                        title="确定从变更草稿中移除此箱号范围？"
                        @confirm="handleDeleteCartonCargo(container, cargo)"
                      >
                        <Button danger size="small">删除</Button>
                      </Popconfirm>
                    </template>
                  </div>
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
      :title="editingCargo ? '编辑箱号范围' : '新增分配'"
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
          <FormItem label="该 PO 分配进度">
            <Tag
              :color="
                hangingAllocationVerdict === 'over'
                  ? 'error'
                  : hangingAllocationVerdict === 'ok'
                    ? 'success'
                    : 'default'
              "
            >
              {{
                selectedOrder
                  ? `已分配 ${(selectedOrder.hangingPackageCount ?? 0) - hangingRemainingPackages} / ${selectedOrder.hangingPackageCount ?? 0} 包，本柜之外尚余 ${hangingRemainingPackages} 包`
                  : '请先选择 PO'
              }}
            </Tag>
          </FormItem>
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
          包数——本次分配会被拦截超出部分（过分配）与非整数包，
          尚未分配完的余量在“该 PO
          分配进度”中提示，最终是否覆盖齐全由发布/出运前的后端校验把关。
        </template>
        <template v-else>
          箱号范围必须连续且不与已分配范围重叠；体积、重量与装载数量由后端按纸箱资料自动计算。
        </template>
      </p>
    </Modal>
  </Page>
</template>
