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
  confirmBooking,
  deleteBooking,
  getBookingPage,
  rejectBooking,
  shipBooking,
  submitBooking,
} from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import BookingDetail from './modules/detail.vue';
import BookingForm from './modules/form.vue';

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
function handleSplit(row: ShipmentApi.ShipmentBooking) {
  router.push(`/shipment/split?bookingId=${row.id}`);
}
function handleSelectedSplit() {
  const row = selectedRows.value[0];
  if (selectedRows.value.length === 1 && row) handleSplit(row);
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
        throw undefined;
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

function handleSubmit(row: ShipmentApi.ShipmentBooking) {
  confirmWithOptionalReason(
    `确认提交订舱「${row.bookingNo ?? row.id}」？`,
    async (remarks) => {
      await submitBooking(row.id, remarks);
      message.success('提交成功');
      handleRefresh();
    },
  );
}

function handleConfirm(row: ShipmentApi.ShipmentBooking) {
  confirmWithOptionalReason(
    `确认订舱「${row.bookingNo ?? row.id}」？`,
    async (remarks) => {
      await confirmBooking(row.id, { remarks });
      message.success('确认成功');
      handleRefresh();
    },
  );
}

function handleReject(row: ShipmentApi.ShipmentBooking) {
  confirmWithReason(
    `驳回订舱「${row.bookingNo ?? row.id}」`,
    '驳回原因',
    async (reason) => {
      await rejectBooking(row.id, reason);
      message.success('驳回成功');
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

function canSubmit(status: string) {
  return status === '0' || status === '3';
}
function canConfirm(status: string) {
  return status === '1';
}
function canReject(status: string) {
  return status === '1';
}
function canShip(status: string) {
  return status === '2';
}
function canCancel(status: string) {
  return status !== '2' && status !== '4' && status !== '5';
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
      label: '编辑',
      type: 'link',
      auth: ['container:booking:update'],
      onClick: handleEdit.bind(null, row),
    },
    {
      label: '分柜结果',
      type: 'link',
      auth: ['container:split:query'],
      onClick: handleSplit.bind(null, row),
    },
  ];
  const status = String(row.status);
  if (canSubmit(status)) {
    actions.push({
      label: '提交',
      type: 'link',
      auth: ['container:booking:submit'],
      onClick: handleSubmit.bind(null, row),
    });
  }
  if (canConfirm(status)) {
    actions.push({
      label: '确认',
      type: 'link',
      auth: ['container:booking:confirm'],
      onClick: handleConfirm.bind(null, row),
    });
  }
  if (canReject(status)) {
    actions.push({
      label: '驳回',
      type: 'link',
      danger: true,
      auth: ['container:booking:reject'],
      onClick: handleReject.bind(null, row),
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
