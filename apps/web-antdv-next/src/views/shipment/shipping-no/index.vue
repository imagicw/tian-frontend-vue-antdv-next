<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteShippingNo, getShippingNoPage } from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import ShippingNoForm from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: ShippingNoForm,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}
function handleCreate() {
  formModalApi.setData(null).open();
}
function handleEdit(row: ShipmentApi.ShippingNo) {
  formModalApi.setData(row).open();
}

async function handleDelete(row: ShipmentApi.ShippingNo) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteShippingNo(row.id);
    message.success('删除成功');
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
          getShippingNoPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShippingNo>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="运编号管理">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增运编号',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:shipping-number:create'],
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
              auth: ['container:shipping-number:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['container:shipping-number:delete'],
              popConfirm: {
                title: `确定删除运编号「${row.shippingNo}」吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
