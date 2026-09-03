<script lang="ts" setup>
import type { ActionItem, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Input, message, Modal } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelBooking,
  deleteBooking,
  getBookingPage,
  publishBooking,
  shipBooking,
} from '#/api/shipment';

import { canMaintainBookingHeader, canModifyBooking } from './change-logic';
import { useGridColumns, useGridFormSchema } from './data';
import BookingDetail from './modules/detail.vue';
import BookingForm from './modules/form.vue';
import BookingHeaderForm from './modules/header-form.vue';

const router = useRouter();
const selectedRows = ref<ShipmentApi.ShipmentBooking[]>([]);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: BookingForm,
  destroyOnClose: true,
});
const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: BookingDetail,
  destroyOnClose: true,
});
const [HeaderModal, headerModalApi] = useVbenModal({
  connectedComponent: BookingHeaderForm,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
  selectedRows.value = [];
}
function handleCreate() {
  formModalApi.setData(null).open();
}
function handleEdit(row: ShipmentApi.ShipmentBooking) {
  formModalApi.setData(row).open();
}
function handleDetail(row: ShipmentApi.ShipmentBooking) {
  detailModalApi.setData({ id: row.id }).open();
}
function handleMaintainHeader(row: ShipmentApi.ShipmentBooking) {
  headerModalApi.setData(row).open();
}
function handleSplit(row: ShipmentApi.ShipmentBooking) {
  router.push(`/shipment/split?bookingId=${row.id}`);
}
function handleSelectedSplit() {
  const row = selectedRows.value[0];
  if (selectedRows.value.length === 1 && row) handleSplit(row);
}
function handleLog(row: ShipmentApi.ShipmentBooking) {
  router.push({
    path: '/shipment/log',
    query: { businessType: 'BOOKING', businessId: row.id },
  });
}

async function handleDelete(row: ShipmentApi.ShipmentBooking) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteBooking(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

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
        throw new Error('validation failed');
      }
      await onOk(reason);
    },
  });
}

function confirmWithOptionalReason(
  title: string,
  onOk: (remarks?: string) => Promise<void>,
) {
  let remarks = '';
  Modal.confirm({
    title,
    content: h(Input.TextArea, {
      placeholder: '备注（选填）',
      rows: 3,
      onChange: (e: Event) => {
        remarks = (e.target as HTMLTextAreaElement).value;
      },
    }),
    async onOk() {
      await onOk(remarks || undefined);
    },
  });
}

function handlePublish(row: ShipmentApi.ShipmentBooking) {
  confirmWithOptionalReason(
    `确认发布订舱「${row.bookingNo ?? row.id}」？发布后立即生效并通知单证。`,
    async (remarks) => {
      await publishBooking(row.id, remarks);
      message.success('发布成功，订舱已生效并通知单证');
      handleRefresh();
    },
  );
}

function handleCancel(row: ShipmentApi.ShipmentBooking) {
  confirmWithReason(
    `取消订舱「${row.bookingNo ?? row.id}」`,
    '取消原因',
    async (reason) => {
      await cancelBooking(row.id, reason);
      message.success('取消成功');
      handleRefresh();
    },
  );
}

function handleShip(row: ShipmentApi.ShipmentBooking) {
  confirmWithOptionalReason(
    `确认出运订舱「${row.bookingNo ?? row.id}」？`,
    async (remarks) => {
      await shipBooking(row.id, remarks);
      message.success('出运成功');
      handleRefresh();
    },
  );
}

function canPublish(status: string) {
  return status === '0';
}
function canShip(status: string) {
  return status === '2';
}
function canCancel(status: string) {
  return status !== '4' && status !== '6';
}

function getBookingActions(row: ShipmentApi.ShipmentBooking): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '详情',
      type: 'link',
      auth: ['container:booking:query'],
      onClick: handleDetail.bind(null, row),
    },
    {
      label: '分柜结果',
      type: 'link',
      auth: ['container:split:query'],
      onClick: handleSplit.bind(null, row),
    },
    {
      label: '日志',
      type: 'link',
      auth: ['container:operation-log:query'],
      onClick: handleLog.bind(null, row),
    },
  ];
  const status = String(row.status);
  if (canModifyBooking(status)) {
    actions.splice(1, 0, {
      label: '编辑',
      type: 'link',
      auth: ['container:booking:update'],
      onClick: handleEdit.bind(null, row),
    });
  }
  if (canMaintainBookingHeader(status)) {
    actions.push({
      label: '维护单证资料',
      type: 'link',
      auth: ['container:booking:document-maintain'],
      onClick: handleMaintainHeader.bind(null, row),
    });
  }
  if (canPublish(status)) {
    actions.push({
      label: '发布',
      type: 'link',
      auth: ['container:booking:publish'],
      onClick: handlePublish.bind(null, row),
    });
  }
  if (canShip(status)) {
    actions.push({
      label: '出运',
      type: 'link',
      auth: ['container:booking:ship'],
      onClick: handleShip.bind(null, row),
    });
  }
  if (canCancel(status)) {
    actions.push({
      label: '取消',
      type: 'link',
      danger: true,
      auth: ['container:booking:cancel'],
      onClick: handleCancel.bind(null, row),
    });
  }
  if (canModifyBooking(status)) {
    actions.push({
      label: '删除',
      type: 'link',
      danger: true,
      icon: ACTION_ICON.DELETE,
      auth: ['container:booking:delete'],
      popConfirm: {
        title: `确定删除订舱「${row.bookingNo ?? row.id}」吗？`,
        confirm: handleDelete.bind(null, row),
      },
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
        query: async ({ page }, formValues) =>
          getBookingPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    checkboxConfig: { reserve: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShipmentBooking>,
  gridEvents: {
    checkboxChange: ({
      records,
    }: {
      records: ShipmentApi.ShipmentBooking[];
    }) => {
      selectedRows.value = records;
    },
    checkboxAll: ({ records }: { records: ShipmentApi.ShipmentBooking[] }) => {
      selectedRows.value = records;
    },
  },
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <HeaderModal @success="handleRefresh" />
    <DetailModal />
    <Grid table-title="订舱管理">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建订舱',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:booking:create'],
              onClick: handleCreate,
            },
            {
              label: '进入分柜工作台',
              auth: ['container:split:query'],
              disabled: selectedRows.length !== 1,
              onClick: handleSelectedSplit,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction :actions="getBookingActions(row)" />
      </template>
    </Grid>
  </Page>
</template>
