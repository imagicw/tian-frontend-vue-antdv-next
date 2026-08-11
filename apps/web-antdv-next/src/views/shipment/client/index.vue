<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Switch } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteClientProfile,
  getClientProfilePage,
  updateClientProfile,
} from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import ClientForm from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: ClientForm,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}

function handleCreate() {
  formModalApi.setData(null).open();
}

function handleEdit(row: ShipmentApi.ClientProfile) {
  formModalApi.setData(row).open();
}

async function handleDelete(row: ShipmentApi.ClientProfile) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteClientProfile(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleToggleEnabled(row: ShipmentApi.ClientProfile) {
  await updateClientProfile({ id: row.id, enabled: !row.enabled });
  message.success('操作成功');
  handleRefresh();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getClientProfilePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ClientProfile>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="客户配置">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增客户',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:client-profile:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #enabled="{ row }">
        <Switch
          :checked="row.enabled"
          size="small"
          @change="handleToggleEnabled(row)"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '编辑',
              type: 'link',
              auth: ['container:client-profile:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['container:client-profile:delete'],
              popConfirm: {
                title: `确定删除客户「${row.clientName}」吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
