<script lang="ts" setup>
import type { DescriptionItemSchema } from '#/components/description';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Descriptions as AntDescriptions,
  Modal as AntModal,
  Button,
  DescriptionsItem,
  Divider,
  Input,
  message,
  Space,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  createBookingChange,
  getBookingDetail,
  publishBookingChange,
  removeBookingOrder,
  saveBookingChangeOrder,
  ShipmentApi,
  withdrawBookingChange,
} from '#/api/shipment';
import { useDescription } from '#/components/description';

import {
  canActOnBookingOrders,
  canChangeBooking,
  canInitiateChange,
  canPublishChange,
  canWithdrawChange,
  isOrderOwner,
  resolveRemoveOrderStrategy,
} from '../change-logic';
import { BOOKING_STATUS_MAP, BOOKING_TYPE_MAP } from '../data';
import ChangeHeaderForm from './change-header-form.vue';
import ChangeOrderForm from './change-order-form.vue';

const router = useRouter();
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const bookingDetail = ref<any>(null);
const loading = ref(false);

async function loadBookingDetail(id: number) {
  bookingDetail.value = await getBookingDetail(id);
}

const currentUserId = computed(() => userStore.userInfo?.userId);
const pendingChange = computed(() => bookingDetail.value?.pendingChange);
const showChangePanel = computed(() =>
  canChangeBooking(bookingDetail.value?.status),
);

function canRemove(order: any) {
  if (
    !canActOnBookingOrders(bookingDetail.value?.status) ||
    !isOrderOwner(currentUserId.value, order)
  ) {
    return false;
  }
  const strategy = resolveRemoveOrderStrategy(bookingDetail.value?.status);
  return hasAccessByCodes([
    strategy === 'direct'
      ? 'container:booking:update'
      : 'container:booking:change',
  ]);
}
function canEditViaChange(order: any) {
  return (
    showChangePanel.value &&
    isOrderOwner(currentUserId.value, order) &&
    hasAccessByCodes(['container:booking:change'])
  );
}

function promptReason(title: string, onOk: (reason: string) => Promise<void>) {
  let reason = '';
  AntModal.confirm({
    title,
    content: h(Input.TextArea, {
      placeholder: '请输入原因',
      rows: 3,
      onChange: (e: Event) => {
        reason = (e.target as HTMLTextAreaElement).value;
      },
    }),
    async onOk() {
      if (!reason.trim()) {
        message.warning('请输入原因');
        throw new Error('missing reason');
      }
      await onOk(reason);
    },
  });
}

/**
 * 创建变更草稿可能因并发已存在待发布变更而失败（BOOKING_CHANGE_ALREADY_PENDING）；
 * 失败时刷新详情，使协作面板能看到对方刚创建的那份变更，而不是停留在“无变更”的旧视图。
 */
async function ensureChangeId(reason: string): Promise<number> {
  const existing = pendingChange.value?.id;
  if (existing) return existing;
  const bookingId = bookingDetail.value.id;
  try {
    return await createBookingChange({ bookingId, reason });
  } catch (error) {
    await loadBookingDetail(bookingId);
    throw error;
  }
}

function handleRemoveOrder(order: any) {
  const bookingId = bookingDetail.value?.id;
  if (!bookingId || !order.id) return;
  const strategy = resolveRemoveOrderStrategy(bookingDetail.value?.status);
  promptReason(
    strategy === 'direct'
      ? `确认将 PO「${order.poNo}」移出本订舱？`
      : `将 PO「${order.poNo}」的移出计入待发布变更？`,
    async (reason) => {
      if (strategy === 'direct') {
        await removeBookingOrder({ bookingId, orderId: order.id, reason });
        message.success('移出成功');
      } else {
        const changeId = await ensureChangeId(reason);
        await saveBookingChangeOrder({
          changeId,
          orderId: order.id,
          action: ShipmentApi.CHANGE_ACTION_REMOVE,
          reason,
        });
        message.success('已计入待发布变更，发布后生效');
      }
      await loadBookingDetail(bookingId);
    },
  );
}

const [ChangeOrderModal, changeOrderModalApi] = useVbenModal({
  connectedComponent: ChangeOrderForm,
  destroyOnClose: true,
});
const [ChangeHeaderModal, changeHeaderModalApi] = useVbenModal({
  connectedComponent: ChangeHeaderForm,
  destroyOnClose: true,
});

// 改动原因已在子表单内必填，这里只确保草稿存在，不再套一层确认弹窗（避免“确认框内开新弹窗”嵌套）。
async function handleEditOrder(order: any) {
  try {
    const changeId = await ensureChangeId('发起 PO 改动（详见改动表单内原因）');
    changeOrderModalApi.setData({ changeId, order }).open();
  } catch {
    // 错误已由全局请求拦截器提示，ensureChangeId 已刷新详情
  }
}

async function handleEditHeader() {
  try {
    const changeId = await ensureChangeId(
      '发起订舱头改动（详见改动表单内原因）',
    );
    changeHeaderModalApi
      .setData({ changeId, booking: bookingDetail.value })
      .open();
  } catch {
    // 错误已由全局请求拦截器提示，ensureChangeId 已刷新详情
  }
}

async function handleChangeRefresh() {
  await loadBookingDetail(bookingDetail.value.id);
}

function handleInitiateChange() {
  promptReason('发起订舱变更', async (reason) => {
    await createBookingChange({ bookingId: bookingDetail.value.id, reason });
    message.success('已发起待发布变更');
    await handleChangeRefresh();
  });
}

function handleWithdrawChange() {
  promptReason('撤回整份订舱变更', async (reason) => {
    await withdrawBookingChange({ changeId: pendingChange.value.id, reason });
    message.success('已撤回');
    await handleChangeRefresh();
  });
}

async function handlePublishChange() {
  AntModal.confirm({
    title: '确认发布该订舱变更？发布前将重新校验分柜完整性与柜容。',
    async onOk() {
      await publishBookingChange(pendingChange.value.id);
      message.success('发布成功');
      await handleChangeRefresh();
    },
  });
}

async function handleGoSplitChange() {
  try {
    const changeId = await ensureChangeId(
      '发起分柜方案改动（详见分柜页内原因）',
    );
    router.push(
      `/shipment/split?bookingId=${bookingDetail.value.id}&changeId=${changeId}`,
    );
  } catch {
    // 错误已由全局请求拦截器提示，ensureChangeId 已刷新详情
  }
}

function canInitiate() {
  return canInitiateChange(currentUserId.value, bookingDetail.value ?? {});
}
function canWithdraw() {
  return (
    !!pendingChange.value &&
    canWithdrawChange(
      currentUserId.value,
      pendingChange.value,
      bookingDetail.value ?? {},
    )
  );
}
function canPublish() {
  return (
    !!pendingChange.value &&
    canPublishChange(currentUserId.value, bookingDetail.value ?? {})
  );
}

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
  {
    title: '操作',
    key: 'actions',
    render: (_value: unknown, record: any) =>
      h(Space, {}, () => [
        canEditViaChange(record)
          ? h('a', { onClick: () => handleEditOrder(record) }, '编辑（变更）')
          : null,
        canRemove(record)
          ? h(
              'a',
              {
                style: { color: 'red' },
                onClick: () => handleRemoveOrder(record),
              },
              '移出订舱',
            )
          : null,
      ]),
  },
];

const changeActionLabel: Record<number, string> = {
  [ShipmentApi.CHANGE_ACTION_UPDATE]: '更新',
  [ShipmentApi.CHANGE_ACTION_REMOVE]: '移出',
  [ShipmentApi.CHANGE_ACTION_ADD]: '新增',
};

const changeOrderColumns = [
  { title: '订单ID', dataIndex: 'orderId', key: 'orderId' },
  {
    title: '动作',
    key: 'action',
    render: (_value: unknown, record: ShipmentApi.ShipmentBookingChangeOrder) =>
      changeActionLabel[record.action] ?? record.action,
  },
  { title: '原因', dataIndex: 'reason', key: 'reason' },
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
      await loadBookingDetail(data.id);
    } finally {
      loading.value = false;
    }
  },
});
</script>

<template>
  <Modal title="订舱详情" :footer="false" class="w-[900px]">
    <ChangeOrderModal @success="handleChangeRefresh" />
    <ChangeHeaderModal @success="handleChangeRefresh" />
    <Spin :spinning="loading">
      <Descriptions
        v-if="bookingDetail"
        :data="bookingDetail"
        size="small"
        class="mb-4"
      />
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

      <template v-if="showChangePanel">
        <Divider title-placement="start">变更协作</Divider>
        <template v-if="pendingChange">
          <AntDescriptions bordered size="small" :column="2" class="mb-3">
            <DescriptionsItem label="状态">
              <Tag color="processing">待发布</Tag>
            </DescriptionsItem>
            <DescriptionsItem label="发起人">
              {{ pendingChange.initiatorName ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="原因" :span="2">
              {{ pendingChange.reason ?? '-' }}
            </DescriptionsItem>
          </AntDescriptions>
          <Table
            v-if="pendingChange.orders?.length"
            :data-source="pendingChange.orders"
            :pagination="false"
            size="small"
            row-key="id"
            class="mb-3"
            :columns="changeOrderColumns"
          />
          <Space>
            <Button
              v-access:code="['container:booking:change']"
              size="small"
              @click="handleEditHeader"
            >
              编辑订舱头
            </Button>
            <Button
              v-access:code="['container:booking:change']"
              size="small"
              @click="handleGoSplitChange"
            >
              调整分柜方案
            </Button>
            <Button
              v-if="canWithdraw()"
              v-access:code="['container:booking:change']"
              size="small"
              danger
              @click="handleWithdrawChange"
            >
              撤回整份变更
            </Button>
            <Button
              v-if="canPublish()"
              v-access:code="['container:booking:change:publish']"
              size="small"
              type="primary"
              @click="handlePublishChange"
            >
              发布变更
            </Button>
          </Space>
        </template>
        <template v-else>
          <Button
            v-if="canInitiate()"
            v-access:code="['container:booking:change']"
            size="small"
            type="primary"
            @click="handleInitiateChange"
          >
            发起变更
          </Button>
          <span v-else class="text-xs text-gray-400">
            仅订舱申请人或本订舱内 PO 责任人可发起变更
          </span>
        </template>
      </template>
    </Spin>
  </Modal>
</template>
