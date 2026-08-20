<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOperationLogPage } from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';

const route = useRoute();

const [Grid] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        // 支持从订舱等业务页面带 businessType/businessId 跳转过来，直接定位到该单据的操作与通知日志。
        query: async ({ page }, formValues) =>
          getOperationLogPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            businessType: route.query.businessType as string | undefined,
            businessId: route.query.businessId
              ? Number(route.query.businessId)
              : undefined,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ShipmentApi.ShipmentOperationLog>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="操作日志" />
  </Page>
</template>
