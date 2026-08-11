<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getCostAllocationPage, revokeCostAllocation } from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import CostAllocationForm from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: CostAllocationForm,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}
function handleCreate() {
  formModalApi.setData({}).open();
}
function handleEdit(row: ShipmentApi.ShipmentCostAllocation) {
  formModalApi.setData(row).open();
}

async function handleRevoke(row: ShipmentApi.ShipmentCostAllocation) {
  const hide = message.loading({ content: '撤销中...', duration: 0 });
  try {
    await revokeCostAllocation(row.id);
    message.success('撤销成功');
    handleRefresh();
  } finally {
    hide();
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getCostAllocationPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShipmentCostAllocation>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="费用分摊">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建分摊',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:cost-allocation:create'],
              onClick: handleCreate,
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
              auth: ['container:cost-allocation:update'],
              disabled: row.status === 'APPLIED',
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '撤销',
              type: 'link',
              danger: true,
              auth: ['container:cost-allocation:update'],
              disabled: row.status !== 'APPLIED',
              popConfirm: {
                title: `确定撤销批次「${row.batchNo ?? row.id}」的费用分摊吗？`,
                confirm: handleRevoke.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
