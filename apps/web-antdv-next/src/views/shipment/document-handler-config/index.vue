<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  backfillPublishedBookingDocumentHandlers,
  deleteDocumentHandlerConfig,
  getDocumentHandlerBackfillRecordPage,
  getDocumentHandlerConfigPage,
} from '#/api/shipment';

import {
  useBackfillColumns,
  useBackfillQuerySchema,
  useConfigColumns,
  useConfigQuerySchema,
} from './data';
import DocumentHandlerForm from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: DocumentHandlerForm,
  destroyOnClose: true,
});

function handleRefresh() {
  configGridApi.query();
}
function handleCreate() {
  formModalApi.setData(null).open();
}
function handleEdit(row: ShipmentApi.DocumentHandlerConfig) {
  formModalApi.setData(row).open();
}
async function handleDelete(row: ShipmentApi.DocumentHandlerConfig) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteDocumentHandlerConfig(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}
async function handleBackfill() {
  const hide = message.loading({ content: '正在补写历史订舱...', duration: 0 });
  try {
    const results = await backfillPublishedBookingDocumentHandlers();
    message.success(`补写完成，处理 ${results.length} 条订舱`);
    backfillGridApi.query();
  } finally {
    hide();
  }
}

const [ConfigGrid, configGridApi] = useVbenVxeGrid({
  formOptions: { schema: useConfigQuerySchema() },
  gridOptions: {
    columns: useConfigColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getDocumentHandlerConfigPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.DocumentHandlerConfig>,
});

const [BackfillGrid, backfillGridApi] = useVbenVxeGrid({
  formOptions: { schema: useBackfillQuerySchema() },
  gridOptions: {
    columns: useBackfillColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getDocumentHandlerBackfillRecordPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.DocumentHandlerBackfillRecord>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <ConfigGrid table-title="单证责任人配置">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增配置',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['container:document-handler-config:create'],
              onClick: handleCreate,
            },
            {
              label: '补写历史订舱',
              auth: ['container:document-handler-config:backfill'],
              onClick: handleBackfill,
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
              auth: ['container:document-handler-config:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['container:document-handler-config:delete'],
              popConfirm: {
                title: `确定删除 ${row.clientCode} 的配置吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </ConfigGrid>
    <BackfillGrid table-title="历史补写审计记录" />
  </Page>
</template>
