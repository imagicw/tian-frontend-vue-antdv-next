<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  confirmOrderFinalBatch,
  deleteOrder,
  getNotBookedOrderPage,
  publishOrderDraftBatch,
} from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import OrderForm from './modules/form.vue';

const router = useRouter();
const selectedRows = ref<ShipmentApi.ShipmentOrder[]>([]);
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: OrderForm,
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
  const ids = selectedRows.value.map((r) => r.id);
  if (ids.length === 0) {
    message.warning('请先选择订单');
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

function handleGoBooking() {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择待订舱订单');
    return;
  }
  const orderIds = selectedRows.value.map((r) => r.id).join(',');
  router.push(`/shipment/booking?openCreate=1&orderIds=${orderIds}`);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const clientCode = formValues.clientCode?.trim();
          if (!clientCode) {
            return { list: [], total: 0 };
          }
          return getNotBookedOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            clientCode,
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
    <Grid table-title="订舱大厅 — 待订舱订单">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建订单',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:order:create'],
              onClick: handleCreate,
            },
            {
              label: '发布草稿',
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
        <TableAction
          :actions="[
            {
              label: '编辑',
              type: 'link',
              auth: ['container:order:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['container:order:delete'],
              popConfirm: {
                title: `确定删除订单「${row.poNo}」吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
