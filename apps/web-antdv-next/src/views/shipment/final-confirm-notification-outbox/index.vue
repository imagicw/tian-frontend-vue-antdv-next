<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { Page } from '@vben/common-ui';

import { message } from 'antdv-next';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getFinalConfirmNotificationOutboxPage,
  resendFinalConfirmNotificationOutbox,
} from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';

async function handleResend(row: ShipmentApi.FinalConfirmNotificationOutbox) {
  const hide = message.loading({ content: '正在安排补发...', duration: 0 });
  try {
    await resendFinalConfirmNotificationOutbox(row.id);
    message.success('已安排补发；失败历史会保留在记录中');
    gridApi.query();
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
          getFinalConfirmNotificationOutboxPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.FinalConfirmNotificationOutbox>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="最终确认通知投递">
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '补发',
              type: 'link',
              auth: ['container:order:update'],
              popConfirm: {
                title: '确定重新安排此通知投递吗？',
                confirm: handleResend.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
