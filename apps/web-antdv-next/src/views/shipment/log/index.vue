<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ShipmentApi } from '#/api/shipment';

import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOperationLogPage } from '#/api/shipment';

import { useGridColumns, useGridFormSchema } from './data';

const route = useRoute();
// 支持从订舱等业务页面带 businessType/businessId 跳转过来，直接定位到该单据的操作与通知日志；
// 作为表单默认值注入，而非仅拼进查询参数，避免首次渲染被空表单值覆盖，同时让筛选条件在界面上可见。
const businessType = route.query.businessType as string | undefined;
const rawBusinessId = Number(route.query.businessId);
const businessId = Number.isSafeInteger(rawBusinessId)
  ? rawBusinessId
  : undefined;

const [Grid] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema({ businessType, businessId }) },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getOperationLogPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
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
