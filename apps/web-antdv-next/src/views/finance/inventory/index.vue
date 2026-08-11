<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FinanceEcApi } from '#/api/finance/ec';

import { ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { isEmpty } from '@vben/utils';

import { Button, message, Popconfirm, Tag, Upload } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteInventory,
  deleteInventory,
  getInventoryPage,
  importInventory,
} from '#/api/finance/ec';

import {
  BATCH_STATUS_MAP,
  PLATFORM_OPTIONS,
  useGridColumns,
  useGridFormSchema,
} from './data';
import LogDrawerForm from './modules/log-drawer.vue';
import ManualFixForm from './modules/manual-fix-form.vue';

const [ManualFixModal, manualFixModalApi] = useVbenModal({
  connectedComponent: ManualFixForm,
  destroyOnClose: true,
});

const [LogDrawer, logDrawerApi] = useVbenDrawer({
  connectedComponent: LogDrawerForm,
  destroyOnClose: true,
});

const platformLabel = (val: string) =>
  PLATFORM_OPTIONS.find((o) => o.value === val)?.label ?? val;

const checkedIds = ref<number[]>([]);

function handleRefresh() {
  gridApi.query();
}

function handleViewLog(row: FinanceEcApi.ECInventory) {
  logDrawerApi.setData(row).open();
}

function handleManualFix(row: FinanceEcApi.ECInventory) {
  manualFixModalApi.setData(row).open();
}

async function handleDelete(row: FinanceEcApi.ECInventory) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteInventory(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleBatchDelete() {
  const hide = message.loading({ content: '批量删除中...', duration: 0 });
  try {
    await batchDeleteInventory(checkedIds.value);
    checkedIds.value = [];
    message.success('批量删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

const importing = ref(false);
async function beforeImportUpload(file: File) {
  importing.value = true;
  try {
    await importInventory(file);
    message.success('导入成功');
    handleRefresh();
  } catch {
    // error handled by interceptor
  } finally {
    importing.value = false;
  }
  return false;
}

function handleRowCheckboxChange({
  records,
}: {
  records: FinanceEcApi.ECInventory[];
}) {
  checkedIds.value = records.map((r) => r.id);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getInventoryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<FinanceEcApi.ECInventory>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});
</script>

<template>
  <Page auto-content-height>
    <ManualFixModal @success="handleRefresh" />
    <Grid table-title="库存列表">
      <template #toolbar-tools>
        <Upload
          :show-upload-list="false"
          accept=".xls,.xlsx"
          :before-upload="beforeImportUpload"
        >
          <Button
            :loading="importing"
            v-auth="'finance:crossborder:inventory:import'"
          >
            导入库存
          </Button>
        </Upload>
        <Popconfirm
          v-if="!isEmpty(checkedIds)"
          :title="`确定要批量删除 ${checkedIds.length} 条库存记录吗？`"
          @confirm="handleBatchDelete"
        >
          <Button
            type="primary"
            danger
            v-auth="'finance:crossborder:inventory:delete'"
          >
            批量删除 ({{ checkedIds.length }})
          </Button>
        </Popconfirm>
      </template>
      <template #platform="{ row }">
        <Tag color="blue">{{ platformLabel(row.platform) }}</Tag>
      </template>
      <template #batchStatus="{ row }">
        <Tag :color="BATCH_STATUS_MAP[row.batchStatus]?.color ?? 'default'">
          {{ BATCH_STATUS_MAP[row.batchStatus]?.text ?? row.batchStatus }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '变动日志',
              type: 'link',
              onClick: handleViewLog.bind(null, row),
            },
            {
              label: '修正',
              type: 'link',
              auth: ['finance:crossborder:inventory:update'],
              onClick: handleManualFix.bind(null, row),
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['finance:crossborder:inventory:delete'],
              popConfirm: {
                title: `确定要删除 ${row.gtSku} 吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
    <LogDrawer />
  </Page>
</template>
