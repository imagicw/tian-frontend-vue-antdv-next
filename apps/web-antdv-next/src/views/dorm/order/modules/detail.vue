<script lang="ts" setup>
import type { TableColumnsType } from 'antdv-next';
import type { Dayjs } from 'dayjs';

import type { DormApi } from '#/api/dorm';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  AutoComplete,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antdv-next';
import dayjs from 'dayjs';

import {
  cancelDormOrder,
  changeDormStayPeriod,
  getRoomAllocationWorkbench,
  getRoomOrderInfo,
  settleDormOrder,
  transferDormBed,
} from '#/api/dorm';
import { getSimpleUserList } from '#/api/system/user';
import { useDescription } from '#/components/description';

import { getDormTimezoneLabel } from '../../area/timezones';
import {
  getSingleDatePickerValue,
  type SingleDatePickerValue,
} from '../../utils/date-picker';
import {
  ORDER_STATUS_MAP,
  SUB_ORDER_STATUS_MAP,
  useOrderDetailSchema,
} from '../data';

const [OrderDescriptions] = useDescription({
  bordered: true,
  column: 3,
  schema: useOrderDetailSchema(),
  useCard: false,
});

const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const orderSerial = route.params.serial as string;

const loading = ref(false);
const cancelling = ref(false);
const settling = ref(false);
const changingDate = ref(false);
const changingRoom = ref(false);
const orderInfo = ref<DormApi.DormOrder | null>(null);
const subOrders = ref<DormApi.DormSubOrder[]>([]);
const users = ref<SystemUserApi.User[]>([]);

// Settle modal
const settleOpen = ref(false);
const settleData = ref<DormApi.SettleOrderData>({
  orderSerial,
  subOrderSettleInfo: [],
});

// Change room date modal
const changeDateOpen = ref(false);
const changeDateRow = ref<DormApi.DormSubOrder | null>(null);
const newEndDate = ref('');
const changeDateReason = ref('');

// Change room modal
const changeRoomOpen = ref(false);
const changeRoomRow = ref<DormApi.DormSubOrder | null>(null);
const changeRoomWorkbench = ref<DormApi.RoomAllocationWorkbench>();
const selectedNewRoomId = ref<number | undefined>();
const selectedNewBedId = ref<number | undefined>();
const changeRoomEffectiveDate = ref('');
const changeRoomReason = ref('');
const changeRoomLoading = ref(false);

const stayColumns: TableColumnsType<DormApi.DormSubOrder> = [
  { key: 'guest', title: '入住人', width: 190 },
  { key: 'room', title: '入住房间', width: 125 },
  { key: 'stayPeriod', title: '入住时间', width: 210 },
  { align: 'right', key: 'estimatedFee', title: '预估费用', width: 100 },
  {
    align: 'center',
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 90,
  },
  { align: 'center', key: 'actions', title: '操作', width: 230 },
];

const canManageOrder = computed(() => hasAccessByCodes(['dorm:room:update']));
const canCancel = computed(
  () =>
    canManageOrder.value &&
    Boolean(orderInfo.value && orderInfo.value.status <= 1),
);
const canSettle = computed(
  () =>
    canManageOrder.value &&
    orderInfo.value?.status === 1 &&
    subOrders.value.some((item) => item.status === 1),
);
const canSubmitDateChange = computed(
  () =>
    changeDateRow.value &&
    newEndDate.value &&
    dayjs(changeDateRow.value.startTime).isBefore(dayjs(newEndDate.value)) &&
    changeDateReason.value.trim(),
);
const changeRoomRooms = computed(() => changeRoomWorkbench.value?.rooms ?? []);
const selectedChangeRoom = computed(() =>
  changeRoomRooms.value.find((room) => room.id === selectedNewRoomId.value),
);
const changeRoomOptions = computed(() =>
  changeRoomRooms.value.map((room) => ({
    disabled: room.status !== 0,
    label: `${room.roomAlias || room.roomCode} · ${room.floor ?? '-'} 层`,
    value: room.id,
  })),
);
const changeRoomBedOptions = computed(() =>
  (selectedChangeRoom.value?.beds ?? []).map((bed) => ({
    disabled: bed.status !== 0 || bed.assignments.length > 0,
    label:
      bed.assignments.length > 0
        ? `${bed.bedCode} · 已占用`
        : `${bed.bedCode} · 可用`,
    value: bed.id,
  })),
);
const canSubmitRoomChange = computed(
  () =>
    changeRoomRow.value &&
    selectedNewRoomId.value &&
    selectedNewBedId.value &&
    changeRoomEffectiveDate.value &&
    changeRoomReason.value.trim(),
);
const orderSnapshot = computed(() => orderInfo.value?.dormOrderSnapshot);
const orderStatus = computed(
  () => ORDER_STATUS_MAP[orderInfo.value?.status ?? 0],
);
const requestedGuestCount = computed(() =>
  (orderSnapshot.value?.checkInInfo ?? []).reduce(
    (total, group) => total + (group.checkInPersons?.length ?? 0),
    0,
  ),
);
const activeGuestCount = computed(
  () => subOrders.value.filter((item) => item.status !== 2).length,
);
const stayStartTime = computed(
  () =>
    orderInfo.value?.serveStartTime ??
    orderSnapshot.value?.serveStartTime ??
    '',
);
const stayEndTime = computed(
  () =>
    orderInfo.value?.serveEndTime ?? orderSnapshot.value?.serveEndTime ?? '',
);
const stayDays = computed(() => {
  if (orderSnapshot.value?.serveDays != null) {
    return orderSnapshot.value.serveDays;
  }
  let maxDays = 0;
  for (const item of subOrders.value) {
    maxDays = Math.max(maxDays, item.days ?? 0);
  }
  if (maxDays > 0) return maxDays;

  const start = dayjs(stayStartTime.value);
  const end = dayjs(stayEndTime.value);
  return start.isValid() && end.isValid()
    ? Math.max(end.diff(start, 'day'), 0)
    : 0;
});
const applicantName = computed(() => {
  if (orderInfo.value?.userName) return orderInfo.value.userName;
  const applicant = users.value.find(
    (user) => user.id === orderInfo.value?.userId,
  );
  return (
    applicant?.nickname ||
    applicant?.username ||
    (orderInfo.value?.userId ? `用户 ${orderInfo.value.userId}` : '-')
  );
});
const timezoneLabel = computed(() =>
  getDormTimezoneLabel(orderInfo.value?.areaTimezone),
);
const orderDescriptionData = computed(() => ({
  ...orderInfo.value,
  applicantName: applicantName.value,
  serviceDays: stayDays.value,
}));
const buildingTitle = computed(() => {
  const areaName = orderSnapshot.value?.areaName;
  const buildName = orderSnapshot.value?.buildName;
  return [areaName, buildName].filter(Boolean).join(' · ') || '住宿订单';
});
const orderImage = computed(() => orderSnapshot.value?.images?.[0]);
const feeDisplay = computed(() => {
  if (orderInfo.value?.orderFee == null) return '待结算';
  return `${orderInfo.value.orderFee} ${orderInfo.value.settleCurrencyCode ?? ''}`.trim();
});
const receiptGroups = computed(
  () => orderInfo.value?.dormOrderFeeItemRespVO?.orderFeeItemDTOList ?? [],
);
const receiptTotal = computed(() => {
  let total = 0;
  for (const group of receiptGroups.value) {
    for (const fee of group.feeItemList ?? []) {
      total += fee.totalPrice ?? (fee.unitPrice ?? 0) * (fee.quantity ?? 0);
    }
  }
  return total;
});
const receiptCurrency = computed(
  () =>
    receiptGroups.value
      .flatMap((group) => group.feeItemList ?? [])
      .find((fee) => fee.settleCurrencyCode)?.settleCurrencyCode ??
    orderInfo.value?.settleCurrencyCode ??
    '',
);

const STEPS = [
  { title: '待分配' },
  { title: '已预订' },
  { title: '已结算' },
  { title: '已分摊' },
];
const FEE_NAME_OPTIONS = ['房费', '接机费', '杂费'].map((value) => ({
  label: value,
  value,
}));

const currentStep = computed(() => {
  const s = orderInfo.value?.status ?? 0;
  if (s === 4) return 3;
  if (s === 3) return 2;
  return Math.min(s, 1);
});

function formatDate(value?: number | string) {
  if (!value) return '-';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : String(value);
}

function formatDateTime(value?: number | string) {
  if (!value) return '-';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : String(value);
}

function getGuestInitial(name?: string) {
  return name?.trim().slice(0, 1).toUpperCase() || '住';
}

function getStayRowClassName(record: DormApi.DormSubOrder) {
  return record.status === 2 ? 'is-finished-row' : '';
}

function toDormSubOrder(record: unknown) {
  return record as unknown as DormApi.DormSubOrder;
}

function getRoomType(room?: DormApi.DormRoom) {
  if (!room) return '房间待分配';
  return room.roomType === 1 ? '单人间' : '多人间';
}

function getEstimatedFee(row: DormApi.DormSubOrder) {
  const unitPrice = row.roomSnapshot?.settleAmount;
  if (unitPrice == null || row.days == null) return '-';
  return `${row.roomSnapshot?.settleCurrencyCode ?? ''} ${(
    unitPrice * row.days
  ).toFixed(2)}`.trim();
}

function getFeeTotal(fee: DormApi.FeeItem) {
  return Number(((fee.unitPrice ?? 0) * (fee.quantity ?? 0)).toFixed(2));
}

function formatMoney(amount?: number, currency?: string) {
  if (amount == null) return '-';
  return `${amount.toFixed(2)} ${currency ?? ''}`.trim();
}

function addFeeItem(subOrderIndex: number) {
  const subOrder = settleData.value.subOrderSettleInfo[subOrderIndex];
  if (!subOrder) return;
  subOrder.feeItems.push({
    itemName: '',
    quantity: 1,
    remark: '',
    settleCurrencyCode: subOrder.feeItems[0]?.settleCurrencyCode,
    unitPrice: 0,
  });
}

function removeFeeItem(subOrderIndex: number, feeIndex: number) {
  const feeItems = settleData.value.subOrderSettleInfo[subOrderIndex]?.feeItems;
  if (!feeItems || feeItems.length <= 1) return;
  feeItems.splice(feeIndex, 1);
}

function prepareSettlementData() {
  for (const subOrder of settleData.value.subOrderSettleInfo) {
    if (subOrder.feeItems.length === 0) {
      message.warning(`${subOrder.userName || '入住人'}至少需要一项费用`);
      return false;
    }

    const feeNames = new Set<string>();
    for (const fee of subOrder.feeItems) {
      const itemName = fee.itemName.trim();
      if (!itemName) {
        message.warning(`${subOrder.userName || '入住人'}存在未填写的费用名称`);
        return false;
      }
      if (itemName.length > 20) {
        message.warning('费用名称不能超过 20 个字符');
        return false;
      }
      if (feeNames.has(itemName)) {
        message.warning(`${subOrder.userName || '入住人'}的费用名称不能重复`);
        return false;
      }
      if (fee.unitPrice == null || fee.quantity == null) {
        message.warning(`${itemName}的单价和数量不能为空`);
        return false;
      }
      if (!Number.isInteger(fee.quantity)) {
        message.warning(`${itemName}的数量必须为整数`);
        return false;
      }

      feeNames.add(itemName);
      fee.itemName = itemName;
      fee.userName = subOrder.userName;
      fee.totalPrice = getFeeTotal(fee);
    }
  }
  return true;
}

async function loadOrder() {
  loading.value = true;
  try {
    const res = await getRoomOrderInfo(orderSerial);
    orderInfo.value = res.dormOrderRespVO;
    subOrders.value = res.orderDetailRespVOList ?? [];
    settleData.value = {
      orderSerial,
      subOrderSettleInfo: subOrders.value
        .filter((s) => s.status === 1)
        .map((s) => ({
          subOrderSerial: s.subOrderSerial,
          userName: s.userName,
          feeItems: [
            {
              itemName: '房费',
              settleCurrencyCode: s.roomSnapshot?.settleCurrencyCode,
              unitPrice: s.roomSnapshot?.settleAmount,
              quantity: s.days,
              remark: '',
            },
          ],
        })),
    };
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    users.value = await getSimpleUserList();
  } catch {
    users.value = [];
  }
}

async function handleCancelOrder() {
  cancelling.value = true;
  try {
    await cancelDormOrder({ orderSerial });
    message.success('订单已取消');
    await loadOrder();
  } finally {
    cancelling.value = false;
  }
}

async function handleCancelSubOrder(row: DormApi.DormSubOrder) {
  cancelling.value = true;
  try {
    await cancelDormOrder({
      orderSerial: row.orderSerial,
      orderDetailId: row.id,
    });
    message.success('子订单已取消');
    await loadOrder();
  } finally {
    cancelling.value = false;
  }
}

async function handleSettle() {
  if (!canSettle.value || !prepareSettlementData()) return;
  settling.value = true;
  try {
    await settleDormOrder(settleData.value);
    message.success('结算成功');
    settleOpen.value = false;
    await loadOrder();
  } finally {
    settling.value = false;
  }
}

async function openChangeDate(row: DormApi.DormSubOrder) {
  changeDateRow.value = row;
  newEndDate.value = row.endTime?.split(' ')[0] ?? '';
  changeDateReason.value = '';
  changeDateOpen.value = true;
}

function handleNewEndDateChange(value: SingleDatePickerValue) {
  newEndDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
}

function disableNewEndDate(value: Dayjs) {
  return (
    !changeDateRow.value?.startTime ||
    !value.isAfter(dayjs(changeDateRow.value.startTime), 'day')
  );
}

async function handleChangeDate() {
  if (!changeDateRow.value || !canSubmitDateChange.value) {
    message.warning('请填写有效的退宿日期和变更原因');
    return;
  }
  changingDate.value = true;
  try {
    await changeDormStayPeriod({
      endDate: newEndDate.value,
      guestId: changeDateRow.value.id,
      operationNo: `PERIOD-${changeDateRow.value.id}-${Date.now()}`,
      reason: changeDateReason.value.trim(),
      version: changeDateRow.value.version,
    });
    message.success('住宿期已更新，床位安排已同步');
    changeDateOpen.value = false;
    await loadOrder();
  } finally {
    changingDate.value = false;
  }
}

async function loadAvailableRooms() {
  const buildId = orderInfo.value?.dormOrderSnapshot?.buildId;
  const end = changeRoomRow.value?.endTime?.split(' ')[0];
  selectedNewBedId.value = undefined;
  if (!buildId || !changeRoomEffectiveDate.value || !end) return;

  changeRoomLoading.value = true;
  try {
    changeRoomWorkbench.value = await getRoomAllocationWorkbench({
      buildId,
      startDate: changeRoomEffectiveDate.value,
      endDate: end,
    });
  } finally {
    changeRoomLoading.value = false;
  }
}

async function openChangeRoom(row: DormApi.DormSubOrder) {
  changeRoomRow.value = row;
  const start = row.startTime?.split(' ')[0] ?? '';
  const end = row.endTime?.split(' ')[0] ?? '';
  const today = dayjs().format('YYYY-MM-DD');
  changeRoomEffectiveDate.value =
    dayjs(today).isAfter(dayjs(start), 'day') &&
    dayjs(today).isBefore(dayjs(end), 'day')
      ? today
      : start;
  changeRoomReason.value = '';
  selectedNewRoomId.value = undefined;
  selectedNewBedId.value = undefined;
  changeRoomWorkbench.value = undefined;
  changeRoomOpen.value = true;
  await loadAvailableRooms();
}

function handleChangeRoomEffectiveDate(value: SingleDatePickerValue) {
  changeRoomEffectiveDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
  selectedNewBedId.value = undefined;
  void loadAvailableRooms();
}

function disableChangeRoomDate(value: Dayjs) {
  if (!changeRoomRow.value?.startTime || !changeRoomRow.value.endTime)
    return true;
  return (
    value.isBefore(dayjs(changeRoomRow.value.startTime), 'day') ||
    !value.isBefore(dayjs(changeRoomRow.value.endTime), 'day')
  );
}

function handleChangeRoomSelection() {
  selectedNewBedId.value = undefined;
}

async function handleChangeRoom() {
  if (
    !changeRoomRow.value ||
    !canSubmitRoomChange.value ||
    !selectedNewRoomId.value ||
    !selectedNewBedId.value
  ) {
    message.warning('请完整填写生效日期、目标床位和调房原因');
    return;
  }
  changingRoom.value = true;
  try {
    await transferDormBed({
      effectiveDate: changeRoomEffectiveDate.value,
      guestId: changeRoomRow.value.id,
      operationNo: `TRANSFER-${changeRoomRow.value.id}-${Date.now()}`,
      reason: changeRoomReason.value.trim(),
      targetBedId: selectedNewBedId.value,
      targetRoomId: selectedNewRoomId.value,
      version: changeRoomRow.value.version,
    });
    message.success('调房完成，原床位历史已保留');
    changeRoomOpen.value = false;
    await loadOrder();
  } finally {
    changingRoom.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadOrder(), loadUsers()]);
});
</script>

<template>
  <Page title="订单详情" auto-content-height>
    <template #extra>
      <Button @click="router.back()">
        <IconifyIcon icon="lucide:arrow-left" />
        返回订单列表
      </Button>
    </template>

    <Spin :spinning="loading" class="block min-h-64">
      <template v-if="orderInfo">
        <div class="order-detail">
          <Card
            class="order-hero overflow-hidden shadow-sm"
            :body-style="{ padding: 0 }"
          >
            <div class="order-hero__accent"></div>
            <div class="order-hero__main">
              <div class="order-hero__identity">
                <div class="order-hero__cover">
                  <Image
                    v-if="orderImage"
                    :src="orderImage"
                    :alt="buildingTitle"
                    :preview="false"
                  />
                  <IconifyIcon v-else icon="lucide:building-2" :size="30" />
                </div>

                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2
                      class="text-foreground m-0 truncate text-xl font-semibold"
                    >
                      {{ buildingTitle }}
                    </h2>
                    <Tag :color="orderStatus?.color ?? 'default'">
                      {{ orderStatus?.text ?? orderInfo.status }}
                    </Tag>
                  </div>
                  <div class="order-hero__serial">
                    <span>订单号</span>
                    <Typography.Text
                      class="font-mono"
                      :copyable="{ text: orderSerial }"
                    >
                      {{ orderSerial }}
                    </Typography.Text>
                  </div>
                  <div
                    class="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs"
                  >
                    <span class="inline-flex items-center gap-1">
                      <IconifyIcon icon="lucide:user-round" />
                      {{ applicantName }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <IconifyIcon icon="lucide:clock-3" />
                      {{ timezoneLabel }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <IconifyIcon icon="lucide:calendar-plus" />
                      下单于 {{ formatDateTime(orderInfo.createTime) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="order-hero__actions">
                <Tooltip title="重新获取最新订单状态">
                  <Button :loading="loading" @click="loadOrder">
                    <IconifyIcon icon="lucide:refresh-cw" />
                    刷新
                  </Button>
                </Tooltip>
                <Button
                  v-if="orderInfo.status === 1"
                  type="primary"
                  :disabled="!canSettle"
                  v-auth="'dorm:room:update'"
                  @click="settleOpen = true"
                >
                  <IconifyIcon icon="lucide:badge-dollar-sign" />
                  订单结算
                </Button>
                <Popconfirm
                  v-if="canCancel"
                  title="确定取消整个住宿订单吗？"
                  description="取消后订单将无法继续排房或结算。"
                  ok-text="确认取消"
                  cancel-text="暂不取消"
                  ok-type="danger"
                  @confirm="handleCancelOrder"
                >
                  <Button danger :loading="cancelling">
                    <IconifyIcon icon="lucide:circle-x" />
                    取消订单
                  </Button>
                </Popconfirm>
              </div>
            </div>

            <div class="order-hero__progress">
              <div v-if="orderInfo.status === 2" class="order-cancelled">
                <span class="order-cancelled__icon">
                  <IconifyIcon icon="lucide:circle-x" :size="19" />
                </span>
                <div>
                  <strong>订单已取消</strong>
                  <p>该订单已终止，不再进入后续入住与费用流程。</p>
                </div>
              </div>
              <Steps
                v-else
                :current="currentStep"
                :items="STEPS"
                label-placement="vertical"
                responsive
                size="small"
              />
            </div>
          </Card>

          <Row :gutter="[16, 16]">
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="summary-card h-full shadow-sm" size="small">
                <div class="summary-card__icon is-blue">
                  <IconifyIcon icon="lucide:calendar-range" :size="19" />
                </div>
                <div class="min-w-0">
                  <div class="text-muted-foreground text-xs">住宿周期</div>
                  <div class="text-foreground mt-1 truncate font-semibold">
                    {{ formatDate(stayStartTime) }} 至
                    {{ formatDate(stayEndTime) }}
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    共 {{ stayDays || 0 }} 天
                  </div>
                </div>
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="summary-card h-full shadow-sm" size="small">
                <div class="summary-card__icon is-cyan">
                  <IconifyIcon icon="lucide:users-round" :size="19" />
                </div>
                <div>
                  <div class="text-muted-foreground text-xs">入住安排</div>
                  <div class="text-foreground mt-1 font-semibold">
                    {{ activeGuestCount }} 人已安排
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    申请 {{ requestedGuestCount || activeGuestCount }} 人
                  </div>
                </div>
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="summary-card h-full shadow-sm" size="small">
                <div class="summary-card__icon is-purple">
                  <IconifyIcon icon="lucide:bed-single" :size="19" />
                </div>
                <div>
                  <div class="text-muted-foreground text-xs">入住记录</div>
                  <div class="text-foreground mt-1 font-semibold">
                    {{ subOrders.length }} 条
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    {{ subOrders.filter((item) => item.status === 1).length }}
                    条进行中
                  </div>
                </div>
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="summary-card h-full shadow-sm" size="small">
                <div class="summary-card__icon is-green">
                  <IconifyIcon icon="lucide:circle-dollar-sign" :size="19" />
                </div>
                <div class="min-w-0">
                  <div class="text-muted-foreground text-xs">订单费用</div>
                  <div class="text-foreground mt-1 truncate font-semibold">
                    {{ feeDisplay }}
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    {{
                      orderInfo.status >= 3 ? '已完成结算' : '以最终结算为准'
                    }}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card class="shadow-sm" :body-style="{ padding: '18px 20px 20px' }">
            <template #title>
              <div class="section-title">
                <span class="section-title__icon">
                  <IconifyIcon icon="lucide:clipboard-list" :size="17" />
                </span>
                <div>
                  <strong>订单信息</strong>
                  <small>申请与住宿服务信息</small>
                </div>
              </div>
            </template>

            <OrderDescriptions
              class="order-descriptions"
              :data="orderDescriptionData"
              size="small"
            />

            <div
              v-if="
                orderInfo.reason ||
                orderSnapshot?.additionalRequire?.flightNo ||
                orderSnapshot?.additionalRequire?.bedding ||
                orderSnapshot?.additionalRequire?.other
              "
              class="order-notes"
            >
              <div v-if="orderInfo.reason">
                <span>申请事由</span>
                <p>{{ orderInfo.reason }}</p>
              </div>
              <div
                v-if="
                  orderSnapshot?.additionalRequire?.flightNo ||
                  orderSnapshot?.additionalRequire?.bedding ||
                  orderSnapshot?.additionalRequire?.other
                "
              >
                <span>附加需求</span>
                <p>
                  <template v-if="orderSnapshot?.additionalRequire?.flightNo">
                    接机 / 航班号：{{
                      orderSnapshot.additionalRequire.flightNo
                    }}
                  </template>
                  <template v-if="orderSnapshot?.additionalRequire?.bedding">
                    <br v-if="orderSnapshot?.additionalRequire?.flightNo" />
                    床上用品：{{ orderSnapshot.additionalRequire.bedding }}
                  </template>
                  <template v-if="orderSnapshot?.additionalRequire?.other">
                    <br
                      v-if="
                        orderSnapshot?.additionalRequire?.flightNo ||
                        orderSnapshot?.additionalRequire?.bedding
                      "
                    />
                    其他：{{ orderSnapshot.additionalRequire.other }}
                  </template>
                </p>
              </div>
            </div>
          </Card>

          <Card
            v-if="receiptGroups.length > 0"
            class="receipt-card shadow-sm"
            :body-style="{ padding: '0 20px 20px' }"
          >
            <template #title>
              <div class="section-title">
                <span class="section-title__icon is-green">
                  <IconifyIcon icon="lucide:receipt-text" :size="17" />
                </span>
                <div>
                  <strong>结算清单</strong>
                  <small>订单费用凭证与明细</small>
                </div>
              </div>
            </template>
            <template #extra>
              <Tag color="green">已结算</Tag>
            </template>

            <div class="receipt-paper">
              <div class="receipt-paper__heading">
                <div>
                  <span>住宿订单费用清单</span>
                  <Typography.Text
                    class="font-mono text-xs"
                    :copyable="{ text: orderSerial }"
                  >
                    {{ orderSerial }}
                  </Typography.Text>
                </div>
                <div class="text-right">
                  <span>结算金额</span>
                  <strong>{{
                    formatMoney(receiptTotal, receiptCurrency)
                  }}</strong>
                </div>
              </div>

              <div
                v-for="group in receiptGroups"
                :key="group.subOrderSerial"
                class="receipt-group"
              >
                <div class="receipt-group__header">
                  <span>子订单</span>
                  <strong class="font-mono">{{ group.subOrderSerial }}</strong>
                </div>
                <div class="receipt-table__head">
                  <span>入住人 / 费用</span>
                  <span>单价 × 数量</span>
                  <span>金额</span>
                </div>
                <div
                  v-for="(fee, feeIndex) in group.feeItemList"
                  :key="`${fee.itemName}-${feeIndex}`"
                  class="receipt-line"
                >
                  <div>
                    <strong>{{ fee.itemName }}</strong>
                    <span>
                      {{ fee.userName || '入住人' }}
                      <template v-if="fee.remark"> · {{ fee.remark }}</template>
                    </span>
                  </div>
                  <div class="receipt-line__formula">
                    {{ formatMoney(fee.unitPrice, fee.settleCurrencyCode) }}
                    <span>× {{ fee.quantity ?? 0 }}</span>
                  </div>
                  <strong class="text-right">
                    {{
                      formatMoney(
                        fee.totalPrice ?? getFeeTotal(fee),
                        fee.settleCurrencyCode,
                      )
                    }}
                  </strong>
                </div>
              </div>

              <div class="receipt-paper__total">
                <span>费用合计</span>
                <strong>{{
                  formatMoney(receiptTotal, receiptCurrency)
                }}</strong>
              </div>
            </div>
          </Card>

          <Card
            class="stay-card shadow-sm"
            :body-style="{ padding: '16px 20px 20px' }"
          >
            <template #title>
              <div class="section-title">
                <span class="section-title__icon">
                  <IconifyIcon icon="lucide:bed-double" :size="17" />
                </span>
                <div>
                  <strong>入住信息</strong>
                  <small>共 {{ subOrders.length }} 条入住记录</small>
                </div>
              </div>
            </template>
            <template #extra>
              <Tag v-if="subOrders.length > 0" color="blue">
                {{ activeGuestCount }} 人当前有效
              </Tag>
            </template>

            <Table
              :columns="stayColumns"
              :data-source="subOrders"
              :pagination="false"
              :row-class-name="getStayRowClassName"
              bordered
              row-key="id"
              size="small"
              table-layout="fixed"
            >
              <template #emptyText>
                <Empty
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                  :description="
                    canManageOrder
                      ? '该订单尚未分配房间，请前往排房日历安排住宿人与床位'
                      : '该订单尚未分配房间，请等待宿管完成排房'
                  "
                >
                  <Button
                    v-if="canManageOrder"
                    type="primary"
                    ghost
                    @click="router.push('/dorm/scheduler')"
                  >
                    <IconifyIcon icon="lucide:calendar-range" />
                    前往排房日历
                  </Button>
                </Empty>
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'guest'">
                  <div class="guest-cell">
                    <Avatar
                      :size="28"
                      class="guest-cell__avatar"
                      :style="{ backgroundColor: '#e6f4ff', color: '#1677ff' }"
                    >
                      {{ getGuestInitial(record.userName) }}
                    </Avatar>
                    <div class="guest-cell__content">
                      <strong>{{ record.userName || '-' }}</strong>
                      <Typography.Text
                        class="guest-cell__serial"
                        :copyable="{ text: record.subOrderSerial }"
                      >
                        {{ record.subOrderSerial }}
                      </Typography.Text>
                      <span v-if="record.remark" class="guest-cell__remark">
                        备注：{{ record.remark }}
                      </span>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'room'">
                  <div class="text-foreground font-medium">
                    {{ record.roomSnapshot?.roomAlias ?? '待分配' }}
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    {{ getRoomType(record.roomSnapshot) }}
                  </div>
                </template>
                <template v-else-if="column.key === 'stayPeriod'">
                  <div class="stay-range">
                    <span>{{ formatDate(record.startTime) }}</span>
                    <IconifyIcon icon="lucide:arrow-right" :size="14" />
                    <span>{{ formatDate(record.endTime) }}</span>
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    共 {{ record.days ?? 0 }} 天
                  </div>
                </template>
                <template v-else-if="column.key === 'estimatedFee'">
                  <span
                    class="text-foreground whitespace-nowrap text-xs font-medium"
                  >
                    {{ getEstimatedFee(toDormSubOrder(record)) }}
                  </span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <Tag
                    :color="
                      SUB_ORDER_STATUS_MAP[record.status]?.color ?? 'default'
                    "
                  >
                    {{
                      SUB_ORDER_STATUS_MAP[record.status]?.text ?? record.status
                    }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <div v-if="record.status === 1" class="stay-actions">
                    <Button
                      size="small"
                      type="link"
                      class="!px-1"
                      v-auth="'dorm:room:update'"
                      @click="openChangeDate(toDormSubOrder(record))"
                    >
                      延期/提前退宿
                    </Button>
                    <Button
                      size="small"
                      type="link"
                      class="!px-1"
                      v-auth="'dorm:room:update'"
                      @click="openChangeRoom(toDormSubOrder(record))"
                    >
                      调房
                    </Button>
                    <Popconfirm
                      v-if="canCancel"
                      :title="`确定取消 ${record.userName || '该入住人'} 的订单？`"
                      ok-type="danger"
                      ok-text="确认取消"
                      cancel-text="暂不取消"
                      @confirm="handleCancelSubOrder(toDormSubOrder(record))"
                    >
                      <Button
                        size="small"
                        type="link"
                        danger
                        class="!px-1"
                        :loading="cancelling"
                        v-auth="'dorm:room:update'"
                      >
                        取消
                      </Button>
                    </Popconfirm>
                  </div>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </template>
              </template>
            </Table>
          </Card>
        </div>
      </template>

      <Card
        v-else-if="!loading"
        class="shadow-sm"
        :body-style="{ padding: '64px 16px' }"
      >
        <Empty
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="订单不存在或无权访问"
        >
          <Button @click="router.back()">返回订单列表</Button>
        </Empty>
      </Card>
    </Spin>

    <Modal
      v-model:open="settleOpen"
      title="订单结算"
      width="960px"
      ok-text="确认结算"
      cancel-text="取消"
      :confirm-loading="settling"
      :ok-button-props="{ disabled: !canSettle }"
      @ok="handleSettle"
    >
      <div class="modal-intro">
        <span class="modal-intro__icon is-green">
          <IconifyIcon icon="lucide:badge-dollar-sign" :size="20" />
        </span>
        <div>
          <strong>确认入住费用</strong>
          <p>支持新增自定义费用，提交前请确认名称、单价与数量。</p>
        </div>
      </div>
      <div
        v-for="(item, idx) in settleData.subOrderSettleInfo"
        :key="item.subOrderSerial || idx"
        class="settle-item"
      >
        <div class="settle-item__header">
          <div class="flex items-center gap-2">
            <Avatar :size="28" :style="{ backgroundColor: '#1677ff' }">
              {{ getGuestInitial(item.userName) }}
            </Avatar>
            <div>
              <div class="text-foreground font-medium">{{ item.userName }}</div>
              <div class="text-muted-foreground font-mono text-xs">
                {{ item.subOrderSerial }}
              </div>
            </div>
          </div>
          <Button size="small" type="dashed" @click="addFeeItem(idx)">
            <IconifyIcon icon="lucide:plus" />
            添加费用
          </Button>
        </div>
        <div
          v-for="(fee, fIdx) in item.feeItems"
          :key="`${item.subOrderSerial}-${fIdx}`"
          class="settle-item__fee"
        >
          <div class="settle-field settle-field--name">
            <label>费用名称</label>
            <AutoComplete
              v-model:value="fee.itemName"
              :options="FEE_NAME_OPTIONS"
              class="w-full"
              placeholder="选择或输入费用名称"
            />
          </div>
          <div class="settle-field">
            <label>单价</label>
            <InputNumber
              v-model:value="fee.unitPrice"
              :min="0"
              :max="10000"
              :precision="2"
              class="w-full"
            />
          </div>
          <div class="settle-field">
            <label>数量</label>
            <InputNumber
              v-model:value="fee.quantity"
              :min="0"
              :max="99999"
              :precision="0"
              class="w-full"
            />
          </div>
          <div class="settle-field settle-field--amount">
            <label>金额</label>
            <strong>
              {{ formatMoney(getFeeTotal(fee), fee.settleCurrencyCode) }}
            </strong>
          </div>
          <div class="settle-field settle-field--remark">
            <label>备注</label>
            <Input v-model:value="fee.remark" allow-clear placeholder="选填" />
          </div>
          <Tooltip title="删除此费用">
            <Button
              type="text"
              danger
              class="settle-item__delete"
              :disabled="item.feeItems.length <= 1"
              @click="removeFeeItem(idx, fIdx)"
            >
              <IconifyIcon icon="lucide:trash-2" :size="16" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="changeDateOpen"
      title="延期 / 提前退宿"
      ok-text="确认变更"
      cancel-text="取消"
      :confirm-loading="changingDate"
      :ok-button-props="{ disabled: !canSubmitDateChange }"
      @ok="handleChangeDate"
    >
      <div class="modal-intro">
        <span class="modal-intro__icon is-blue">
          <IconifyIcon icon="lucide:calendar-range" :size="20" />
        </span>
        <div>
          <strong>{{ changeDateRow?.userName || '入住记录' }}</strong>
          <p>入住日期保持不变；可延长住宿，也可提前释放床位。</p>
        </div>
      </div>
      <div class="space-y-4 pb-2">
        <div>
          <label class="mb-1 block text-sm font-medium">新退宿日期</label>
          <DatePicker
            :value="newEndDate ? dayjs(newEndDate) : undefined"
            :allow-clear="false"
            :disabled-date="disableNewEndDate"
            class="w-full"
            @change="handleNewEndDateChange"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">变更原因</label>
          <Input.TextArea
            v-model:value="changeDateReason"
            :rows="3"
            :maxlength="255"
            placeholder="请填写延期或提前退宿原因"
            show-count
          />
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="changeRoomOpen"
      title="调整入住房间"
      ok-text="确认调房"
      cancel-text="取消"
      :confirm-loading="changingRoom"
      :ok-button-props="{ disabled: !canSubmitRoomChange }"
      @ok="handleChangeRoom"
    >
      <div class="modal-intro">
        <span class="modal-intro__icon is-purple">
          <IconifyIcon icon="lucide:bed-double" :size="20" />
        </span>
        <div>
          <strong>
            {{ changeRoomRow?.userName || '入住记录' }}
            · {{ changeRoomRow?.roomSnapshot?.roomAlias || '未分配' }}
          </strong>
          <p>从生效日期开始切换到新床位，原床位记录会作为历史保留。</p>
        </div>
      </div>
      <div class="space-y-4 pb-2">
        <div>
          <label class="mb-1 block text-sm font-medium">调房生效日期</label>
          <DatePicker
            :value="
              changeRoomEffectiveDate
                ? dayjs(changeRoomEffectiveDate)
                : undefined
            "
            :allow-clear="false"
            :disabled-date="disableChangeRoomDate"
            class="w-full"
            @change="handleChangeRoomEffectiveDate"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">目标房间</label>
          <Spin :spinning="changeRoomLoading">
            <Select
              v-model:value="selectedNewRoomId"
              :options="changeRoomOptions"
              placeholder="请选择目标房间"
              class="w-full"
              show-search
              option-filter-prop="label"
              @change="handleChangeRoomSelection"
            />
          </Spin>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">目标床位</label>
          <Select
            v-model:value="selectedNewBedId"
            :disabled="!selectedNewRoomId"
            :options="changeRoomBedOptions"
            placeholder="请选择目标床位"
            class="w-full"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">调房原因</label>
          <Input.TextArea
            v-model:value="changeRoomReason"
            :rows="3"
            :maxlength="255"
            placeholder="请填写调房原因"
            show-count
          />
        </div>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 4px;
}

.order-hero {
  position: relative;
  border: 1px solid hsl(var(--border));
}

.order-hero__accent {
  height: 4px;
  background: linear-gradient(90deg, #1677ff, #36cfc9 58%, #9254de);
}

.order-hero__main {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
}

.order-hero__identity {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.order-hero__cover {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  color: #1677ff;
  background: #e6f4ff;
  border: 1px solid #bae0ff;
  border-radius: 12px;
}

.order-hero__cover :deep(.ant-image),
.order-hero__cover :deep(img) {
  width: 100%;
  height: 100%;
}

.order-hero__cover :deep(img) {
  object-fit: cover;
}

.order-hero__serial {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 5px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.order-hero__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.order-hero__progress {
  padding: 16px 24px 12px;
  background: hsl(var(--muted) / 30%);
  border-top: 1px solid hsl(var(--border));
}

.order-hero__progress :deep(.ant-steps) {
  max-width: 920px;
  margin: 0 auto;
}

.order-cancelled {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  max-width: 560px;
  padding: 10px 16px;
  margin: 0 auto;
  color: #cf1322;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
}

.order-cancelled__icon {
  display: flex;
  flex-shrink: 0;
}

.order-cancelled strong,
.order-cancelled p {
  display: block;
}

.order-cancelled p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #a8071a;
}

.summary-card {
  border: 1px solid hsl(var(--border));
}

.summary-card :deep(.ant-card-body) {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
}

.summary-card__icon,
.section-title__icon,
.modal-intro__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.summary-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
}

.is-blue {
  color: #1677ff;
  background: #e6f4ff;
}

.is-cyan {
  color: #08979c;
  background: #e6fffb;
}

.is-purple {
  color: #722ed1;
  background: #f9f0ff;
}

.is-green {
  color: #389e0d;
  background: #f6ffed;
}

.section-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.section-title__icon {
  width: 32px;
  height: 32px;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 8px;
}

.section-title__icon.is-green {
  color: #389e0d;
  background: #f6ffed;
}

.section-title strong,
.section-title small {
  display: block;
}

.section-title strong {
  color: hsl(var(--foreground));
  font-size: 15px;
  line-height: 1.35;
}

.section-title small {
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 400;
}

.order-descriptions :deep(.ant-descriptions-view) {
  overflow: hidden;
  border-radius: 8px;
}

.order-descriptions :deep(.ant-descriptions-item-label) {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 36%);
}

.order-notes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.order-notes > div {
  padding: 11px 13px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.order-notes span {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.order-notes p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: hsl(var(--foreground));
}

.receipt-paper {
  max-width: 980px;
  padding: 20px;
  margin: 0 auto;
  background:
    linear-gradient(135deg, hsl(var(--muted) / 24%) 0, transparent 36%),
    hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.receipt-paper__heading {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px dashed hsl(var(--border));
}

.receipt-paper__heading > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.receipt-paper__heading span {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.receipt-paper__heading strong {
  color: #389e0d;
  font-size: 20px;
}

.receipt-group {
  padding: 15px 0;
  border-bottom: 1px dashed hsl(var(--border));
}

.receipt-group__header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
}

.receipt-group__header span {
  color: hsl(var(--muted-foreground));
}

.receipt-table__head,
.receipt-line {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 200px 160px;
  gap: 16px;
  align-items: center;
}

.receipt-table__head {
  padding: 7px 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 38%);
  border-radius: 6px;
  font-size: 11px;
}

.receipt-table__head > :not(:first-child) {
  text-align: right;
}

.receipt-line {
  padding: 10px;
  border-bottom: 1px solid hsl(var(--border) / 60%);
  font-size: 13px;
}

.receipt-line:last-child {
  border-bottom: 0;
}

.receipt-line > div:first-child {
  min-width: 0;
}

.receipt-line > div:first-child strong,
.receipt-line > div:first-child span {
  display: block;
}

.receipt-line > div:first-child span {
  margin-top: 2px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.receipt-line__formula {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  color: hsl(var(--foreground));
}

.receipt-line__formula span {
  color: hsl(var(--muted-foreground));
}

.receipt-paper__total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  padding-top: 16px;
}

.receipt-paper__total span {
  margin-right: 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.receipt-paper__total strong {
  color: hsl(var(--foreground));
  font-size: 18px;
}

.stay-card :deep(.ant-table-container) {
  overflow: hidden;
  border-radius: var(--radius);
}

.stay-card :deep(.ant-table-tbody > .is-finished-row > td) {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 24%);
}

.guest-cell {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
  padding: 2px 0;
}

.guest-cell__avatar {
  flex-shrink: 0;
  font-weight: 600;
}

.guest-cell__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.4;
}

.guest-cell__content > strong {
  color: hsl(var(--foreground));
  font-size: 13px;
}

.guest-cell__serial {
  width: fit-content;
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.guest-cell__remark {
  max-width: 210px;
  margin-top: 2px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stay-range {
  display: flex;
  gap: 4px;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 12px;
  white-space: nowrap;
}

.stay-range svg {
  color: hsl(var(--muted-foreground));
}

.stay-actions {
  display: flex;
  gap: 2px;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.modal-intro {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  margin-bottom: 18px;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.modal-intro__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.modal-intro strong {
  color: hsl(var(--foreground));
}

.modal-intro p {
  margin: 2px 0 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.settle-item {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.settle-item:last-child {
  margin-bottom: 0;
}

.settle-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: hsl(var(--muted) / 28%);
  border-bottom: 1px solid hsl(var(--border));
}

.settle-item__fee {
  display: grid;
  grid-template-columns:
    minmax(150px, 1.2fr) minmax(100px, 0.7fr) minmax(90px, 0.55fr)
    minmax(130px, 0.8fr) minmax(150px, 1fr) 32px;
  gap: 12px;
  align-items: end;
  padding: 12px;
  font-size: 13px;
}

.settle-item__fee + .settle-item__fee {
  border-top: 1px solid hsl(var(--border));
}

.settle-field {
  width: 100%;
  min-width: 0;
}

.settle-field :deep(.ant-select),
.settle-field :deep(.ant-input-number) {
  width: 100%;
  min-width: 0;
}

.settle-field label {
  display: block;
  margin-bottom: 5px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.settle-field--amount strong {
  display: flex;
  align-items: center;
  min-height: 32px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.settle-item__delete {
  margin-bottom: 1px;
}

@media (max-width: 900px) {
  .order-hero__main {
    align-items: flex-start;
  }

  .order-hero__actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .receipt-table__head,
  .receipt-line {
    grid-template-columns: minmax(160px, 1fr) 160px 130px;
  }

  .settle-item__fee {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settle-item__delete {
    justify-self: end;
  }
}

@media (max-width: 720px) {
  .order-hero__main {
    flex-direction: column;
    padding: 16px;
  }

  .order-hero__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .order-hero__progress {
    padding-right: 12px;
    padding-left: 12px;
  }

  .order-notes {
    grid-template-columns: 1fr;
  }

  .receipt-paper {
    padding: 14px;
  }

  .receipt-table__head {
    display: none;
  }

  .receipt-line {
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
  }

  .receipt-line > div:first-child {
    grid-column: 1 / -1;
  }

  .settle-item__fee {
    grid-template-columns: 1fr;
  }

  .settle-item__delete {
    justify-self: start;
  }
}

@media (max-width: 480px) {
  .order-hero__cover {
    display: none;
  }

  .order-hero__actions > * {
    flex: 1;
  }
}
</style>
