<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Empty,
  Input,
  message,
  Modal,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  createBookingChange,
  getBookingDetail,
  getPendingBookingChange,
  publishBookingChange,
  saveBookingChangeHeader,
  withdrawBookingChange,
} from '#/api/shipment';

import {
  BOOKING_CHANGE_ORDER_ACTION_MAP,
  BOOKING_STATUS_MAP,
} from '../booking/data';
import OrderForm from './modules/order-form.vue';

const route = useRoute();
const bookingId = computed(() => Number(route.query.bookingId));
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();

const loading = ref(false);
const booking = ref<ShipmentApi.ShipmentBooking>();
const change = ref<ShipmentApi.BookingChange>();

const currentUserId = computed(() => String(userStore.userInfo?.id ?? ''));
const canPublishPermission = computed(() =>
  hasAccessByCodes(['container:booking:change:publish']),
);
const canWithdrawWholeDraft = computed(() => {
  if (!change.value) return false;
  return (
    currentUserId.value === String(change.value.initiatorId ?? '') ||
    currentUserId.value === String(booking.value?.applicantId ?? '') ||
    canPublishPermission.value
  );
});
const canPublishDraft = computed(() => {
  if (!change.value) return false;
  return (
    currentUserId.value === String(booking.value?.applicantId ?? '') ||
    canPublishPermission.value
  );
});

const orderColumns = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: '责任业务员', dataIndex: 'salesUserName', key: 'salesUserName' },
  { title: '总数量', dataIndex: 'totalQty', key: 'totalQty' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  { title: '变更状态', key: 'changeStatus' },
  { title: '操作', key: 'actions' },
];

function changeOrderFor(orderId: number) {
  return change.value?.orders.find((item) => item.orderId === orderId);
}
function isOwnOrder(order: ShipmentApi.ShipmentOrder) {
  return currentUserId.value === String(order.creator ?? '');
}

async function loadAll() {
  if (!bookingId.value) return;
  loading.value = true;
  try {
    const [bookingResult, changeResult] = await Promise.all([
      getBookingDetail(bookingId.value),
      getPendingBookingChange(bookingId.value),
    ]);
    booking.value = bookingResult;
    change.value = changeResult;
    resetHeaderForm();
  } finally {
    loading.value = false;
  }
}
onMounted(loadAll);

// ---- 发起变更 ----
const createReason = ref('');
async function submitCreateChange() {
  if (!createReason.value.trim()) {
    message.warning('请填写发起变更的原因');
    return;
  }
  if (!bookingId.value) return;
  await createBookingChange(bookingId.value, createReason.value.trim());
  message.success('已发起待发布变更');
  createReason.value = '';
  await loadAll();
}

// ---- 撤回整份变更 ----
function confirmWithReason(
  title: string,
  label: string,
  onOk: (reason: string) => Promise<void>,
) {
  let reason = '';
  Modal.confirm({
    title,
    content: h(Input.TextArea, {
      placeholder: `请输入${label}`,
      rows: 3,
      onChange: (e: Event) => {
        reason = (e.target as HTMLTextAreaElement).value;
      },
    }),
    async onOk() {
      if (!reason.trim()) {
        message.warning(`请输入${label}`);
        throw new Error('reason required');
      }
      await onOk(reason);
    },
  });
}

function withdrawWholeDraft() {
  if (!change.value) return;
  const changeId = change.value.id;
  confirmWithReason('撤回整份变更？', '撤回原因', async (reason) => {
    await withdrawBookingChange({ changeId, reason });
    message.success('变更已撤回');
    await loadAll();
  });
}

function withdrawOrderChange(order: ShipmentApi.ShipmentOrder) {
  if (!change.value) return;
  const changeId = change.value.id;
  confirmWithReason(
    `撤回「${order.poNo}」的本次改动？`,
    '撤回原因',
    async (reason) => {
      await withdrawBookingChange({ changeId, orderId: order.id, reason });
      message.success('已撤回该 PO 的改动');
      await loadAll();
    },
  );
}

async function publishDraft() {
  if (!change.value) return;
  const changeId = change.value.id;
  Modal.confirm({
    title: '确认发布该变更？',
    content: '发布前会重新校验分柜完整性与柜容，校验失败将不会生效。',
    async onOk() {
      await publishBookingChange(changeId);
      message.success('变更已发布');
      await loadAll();
    },
  });
}

// ---- 订舱头编辑 ----
const headerForm = ref<{
  blNo?: string;
  ccUserIds?: string;
  closingDate?: string;
  ensDate?: string;
  freightForwarder: string;
  productionCountry: string;
  remarks?: string;
  vesselDate?: string;
}>({ freightForwarder: '', productionCountry: '' });
const headerReason = ref('');

function resetHeaderForm() {
  const source = change.value?.proposedBooking ?? booking.value;
  headerForm.value = {
    freightForwarder: source?.freightForwarder ?? '',
    productionCountry: source?.productionCountry ?? '',
    blNo: source?.blNo,
    ensDate: source?.ensDate,
    vesselDate: source?.vesselDate,
    closingDate: source?.closingDate,
    ccUserIds: source?.ccUserIds,
    remarks: source?.remarks,
  };
  headerReason.value = '';
}

async function saveHeader() {
  if (!change.value) return;
  if (!headerForm.value.freightForwarder.trim()) {
    message.warning('请填写货代');
    return;
  }
  if (!headerForm.value.productionCountry.trim()) {
    message.warning('请填写生产国家');
    return;
  }
  if (!headerReason.value.trim()) {
    message.warning('请填写本次头信息改动原因');
    return;
  }
  // change/header/save 是整体覆盖写入（不是按字段合并），因此必须始终提交完整的
  // 头信息字段集合——headerForm 已在 resetHeaderForm 中从"当前草稿提议值或现有
  // 订舱头"完整预填充，这里直接整体提交即可，不会意外清空未展示的字段。
  await saveBookingChangeHeader({
    changeId: change.value.id,
    ...headerForm.value,
    reason: headerReason.value.trim(),
  });
  message.success('已保存订舱头改动');
  await loadAll();
}

// ---- PO 编辑弹窗 ----
const [OrderFormModal, orderFormModalApi] = useVbenModal({
  connectedComponent: OrderForm,
  destroyOnClose: true,
});
function editOrder(order: ShipmentApi.ShipmentOrder) {
  if (!change.value) return;
  const proposed = changeOrderFor(order.id)?.proposedOrder ?? order;
  orderFormModalApi
    .setData({ changeId: change.value.id, order: proposed })
    .open();
}
</script>

<template>
  <Page auto-content-height title="订舱变更协作">
    <OrderFormModal @success="loadAll" />
    <Spin :spinning="loading">
      <div v-if="!bookingId" class="p-8 text-center text-gray-400">
        请通过订舱管理页面进入变更协作（需要 bookingId 参数）
      </div>
      <div v-else-if="booking" class="space-y-4">
        <Descriptions :column="3" size="small" bordered>
          <DescriptionsItem label="订舱号">
            {{ booking.bookingNo }}
          </DescriptionsItem>
          <DescriptionsItem label="客户">
            {{ booking.clientName || booking.clientCode }}
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag :color="BOOKING_STATUS_MAP[booking.status]?.color">
              {{ BOOKING_STATUS_MAP[booking.status]?.text ?? booking.status }}
            </Tag>
          </DescriptionsItem>
        </Descriptions>

        <div class="rounded-lg border p-4">
          <div v-if="!change" class="space-y-3">
            <div class="text-muted-foreground text-sm">
              当前没有待发布变更。发起变更后，同一订舱同时最多存在一份待发布变更。
            </div>
            <Input.TextArea
              v-model:value="createReason"
              :rows="2"
              :maxlength="255"
              placeholder="请填写发起变更的原因"
            />
            <Button type="primary" @click="submitCreateChange">
              发起变更
            </Button>
          </div>
          <div v-else class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-sm">
                <strong>待发布变更</strong>
                <span class="text-muted-foreground ml-2">
                  发起人：{{ change.initiatorName || change.initiatorId }}
                </span>
                <span class="text-muted-foreground ml-2">
                  原因：{{ change.reason }}
                </span>
              </div>
              <div class="space-x-2">
                <Button
                  v-if="canWithdrawWholeDraft"
                  danger
                  @click="withdrawWholeDraft"
                >
                  撤回整份变更
                </Button>
                <Button
                  v-if="canPublishDraft"
                  type="primary"
                  @click="publishDraft"
                >
                  发布变更
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="change" class="rounded-lg border p-4">
          <div class="mb-3 text-sm font-medium">订舱头信息（变更）</div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div class="mb-1 text-xs">货代</div>
              <Input v-model:value="headerForm.freightForwarder" />
            </div>
            <div>
              <div class="mb-1 text-xs">生产国家</div>
              <Input v-model:value="headerForm.productionCountry" />
            </div>
            <div>
              <div class="mb-1 text-xs">提单号</div>
              <Input v-model:value="headerForm.blNo" />
            </div>
            <div>
              <div class="mb-1 text-xs">截关日</div>
              <DatePicker
                v-model:value="headerForm.closingDate"
                value-format="YYYY-MM-DD"
                class="w-full"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="mb-1 text-xs">编辑原因</div>
            <Input.TextArea
              v-model:value="headerReason"
              :rows="2"
              :maxlength="255"
              placeholder="请填写本次头信息改动原因"
            />
          </div>
          <Button class="mt-3" @click="saveHeader">保存订舱头改动</Button>
        </div>

        <Table
          :data-source="booking.orders ?? []"
          :columns="orderColumns"
          row-key="id"
          size="small"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'changeStatus'">
              <Tag
                v-if="changeOrderFor(record.id)"
                :color="
                  BOOKING_CHANGE_ORDER_ACTION_MAP[
                    changeOrderFor(record.id)!.action
                  ]?.color
                "
              >
                {{
                  BOOKING_CHANGE_ORDER_ACTION_MAP[
                    changeOrderFor(record.id)!.action
                  ]?.text
                }}
              </Tag>
              <span v-else class="text-muted-foreground text-xs">无改动</span>
            </template>
            <template v-else-if="column.key === 'actions' && change">
              <template v-if="isOwnOrder(record)">
                <Button type="link" size="small" @click="editOrder(record)">
                  编辑
                </Button>
                <Button
                  v-if="changeOrderFor(record.id)"
                  type="link"
                  size="small"
                  @click="withdrawOrderChange(record)"
                >
                  撤回本行改动
                </Button>
              </template>
              <span v-else class="text-muted-foreground text-xs">
                非本人负责，无法编辑
              </span>
            </template>
          </template>
        </Table>
      </div>
      <Empty v-else description="订舱不存在" />
    </Spin>
  </Page>
</template>
