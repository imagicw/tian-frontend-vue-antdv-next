<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FinanceEcApi } from '#/api/finance/ec';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag, Upload } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSkuMapping,
  exportSkuMappings,
  getSkuMappingPage,
  importSkuMappings,
} from '#/api/finance/ec';

import { PLATFORM_OPTIONS, useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const platformLabel = (val: string) =>
  PLATFORM_OPTIONS.find((o) => o.value === val)?.label ?? val;

function handleRefresh() {
  gridApi.query();
}

function handleCreate() {
  formModalApi.setData(null).open();
}

function handleEdit(row: FinanceEcApi.ECSkuMapping) {
  formModalApi.setData(row).open();
}

async function handleDelete(row: FinanceEcApi.ECSkuMapping) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteSkuMapping(row.id!);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleExport() {
  const params = await gridApi.formApi.getValues();
  const data = await exportSkuMappings(params);
  downloadFileFromBlobPart({ fileName: 'SKU映射表.xls', source: data });
}

const importing = ref(false);
async function beforeImportUpload(file: File) {
  importing.value = true;
  try {
    await importSkuMappings(file);
    message.success('导入成功');
    handleRefresh();
  } catch {
    // error handled by interceptor
  } finally {
    importing.value = false;
  }
  return false;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getSkuMappingPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<FinanceEcApi.ECSkuMapping>,
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="SKU 映射列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增映射',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['finance:crossborder:sku-mapping:create'],
              onClick: handleCreate,
            },
            {
              label: '导出',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['finance:crossborder:sku-mapping:export'],
              onClick: handleExport,
            },
          ]"
        />
        <Upload
          :show-upload-list="false"
          accept=".xls,.xlsx"
          :before-upload="beforeImportUpload"
        >
          <Button
            :loading="importing"
            v-auth="'finance:crossborder:sku-mapping:import'"
          >
            导入映射
          </Button>
        </Upload>
      </template>
      <template #platform="{ row }">
        <Tag color="blue">{{ platformLabel(row.platform) }}</Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '编辑',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['finance:crossborder:sku-mapping:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['finance:crossborder:sku-mapping:delete'],
              popConfirm: {
                title: `确定要删除 原始SKU: ${row.originalSku} 吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
