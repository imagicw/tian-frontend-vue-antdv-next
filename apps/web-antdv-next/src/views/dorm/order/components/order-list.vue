<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';
import { formatDate } from '@vben/utils';

import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DateRangePicker,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  TabPane,
  Tabs,
  Typography,
} from 'antdv-next';
import dayjs from 'dayjs';

import { cancelDormOrder, getMyOrderPage, getOrderPage } from '#/api/dorm';
import { getSimpleUserList } from '#/api/system/user';
import AllocationForm from '#/views/dorm/allocation/modules/allocation-form.vue';

type OrderListMode = 'admin' | 'my';

const props = defineProps<{
  mode: OrderListMode;
}>();

const router = useRouter();
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();

const loading = ref(false);
const cancellingSerial = ref<string>();
const orders = ref<DormApi.DormOrder[]>([]);
const total = ref(0);
const users = ref<SystemUserApi.User[]>([]);
const queryFormRef = ref();
const activeStatus = ref('all');
const failedImages = reactive(new Set<string>());
const selectedSerials = ref(new Set<string>());

const [AllocationModal, allocationModalApi] = useVbenModal({
  connectedComponent: AllocationForm,
  destroyOnClose: true,
});

const queryParams = reactive({
  createTime: undefined as [string, string] | undefined,
  orderSerial: undefined as string | undefined,
  pageNo: 1,
  pageSize: 9,
  status: undefined as number | undefined,
  userId: undefined as number | undefined,
});

const isAdmin = computed(() => props.mode === 'admin');
const canManageOrders = computed(
  () => isAdmin.value && hasAccessByCodes(['dorm:room:update']),
);
const canAllocateFee = computed(
  () => isAdmin.value && hasAccessByCodes(['dorm:dept-fee-allocation:allocate']),
);
const pageTitle = computed(() => (isAdmin.value ? '住宿订单' : '我的订单'));

const selectedOrders = computed(() =>
  orders.value.filter(
    (order) => order.orderSerial && selectedSerials.value.has(order.orderSerial),
  ),
);

const userOptions = computed(() =>
  users.value.map((user) => ({
    label: user.nickname || user.username,
    value: user.id,
  })),
);

const statusTabs = [
  { key: 'all', label: '全部订单' },
  { key: '0', label: '待分配' },
  { key: '1', label: '已预订' },
  { key: '3', label: '已结算' },
  { key: '4', label: '已分摊' },
  { key: '2', label: '已取消' },
];

const progressSteps = [
  { title: '待分配' },
  { title: '已预订' },
  { title: '已结算' },
  { title: '已分摊' },
];

async function getList() {
  loading.value = true;
  try {
    const request = isAdmin.value ? getOrderPage : getMyOrderPage;
    const data = await request(queryParams);
    orders.value = data.list ?? [];
    total.value = data.total ?? 0;
    selectedSerials.value.clear();
  } finally {
    loading.value = false;
  }
}

function canSelectOrder(order: DormApi.DormOrder) {
  return canAllocateFee.value && order.status === 3;
}

function isSelected(order: DormApi.DormOrder) {
  return !!order.orderSerial && selectedSerials.value.has(order.orderSerial);
}

function toggleSelect(order: DormApi.DormOrder) {
  if (!order.orderSerial || !canSelectOrder(order)) return;
  if (selectedSerials.value.has(order.orderSerial)) {
    selectedSerials.value.delete(order.orderSerial);
  } else {
    selectedSerials.value.add(order.orderSerial);
  }
}

function clearSelection() {
  selectedSerials.value.clear();
}

function handleStartAllocation() {
  if (selectedOrders.value.length === 0) {
    message.warning('请先选择需要分摊的订单');
    return;
  }
  const currencies = new Set(
    selectedOrders.value.map((order) => order.settleCurrencyCode),
  );
  if (currencies.size > 1) {
    message.error('所选订单存在多个币种，请选择相同币种的订单');
    return;
  }
  const areas = new Set(
    selectedOrders.value.map((order) => order.dormOrderSnapshot?.areaName),
  );
  if (areas.size > 1) {
    message.error('所选订单存在多个区域，请选择相同区域的订单');
    return;
  }
  const orders = selectedOrders.value.map((order) => ({
    ...order,
    userName: order.userName || getApplicant(order).name,
  }));
  allocationModalApi.setData({ orders }).open();
}

function handleAllocationSuccess() {
  clearSelection();
  getList();
}

async function loadUsers() {
  if (!isAdmin.value) return;
  try {
    users.value = await getSimpleUserList();
  } catch {
    users.value = [];
  }
}

function handleQuery() {
  queryParams.pageNo = 1;
  getList();
}

function handleReset() {
  queryFormRef.value?.resetFields();
  activeStatus.value = 'all';
  queryParams.status = undefined;
  handleQuery();
}

function handleStatusChange(key: number | string) {
  const normalizedKey = String(key);
  activeStatus.value = normalizedKey;
  queryParams.status =
    normalizedKey === 'all' ? undefined : Number(normalizedKey);
  handleQuery();
}

function handlePageChange(pageNo: number, pageSize: number) {
  queryParams.pageNo = pageNo;
  queryParams.pageSize = pageSize;
  getList();
}

function openDetail(order: DormApi.DormOrder) {
  if (!order.orderSerial) return;
  router.push(`/dorm/order/${order.orderSerial}`);
}

async function handleCancel(order: DormApi.DormOrder) {
  if (!order.orderSerial) return;
  cancellingSerial.value = order.orderSerial;
  try {
    await cancelDormOrder({ orderSerial: order.orderSerial });
    message.success('订单已取消');
    await getList();
  } finally {
    cancellingSerial.value = undefined;
  }
}

function getApplicant(order: DormApi.DormOrder) {
  if (
    !isAdmin.value ||
    String(order.userId ?? '') === String(userStore.userInfo?.id ?? '')
  ) {
    return {
      avatar: userStore.userInfo?.avatar,
      name: userStore.userInfo?.nickname || '本人',
    };
  }
  const user = users.value.find(
    (item) => String(item.id) === String(order.userId),
  );
  return {
    avatar: user?.avatar,
    name:
      order.userName ||
      user?.nickname ||
      user?.username ||
      `用户 ${order.userId ?? '-'}`,
  };
}

function getApplicantInitial(order: DormApi.DormOrder) {
  return getApplicant(order).name.trim().slice(0, 1).toUpperCase() || '住';
}

function getBuildingName(order: DormApi.DormOrder) {
  const snapshot = order.dormOrderSnapshot;
  return snapshot?.buildName || snapshot?.areaName || '住宿地点待确认';
}

function getLocationCaption(order: DormApi.DormOrder) {
  const snapshot = order.dormOrderSnapshot;
  if (snapshot?.areaName && snapshot?.buildName) {
    return `${snapshot.areaName} · ${snapshot.buildName}`;
  }
  return snapshot?.areaName || snapshot?.buildName || '等待分配住宿地点';
}

function getOrderImage(order: DormApi.DormOrder) {
  return order.dormOrderSnapshot?.images?.find(Boolean);
}

function handleImageError(url?: string) {
  if (url) failedImages.add(url);
}

function getGuestNames(order: DormApi.DormOrder) {
  return (
    order.dormOrderSnapshot?.checkInInfo
      ?.flatMap((group) => group.checkInPersons ?? [])
      .map((person) => person.name)
      .filter(Boolean) ?? []
  );
}

function getGuestSummary(order: DormApi.DormOrder) {
  const names = getGuestNames(order);
  if (names.length === 0) return '未填写入住人员';
  if (names.length <= 3) return names.join('、');
  return `${names.slice(0, 3).join('、')} 等 ${names.length} 人`;
}

function getStartTime(order: DormApi.DormOrder) {
  return (
    order.serveStartTime || order.dormOrderSnapshot?.serveStartTime || undefined
  );
}

function getEndTime(order: DormApi.DormOrder) {
  return (
    order.serveEndTime || order.dormOrderSnapshot?.serveEndTime || undefined
  );
}

function formatServiceDate(value?: string) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value;
}

function getOrderDays(order: DormApi.DormOrder) {
  if (order.dormOrderSnapshot?.serveDays !== undefined) {
    return order.dormOrderSnapshot.serveDays;
  }
  const start = dayjs(getStartTime(order));
  const end = dayjs(getEndTime(order));
  if (!start.isValid() || !end.isValid()) return '-';
  return Math.max(end.startOf('day').diff(start.startOf('day'), 'day'), 0);
}

function formatCreatedAt(value?: number | string) {
  if (value === undefined || value === null || value === '') return '-';
  return formatDate(value, 'YYYY-MM-DD HH:mm') || '-';
}

function formatFee(order: DormApi.DormOrder) {
  if (order.orderFee === undefined || order.orderFee === null) return '待结算';
  const amount = Number(order.orderFee);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString('zh-CN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : String(order.orderFee);
  return `${order.settleCurrencyCode || ''} ${formatted}`.trim();
}

function getProgressStep(status: number) {
  if (status === 4) return 3;
  if (status === 3) return 2;
  if (status === 1) return 1;
  return 0;
}

onMounted(() => {
  getList();
  loadUsers();
});
</script>

<template>
  <Page auto-content-height>
    <AllocationModal @success="handleAllocationSuccess" />
    <div class="flex h-full flex-col gap-3 overflow-hidden">
      <Card
        class="order-toolbar shrink-0 shadow-sm"
        :body-style="{ padding: '18px 20px 0' }"
      >
        <div class="order-toolbar__heading">
          <h2>{{ pageTitle }}</h2>
          <div v-if="canAllocateFee" class="ml-auto flex items-center gap-2">
            <span v-if="selectedSerials.size > 0" class="text-muted-foreground text-sm">
              已选 {{ selectedSerials.size }} 个订单
            </span>
            <Button v-if="selectedSerials.size > 0" @click="clearSelection">
              取消选择
            </Button>
            <Button
              type="primary"
              :disabled="selectedSerials.size === 0"
              @click="handleStartAllocation"
            >
              <IconifyIcon icon="lucide:split" />
              发起费用分摊
            </Button>
          </div>
        </div>

        <Form
          ref="queryFormRef"
          :model="queryParams"
          class="order-filter"
          layout="inline"
          @finish="handleQuery"
        >
          <FormItem name="orderSerial" label="订单号">
            <Input
              v-model:value="queryParams.orderSerial"
              allow-clear
              placeholder="请输入完整订单号"
              @press-enter="handleQuery"
            />
          </FormItem>
          <FormItem v-if="isAdmin" name="userId" label="申请人">
            <Select
              v-model:value="queryParams.userId"
              :options="userOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="请选择申请人"
            />
          </FormItem>
          <FormItem name="createTime" label="下单时间">
            <DateRangePicker
              v-model:value="queryParams.createTime"
              allow-clear
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
            />
          </FormItem>
          <FormItem class="order-filter__actions">
            <Space>
              <Button html-type="submit" type="primary">
                <IconifyIcon icon="lucide:search" />
                查询
              </Button>
              <Button @click="handleReset">
                <IconifyIcon icon="lucide:rotate-ccw" />
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>

        <Tabs
          :active-key="activeStatus"
          class="order-status-tabs"
          @change="handleStatusChange"
        >
          <TabPane v-for="tab in statusTabs" :key="tab.key" :tab="tab.label" />
        </Tabs>
      </Card>

      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-1">
        <Spin :spinning="loading">
          <Card
            v-if="!loading && orders.length === 0"
            class="shadow-sm"
            :body-style="{ padding: '48px 16px' }"
          >
            <Empty
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
              :description="
                queryParams.orderSerial ||
                queryParams.userId ||
                queryParams.createTime ||
                queryParams.status !== undefined
                  ? '没有找到符合条件的住宿订单'
                  : '暂无住宿订单'
              "
            />
          </Card>

          <Row v-else :gutter="[16, 16]">
            <Col
              v-for="order in orders"
              :key="order.id ?? order.orderSerial"
              class="min-w-0"
              :xs="24"
              :xxl="8"
            >
              <Card
                class="order-card h-full overflow-hidden shadow-sm"
                :class="{ 'order-card--selected': isSelected(order) }"
                hoverable
                :body-style="{
                  padding: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }"
                @click="openDetail(order)"
              >
                <div
                  v-if="canSelectOrder(order)"
                  class="order-card__select"
                  @click.stop="toggleSelect(order)"
                >
                  <Checkbox :checked="isSelected(order)" />
                </div>

                <div
                  v-if="
                    getOrderImage(order) &&
                    !failedImages.has(getOrderImage(order)!)
                  "
                  class="order-card__watermark"
                  aria-hidden="true"
                >
                  <img
                    :src="getOrderImage(order)"
                    alt=""
                    @error="handleImageError(getOrderImage(order))"
                  />
                </div>

                <div class="order-card__content">
                  <div class="order-card__main min-w-0">
                    <div class="order-card__main-header">
                      <div class="order-card__identity min-w-0">
                        <div
                          class="text-foreground truncate text-base font-semibold"
                          :title="getBuildingName(order)"
                        >
                          {{ getBuildingName(order) }}
                        </div>
                        <div
                          class="text-muted-foreground mt-0.5 truncate text-xs"
                          :title="getLocationCaption(order)"
                        >
                          {{ getLocationCaption(order) }}
                        </div>

                        <div class="order-card__serial-row" @click.stop>
                          <span>订单号</span>
                          <Typography.Text
                            class="order-card__serial"
                            :copyable="
                              order.orderSerial
                                ? { text: order.orderSerial }
                                : false
                            "
                          >
                            {{ order.orderSerial || '暂无订单号' }}
                          </Typography.Text>
                        </div>
                      </div>

                      <div class="order-card__progress" @click.stop>
                        <div
                          v-if="order.status === 2"
                          class="order-card__cancelled"
                        >
                          <IconifyIcon icon="lucide:circle-x" :size="15" />
                          订单已取消
                        </div>
                        <div v-else class="order-card__status-track">
                          <div
                            v-for="(step, index) in progressSteps"
                            :key="step.title"
                            class="order-card__status-step"
                            :class="{
                              'is-complete':
                                index < getProgressStep(order.status),
                              'is-current':
                                index === getProgressStep(order.status),
                            }"
                          >
                            <span class="order-card__status-dot"></span>
                            <span>{{ step.title }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="order-card__period">
                      <div>
                        <span>
                          <IconifyIcon icon="lucide:log-in" :size="14" />
                          入住
                        </span>
                        <strong>{{
                          formatServiceDate(getStartTime(order))
                        }}</strong>
                      </div>
                      <div class="order-card__period-line">
                        <span>{{ getOrderDays(order) }} 天</span>
                      </div>
                      <div class="text-right">
                        <span class="justify-end">
                          <IconifyIcon icon="lucide:log-out" :size="14" />
                          退宿
                        </span>
                        <strong>{{
                          formatServiceDate(getEndTime(order))
                        }}</strong>
                      </div>
                    </div>

                    <div class="order-card__inline-meta">
                      <div
                        class="order-card__meta-item"
                        :title="getGuestNames(order).join('、')"
                      >
                        <IconifyIcon icon="lucide:users" :size="14" />
                        <span>
                          <small>入住人员</small>
                          <strong>{{ getGuestSummary(order) }}</strong>
                        </span>
                      </div>
                      <div class="order-card__meta-item" :title="order.reason">
                        <IconifyIcon
                          icon="lucide:message-square-text"
                          :size="14"
                        />
                        <span>
                          <small>申请事由</small>
                          <strong>{{ order.reason || '未填写' }}</strong>
                        </span>
                      </div>
                      <div class="order-card__meta-item">
                        <IconifyIcon
                          icon="lucide:circle-dollar-sign"
                          :size="14"
                        />
                        <span>
                          <small>订单费用</small>
                          <strong>{{ formatFee(order) }}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="order-card__footer" @click.stop>
                  <div class="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      :src="getApplicant(order).avatar"
                      :style="{
                        backgroundColor: getApplicant(order).avatar
                          ? undefined
                          : '#1677ff',
                      }"
                      :size="32"
                    >
                      {{ getApplicantInitial(order) }}
                    </Avatar>
                    <div class="min-w-0">
                      <div class="text-foreground truncate text-sm font-medium">
                        {{ getApplicant(order).name }}
                      </div>
                      <div class="text-muted-foreground text-xs">
                        下单于 {{ formatCreatedAt(order.createTime) }}
                      </div>
                    </div>
                  </div>

                  <div class="ml-auto flex shrink-0 items-center gap-1">
                    <Popconfirm
                      v-if="canManageOrders && order.status <= 1"
                      title="确定取消这个住宿订单吗？"
                      ok-text="确认取消"
                      cancel-text="暂不取消"
                      ok-type="danger"
                      @confirm="handleCancel(order)"
                    >
                      <Button
                        danger
                        type="text"
                        :loading="cancellingSerial === order.orderSerial"
                      >
                        取消订单
                      </Button>
                    </Popconfirm>
                    <Button type="text" @click="openDetail(order)">
                      查看订单
                      <IconifyIcon icon="lucide:arrow-up-right" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Spin>
      </div>

      <Card
        v-if="total > 0"
        class="shrink-0 shadow-sm"
        size="small"
        :body-style="{ padding: '12px 16px' }"
      >
        <div class="order-pagination">
          <span class="text-muted-foreground text-sm">
            共 {{ total }} 条订单
          </span>
          <div>
            <Pagination
              v-model:current="queryParams.pageNo"
              v-model:page-size="queryParams.pageSize"
              :total="total"
              :page-size-options="['9', '18', '36']"
              show-size-changer
              show-less-items
              @change="handlePageChange"
            />
          </div>
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.order-toolbar {
  border: 1px solid hsl(var(--border));
}

.order-toolbar__heading {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

.order-toolbar__heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.order-filter {
  display: flex;
  gap: 8px 0;
}

.order-filter :deep(.ant-form-item) {
  margin-right: 16px;
}

.order-filter :deep(.ant-input),
.order-filter :deep(.ant-select) {
  min-width: 210px;
}

.order-filter :deep(.ant-picker) {
  width: 330px;
}

.order-filter__actions {
  margin-right: 0 !important;
  margin-left: auto;
}

.order-status-tabs {
  margin-top: 4px;
}

.order-status-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.order-card {
  position: relative;
  border: 1px solid hsl(var(--border));
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.order-card:hover {
  border-color: rgb(22 119 255 / 35%);
  transform: translateY(-1px);
}

.order-card--selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 18%);
}

.order-card__select {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: hsl(var(--card) / 92%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  backdrop-filter: blur(3px);
}

.order-card__content {
  position: relative;
  z-index: 1;
  padding: 16px;
}

.order-card__watermark {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 0;
  width: 52%;
  min-width: 260px;
  max-width: 520px;
  height: 180px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.38;
  mask-image: linear-gradient(to right, transparent 0%, #000 48%, #000 100%);
}

.order-card__watermark::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(
    to bottom,
    transparent 45%,
    hsl(var(--card)) 100%
  );
}

.order-card__watermark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.order-card__main-header {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
}

.order-card__identity {
  flex: 1;
}

.order-card__serial-row {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 6px;
}

.order-card__serial-row > span {
  flex-shrink: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.order-card__serial {
  display: inline-flex;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.order-card__period {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: end;
  padding: 9px 12px;
  margin-top: 10px;
  background: hsl(var(--muted) / 42%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.order-card__period > div:first-child,
.order-card__period > div:last-child {
  min-width: 0;
}

.order-card__period span {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.order-card__period strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.order-card__period-line {
  display: flex;
  align-items: center;
  min-width: 52px;
  padding-bottom: 2px;
}

.order-card__period-line::before,
.order-card__period-line::after {
  flex: 1;
  width: 12px;
  height: 1px;
  content: '';
  background: hsl(var(--border));
}

.order-card__period-line span {
  flex-shrink: 0;
  padding: 0 5px;
  font-size: 12px;
  color: #1677ff;
}

.order-card__inline-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.order-card__inline-meta > div {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  min-width: 0;
  padding: 6px 8px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 25%);
  border-radius: 6px;
}

.order-card__inline-meta svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.order-card__meta-item > span {
  min-width: 0;
}

.order-card__meta-item small,
.order-card__meta-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-card__meta-item small {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.order-card__meta-item strong {
  margin-top: 1px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.order-card__progress {
  flex: 0 1 224px;
  width: 224px;
  min-width: 180px;
  max-width: 46%;
  padding: 8px 10px;
  background: hsl(var(--card) / 68%);
  border: 1px solid hsl(var(--border) / 72%);
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.order-card__status-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
}

.order-card__status-step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  min-width: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.order-card__status-step:not(:last-child)::before {
  position: absolute;
  top: 5px;
  right: calc(-50% + 8px);
  left: calc(50% + 8px);
  z-index: 0;
  height: 2px;
  content: '';
  background: hsl(var(--border));
}

.order-card__status-step.is-complete::before {
  background: #1677ff;
}

.order-card__status-dot {
  z-index: 1;
  width: 11px;
  height: 11px;
  background: hsl(var(--background));
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
}

.order-card__status-step.is-complete,
.order-card__status-step.is-current {
  font-weight: 600;
  color: #1677ff;
}

.order-card__status-step.is-complete .order-card__status-dot,
.order-card__status-step.is-current .order-card__status-dot {
  background: #1677ff;
  border-color: #1677ff;
}

.order-card__status-step.is-current .order-card__status-dot {
  box-shadow: 0 0 0 3px rgb(22 119 255 / 14%);
}

.order-card__cancelled {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  height: 30px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  border-radius: 6px;
}

.order-card__footer {
  display: flex;
  gap: 16px;
  align-items: center;
  min-height: 56px;
  padding: 9px 12px 9px 16px;
  margin-top: auto;
  background: hsl(var(--muted) / 22%);
  border-top: 1px solid hsl(var(--border));
}

.order-pagination {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

@media (width <= 900px) {
  .order-filter__actions {
    margin-left: 0;
  }

  .order-card__content {
    padding-inline: 14px;
  }

  .order-card__watermark {
    width: 56%;
    min-width: 240px;
    height: 170px;
  }

  .order-card__main-header {
    flex-direction: column;
    gap: 10px;
  }

  .order-card__progress {
    flex-basis: auto;
    width: 100%;
    min-width: 0;
    max-width: none;
  }
}

@media (width <= 640px) {
  .order-toolbar :deep(.ant-card-body) {
    padding-inline: 14px !important;
  }

  .order-toolbar__heading {
    align-items: center;
  }

  .order-filter {
    display: block;
  }

  .order-filter :deep(.ant-form-item),
  .order-filter :deep(.ant-form-item-control),
  .order-filter :deep(.ant-input),
  .order-filter :deep(.ant-select),
  .order-filter :deep(.ant-picker) {
    width: 100%;
    min-width: 0;
  }

  .order-card__content {
    padding: 14px;
  }

  .order-card__watermark {
    width: 62%;
    min-width: 190px;
    height: 150px;
    opacity: 0.3;
  }

  .order-card__period {
    grid-template-columns: 1fr auto 1fr;
  }

  .order-card__inline-meta {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .order-card__main-header {
    gap: 8px;
  }

  .order-card__progress {
    padding-inline: 10px;
  }

  .order-card__status-step {
    font-size: 10px;
  }

  .order-card__footer {
    gap: 8px;
  }

  .order-card__footer > :last-child {
    margin-left: auto;
  }

  .order-card__footer > :last-child .ant-btn {
    padding-inline: 6px;
  }

  .order-pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
