<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FinanceEcApi } from '#/api/finance/ec';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Tag } from 'antdv-next';
import dayjs from 'dayjs';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportEcReportExcel,
  getLatestExchangeRate,
  getOrderTaskPage,
} from '#/api/finance/ec';

import { PLATFORM_OPTIONS } from '../sku-mapping/data';

const downloadingIds = ref<number[]>([]);

const platformLabel = (val: string) =>
  PLATFORM_OPTIONS.find((o) => o.value === val)?.label ?? val;

const RATE_CACHE_KEY = () => `EC_RATE_CAD_USD_${dayjs().format('YYYY-MM-DD')}`;

async function getCadRate(): Promise<number> {
  const raw = localStorage.getItem(RATE_CACHE_KEY());
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.rate) return parsed.rate;
    } catch {
      const v = Number.parseFloat(raw);
      if (!Number.isNaN(v)) return v;
    }
  }
  const res = await getLatestExchangeRate({ base: 'CAD', symbols: 'USD' });
  const rate = res?.rates?.USD;
  if (!rate) throw new Error('无法获取 CAD->USD 汇率');
  localStorage.setItem(
    RATE_CACHE_KEY(),
    JSON.stringify({ rate, date: res.date }),
  );
  return rate;
}

async function handleDownload(row: FinanceEcApi.ECOrderTask) {
  if (downloadingIds.value.includes(row.id)) return;
  downloadingIds.value.push(row.id);
  try {
    let exchangeRate = 1;
    if (row.platform.endsWith('_CA')) {
      const hide = message.loading({ content: '正在获取汇率...', duration: 0 });
      try {
        exchangeRate = await getCadRate();
      } finally {
        hide();
      }
    }
    const blob = await exportEcReportExcel({ taskId: row.id, exchangeRate });
    downloadFileFromBlobPart({
      fileName: `财务对账宽表-${row.taskNo}.xlsx`,
      source: blob as any,
    });
  } catch {
    message.error('导出失败');
  } finally {
    downloadingIds.value = downloadingIds.value.filter((id) => id !== row.id);
  }
}

const [Grid] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'taskNo',
        title: '任务编号',
        minWidth: 160,
        showOverflow: 'tooltip',
      },
      {
        field: 'platform',
        title: '平台',
        width: 120,
        slots: { default: 'platform' },
      },
      {
        field: 'fileName',
        title: '文件名',
        minWidth: 200,
        showOverflow: 'tooltip',
      },
      { field: 'billingYear', title: '账期年份', width: 100 },
      { field: 'billingPeriod', title: '账期', width: 130 },
      { field: 'totalRecords', title: '记录数', width: 90 },
      {
        field: 'processedTime',
        title: '处理时间',
        width: 180,
        formatter: 'formatDateTime',
      },
      { field: 'creator', title: '创建人', width: 100 },
      {
        field: 'createTime',
        title: '创建时间',
        width: 180,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 100,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }) =>
          getOrderTaskPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            taskStatus: 'PROCESSED',
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true },
  } as VxeTableGridOptions<FinanceEcApi.ECOrderTask>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="财务报表">
      <template #platform="{ row }">
        <Tag color="blue">{{ platformLabel(row.platform) }}</Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '下载',
              type: 'link',
              loading: downloadingIds.includes(row.id),
              auth: ['finance:crossborder:order-import:query'],
              onClick: handleDownload.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
