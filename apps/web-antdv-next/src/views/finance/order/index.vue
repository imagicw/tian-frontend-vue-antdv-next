<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FinanceEcApi } from '#/api/finance/ec';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOrderTask,
  getOrderTaskPage,
  rollbackOrderTask,
} from '#/api/finance/ec';

import {
  PLATFORM_OPTIONS,
  TASK_STATUS_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import ImportForm from './modules/import-form.vue';
import PreviewModalForm from './modules/preview-modal.vue';

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});

const [PreviewModal, previewModalApi] = useVbenModal({
  connectedComponent: PreviewModalForm,
  destroyOnClose: true,
});

const platformLabel = (val: string) =>
  PLATFORM_OPTIONS.find((o) => o.value === val)?.label ?? val;

function handleRefresh() {
  gridApi.query();
}

function handlePreview(row: FinanceEcApi.ECOrderTask) {
  previewModalApi.setData(row).open();
}

async function handleRollback(row: FinanceEcApi.ECOrderTask) {
  const hide = message.loading({ content: '正在回滚...', duration: 0 });
  try {
    await rollbackOrderTask(row.id);
    message.success('回滚成功');
    handleRefresh();
  } finally {
    hide();
  }
}

async function handleDelete(row: FinanceEcApi.ECOrderTask) {
  const hide = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deleteOrderTask(row.id);
    message.success('删除成功');
    handleRefresh();
  } finally {
    hide();
  }
}

function onImportSuccess(taskId: number, platform: string) {
  handleRefresh();
  previewModalApi
    .setData({
      id: taskId,
      platform,
      taskStatus: 'WAIT_DEDUCT_CONFIRM',
    })
    .open();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getOrderTaskPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<FinanceEcApi.ECOrderTask>,
});
</script>

<template>
  <Page auto-content-height>
    <ImportModal @success="onImportSuccess" />
    <Grid table-title="订单导入任务">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '导入订单',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['finance:crossborder:order-import:create'],
              onClick: () => importModalApi.open(),
            },
          ]"
        />
      </template>
      <template #platform="{ row }">
        <Tag color="blue">{{ platformLabel(row.platform) }}</Tag>
      </template>
      <template #taskStatus="{ row }">
        <Tag :color="TASK_STATUS_MAP[row.taskStatus]?.color ?? 'default'">
          {{ TASK_STATUS_MAP[row.taskStatus]?.text ?? row.taskStatus }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '预览',
              type: 'link',
              ifShow: !['PROCESSED', 'ROLLED_BACK'].includes(row.taskStatus),
              onClick: handlePreview.bind(null, row),
            },
            {
              label: '回滚',
              type: 'link',
              danger: true,
              ifShow: row.taskStatus === 'PROCESSED',
              auth: ['finance:crossborder:order-import:rollback'],
              popConfirm: {
                title: '回滚后将撤销此批次的订单数据，是否继续？',
                confirm: handleRollback.bind(null, row),
              },
            },
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              ifShow: row.taskStatus !== 'PROCESSED',
              auth: ['finance:crossborder:order-import:delete'],
              popConfirm: {
                title: `确定要删除任务 ${row.taskNo} 吗？`,
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
    <PreviewModal @confirmed="handleRefresh" />
  </Page>
</template>
