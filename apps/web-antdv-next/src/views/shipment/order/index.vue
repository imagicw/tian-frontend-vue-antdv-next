<script lang="ts" setup>
import type { ActionItem, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  confirmOrderFinalBatch,
  deleteOrder,
  getOrderPage,
  publishOrderDraftBatch,
  returnOrderToDraft,
} from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import OrderForm from './modules/form.vue';
import OrderHandover from './modules/handover.vue';
import OrderRemark from './modules/remark.vue';
import OrderWithdraw from './modules/withdraw.vue';

const router = useRouter();
const userStore = useUserStore();
const currentUserId = computed(() => userStore.userInfo?.userId);
const selectedRows = ref<ShipmentApi.ShipmentOrder[]>([]);
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: OrderForm,
  destroyOnClose: true,
});
const [HandoverModal, handoverModalApi] = useVbenModal({
  connectedComponent: OrderHandover,
  destroyOnClose: true,
});
const [WithdrawModal, withdrawModalApi] = useVbenModal({
  connectedComponent: OrderWithdraw,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: OrderRemark,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
  selectedRows.value = [];
}
function handleCreate() {
  formModalApi.setData(null).open();
}
function handleEdit(row: ShipmentApi.ShipmentOrder) {
  formModalApi.setData(row).open();
}

async function handleDelete(row: ShipmentApi.ShipmentOrder) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteOrder(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handlePublishDraft() {
  const ids = selectedRows.value.filter((row) => row.isDraft).map((r) => r.id);
  if (ids.length === 0) {
    message.warning('请先选择草稿 PO');
    return;
  }
  const hide = message.loading({ content: '发布中...', duration: 0 });
  try {
    await publishOrderDraftBatch(ids);
    message.success('发布成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleReturnToDraft(row: ShipmentApi.ShipmentOrder) {
  const hide = message.loading({ content: '转草稿中...', duration: 0 });
  try {
    await returnOrderToDraft(row.id);
    message.success('已转为草稿');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleConfirmFinal() {
  const ids = selectedRows.value.map((r) => r.id);
  if (ids.length === 0) {
    message.warning('请先选择订单');
    return;
  }
  const hide = message.loading({ content: '确认中...', duration: 0 });
  try {
    await confirmOrderFinalBatch(ids);
    message.success('确认成功');
    handleRefresh();
  } finally {
    hide();
  }
}

function handleLog(row: ShipmentApi.ShipmentOrder) {
  router.push({
    path: '/shipment/log',
    query: { businessType: 'ORDER', businessId: row.id },
  });
}

function handleHandover() {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择需要交接的 PO');
    return;
  }
  handoverModalApi.setData(selectedRows.value).open();
}

function handleWithdrawFinalConfirm(row: ShipmentApi.ShipmentOrder) {
  withdrawModalApi.setData({ mode: 'direct', order: row }).open();
}

function handleRequestWithdrawFinalConfirm(row: ShipmentApi.ShipmentOrder) {
  withdrawModalApi.setData({ mode: 'request', order: row }).open();
}

function handleProcessWithdrawRequest(row: ShipmentApi.ShipmentOrder) {
  withdrawModalApi.setData({ mode: 'process', order: row }).open();
}

function handleEditRemark(row: ShipmentApi.ShipmentOrder) {
  remarkModalApi.setData(row).open();
}

function handleGoBooking() {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择待订舱订单');
    return;
  }
  if (
    selectedRows.value.some((row) => row.isDraft || String(row.status) !== '5')
  ) {
    message.warning('仅已发布且未占用的 PO 可以发起订舱');
    return;
  }
  const orderIds = selectedRows.value.map((r) => r.id).join(',');
  router.push(`/shipment/booking?openCreate=1&orderIds=${orderIds}`);
}

function getOrderActions(row: ShipmentApi.ShipmentOrder): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '编辑',
      type: 'link',
      auth: ['container:order:update'],
      onClick: handleEdit.bind(null, row),
    },
    {
      label: '交接记录',
      type: 'link',
      auth: ['container:operation-log:query'],
      onClick: handleLog.bind(null, row),
    },
  ];
  if (!row.isDraft && String(row.status) === '5') {
    actions.push({
      label: '转草稿',
      type: 'link',
      auth: ['container:order:update'],
      onClick: handleReturnToDraft.bind(null, row),
    });
  }
  if (row.isDraft) {
    actions.push({
      label: '删除',
      type: 'link',
      danger: true,
      icon: ACTION_ICON.DELETE,
      auth: ['container:order:delete'],
      popConfirm: {
        title: `确定删除草稿 PO「${row.poNo ?? row.id}」吗？`,
        confirm: handleDelete.bind(null, row),
      },
    });
  }
  if (row.isFinalConfirmed) {
    actions.push(
      {
        label: '修改备注',
        type: 'link',
        auth: ['container:order:update'],
        onClick: handleEditRemark.bind(null, row),
      },
      {
        label: '撤回最终确认',
        type: 'link',
        danger: true,
        // 撤回权限是"订舱单证责任人 OR container:order:final-confirm:withdraw 权限码 OR 管理员"的并集，
        // 单证责任人按订舱单动态绑定、前端无法据此过滤，因此这里只做粗粒度可见性控制，具体授权由后端裁决。
        auth: ['container:order:update'],
        onClick: handleWithdrawFinalConfirm.bind(null, row),
      },
    );
    if (
      !row.pendingWithdrawRequestId &&
      currentUserId.value === row.responsibleUserId
    ) {
      actions.push({
        label: '申请撤回确认',
        type: 'link',
        onClick: handleRequestWithdrawFinalConfirm.bind(null, row),
      });
    }
  }
  if (row.pendingWithdrawRequestId) {
    actions.push({
      label: '处理撤回申请',
      type: 'link',
      auth: ['container:order:update'],
      onClick: handleProcessWithdrawRequest.bind(null, row),
    });
  }
  return actions;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return getOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    checkboxConfig: { reserve: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShipmentOrder>,
  gridEvents: {
    checkboxChange: ({ records }: { records: ShipmentApi.ShipmentOrder[] }) => {
      selectedRows.value = records;
    },
    checkboxAll: ({ records }: { records: ShipmentApi.ShipmentOrder[] }) => {
      selectedRows.value = records;
    },
  },
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <HandoverModal @success="handleRefresh" />
    <WithdrawModal @success="handleRefresh" />
    <RemarkModal @success="handleRefresh" />
    <Grid table-title="订舱大厅 — PO 生命周期">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建 PO 草稿',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:order:create'],
              onClick: handleCreate,
            },
            {
              label: '发布选中草稿',
              auth: ['container:order:update'],
              disabled: selectedRows.length === 0,
              onClick: handlePublishDraft,
            },
            {
              label: '确认终稿',
              auth: ['container:order:update'],
              disabled: selectedRows.length === 0,
              onClick: handleConfirmFinal,
            },
            {
              label: '责任人交接',
              auth: ['container:order:handover'],
              disabled: selectedRows.length === 0,
              onClick: handleHandover,
            },
            {
              label: '发起订舱',
              type: 'primary',
              auth: ['container:booking:create'],
              disabled: selectedRows.length === 0,
              onClick: handleGoBooking,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction :actions="getOrderActions(row)" />
      </template>
    </Grid>
  </Page>
</template>
