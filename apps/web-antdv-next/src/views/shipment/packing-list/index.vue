<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { deletePackingList, getPackingListPage } from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';
import PackingListForm from './modules/form.vue';

const router = useRouter();
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: PackingListForm,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}
function handleCreate() {
  formModalApi.setData(null).open();
}
function handleEdit(row: ShipmentApi.ShipmentPackingList) {
  formModalApi.setData(row).open();
}
function handleDetail(row: ShipmentApi.ShipmentPackingList) {
  router.push(`/shipment/packing-list/${row.id}`);
}

async function handleDelete(row: ShipmentApi.ShipmentPackingList) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deletePackingList(row.id);
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
          getPackingListPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShipmentPackingList>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="装箱单管理">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建装箱单',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:packing-list:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '详情',
              type: 'link',
              auth: ['container:packing-list:query'],
              onClick: handleDetail.bind(null, row),
            },
            {
              label: '编辑',
              type: 'link',
              auth: ['container:packing-list:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['container:packing-list:delete'],
              popConfirm: {
                title: `确定删除装箱单「${row.styleNo}」吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
