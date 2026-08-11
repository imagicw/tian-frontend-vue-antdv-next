<script lang="ts" setup>
import type { FinanceEcApi } from '#/api/finance/ec';

import { computed, h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Modal as AModal,
  Button,
  InputNumber,
  message,
  Pagination,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antdv-next';
import dayjs from 'dayjs';

import { VxeColumn, VxeTable } from '#/adapter/vxe-table';
import {
  confirmOrderTask,
  exportEcReportExcel,
  getLatestExchangeRate,
  previewEcReport,
} from '#/api/finance/ec';

const emit = defineEmits(['confirmed']);

const task = ref<FinanceEcApi.ECOrderTask>();
const exchangeRate = ref(1);
const rateDate = ref('');
const rateBase = ref('USD');
const rateSymbol = ref('USD');
const rateLoading = ref(false);
const rateReady = ref(false);
const previewLoading = ref(false);
const previewData = ref<FinanceEcApi.ECOrder[]>([]);
const previewTotal = ref(0);
const pageNo = ref(1);
const pageSize = ref(20);
const confirming = ref(false);
const downloading = ref(false);

const isCA = computed(() => task.value?.platform?.endsWith('_CA') ?? false);
const currency = computed(() => (isCA.value ? 'CAD' : 'USD'));
const canConfirm = computed(
  () => task.value?.taskStatus === 'WAIT_DEDUCT_CONFIRM',
);

const RATE_CACHE_KEY = computed(
  () => `EC_RATE_CAD_USD_${dayjs().format('YYYY-MM-DD')}`,
);

async function fetchRate(): Promise<boolean> {
  rateLoading.value = true;
  try {
    const res = await getLatestExchangeRate({ base: 'CAD', symbols: 'USD' });
    if (res) {
      const { date, base, rates } = res;
      rateBase.value = base ?? 'CAD';
      const symbol = Object.keys(rates ?? {})[0];
      if (symbol) {
        rateSymbol.value = symbol;
        exchangeRate.value = rates[symbol]!;
        localStorage.setItem(
          RATE_CACHE_KEY.value,
          JSON.stringify({ rate: rates[symbol], date }),
        );
      }
      if (date) rateDate.value = date;
    }
    return true;
  } catch {
    message.error('获取汇率失败');
    return false;
  } finally {
    rateLoading.value = false;
    rateReady.value = true;
  }
}

function loadCachedRate(): boolean {
  const raw = localStorage.getItem(RATE_CACHE_KEY.value);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.rate) {
      exchangeRate.value = parsed.rate;
      rateDate.value = parsed.date ?? '';
      rateBase.value = 'CAD';
      rateSymbol.value = 'USD';
      rateReady.value = true;
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function loadPreview() {
  if (!task.value) return;
  previewLoading.value = true;
  try {
    const res = await previewEcReport({
      taskId: task.value.id,
      exchangeRate: exchangeRate.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    previewData.value = res.list;
    previewTotal.value = res.total;
  } finally {
    previewLoading.value = false;
  }
}

async function handleRefreshRate() {
  const ok = await fetchRate();
  if (ok) await loadPreview();
}

async function onPageChange(page: number, size: number) {
  pageNo.value = page;
  pageSize.value = size;
  await loadPreview();
}

const [Modal, modalApi] = useVbenModal({
  class: 'w-[1200px]',
  showCancelButton: false,
  showConfirmButton: false,
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      rateReady.value = false;
      previewData.value = [];
      pageNo.value = 1;
      return;
    }
    task.value = modalApi.getData<FinanceEcApi.ECOrderTask>();
    if (isCA.value) {
      rateReady.value = false;
      if (!loadCachedRate()) await fetchRate();
    } else {
      exchangeRate.value = 1;
      rateBase.value = rateSymbol.value = 'USD';
      rateDate.value = '';
      rateReady.value = true;
    }
    await loadPreview();
  },
});

function editRate() {
  let tmp = exchangeRate.value;
  AModal.confirm({
    title: '修改汇率',
    content: () =>
      h(InputNumber as any, {
        defaultValue: exchangeRate.value,
        min: 0.0001,
        step: 0.0001,
        precision: 5,
        style: 'width: 100%',
        onChange: (val: null | number) => {
          if (val) tmp = val;
        },
      }),
    onOk: async () => {
      if (tmp !== exchangeRate.value) {
        exchangeRate.value = tmp;
        await loadPreview();
      }
    },
  });
}

async function handleConfirm() {
  if (!task.value) return;
  confirming.value = true;
  try {
    await confirmOrderTask(task.value.id);
    message.success('扣减确认成功');
    emit('confirmed');
    modalApi.close();
  } finally {
    confirming.value = false;
  }
}

async function handleConfirmAndDownload() {
  if (!task.value) return;
  confirming.value = true;
  try {
    await confirmOrderTask(task.value.id);
    message.success('扣减确认成功，正在导出报表...');
    emit('confirmed');
    const blob = await exportEcReportExcel({
      taskId: task.value.id,
      exchangeRate: exchangeRate.value,
    });
    downloadFileFromBlobPart({
      fileName: `财务对账宽表-${task.value.id}.xlsx`,
      source: blob as any,
    });
    modalApi.close();
  } finally {
    confirming.value = false;
  }
}

async function handleDownloadCsv() {
  if (!task.value) return;
  downloading.value = true;
  try {
    const blob = await exportEcReportExcel({
      taskId: task.value.id,
      exchangeRate: exchangeRate.value,
    });
    downloadFileFromBlobPart({
      fileName: `订单预览_${task.value.id}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`,
      source: blob as any,
    });
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <Modal title="订单预览">
    <template v-if="task">
      <Alert v-if="isCA" type="info" show-icon class="mb-4">
        <template #message>
          <Space wrap>
            <Typography.Text>
              汇率 ({{ rateBase }} → {{ rateSymbol }})
              <Typography.Text v-if="rateDate" type="secondary">
                ({{ rateDate }})
</Typography.Text>:
            </Typography.Text>
            <Spin :spinning="rateLoading" size="small">
              <Typography.Text
                class="cursor-pointer rounded bg-gray-50 px-2 py-1"
                @click="editRate"
              >
                {{ exchangeRate.toFixed(5) }}
              </Typography.Text>
            </Spin>
            <Button
              size="small"
              :loading="rateLoading"
              @click="handleRefreshRate"
            >
              刷新汇率
            </Button>
          </Space>
        </template>
      </Alert>

      <div v-if="!rateReady" class="flex items-center justify-center py-10">
        <Spin tip="正在获取汇率..." />
      </div>
      <template v-else>
        <div class="mb-2 flex justify-end">
          <Button :loading="downloading" @click="handleDownloadCsv">
下载订单
</Button>
        </div>
        <div class="overflow-auto">
          <VxeTable
            :data="previewData"
            :loading="previewLoading"
            show-overflow
            size="mini"
          >
            <VxeColumn field="isOversold" title="超卖" width="70">
              <template #default="{ row }">
                <Tag :color="row.isOversold ? 'error' : 'default'">
                  {{ row.isOversold ? '是' : '否' }}
                </Tag>
              </template>
            </VxeColumn>
            <VxeColumn field="sku" title="公司SKU" width="140" show-overflow />
            <VxeColumn
              field="productName"
              title="品名"
              width="150"
              show-overflow
            />
            <VxeColumn field="unitPrice" title="单价" width="80" />
            <VxeColumn field="quantity" title="数量" width="60" />
            <VxeColumn
              field="originalSalesAmount"
              :title="`金额(${currency})`"
              width="110"
            />
            <VxeColumn field="usdSalesAmount" title="金额(USD)" width="110" />
            <VxeColumn
              field="commissionFee"
              :title="`佣金(${currency})`"
              width="100"
            />
            <VxeColumn
              field="lastMileFee"
              :title="`尾程(${currency})`"
              width="110"
            />
            <VxeColumn
              field="refundAmount"
              :title="`退款(${currency})`"
              width="110"
            />
            <VxeColumn field="refundUsd" title="退款(USD)" width="100" />
            <VxeColumn field="returnQtyResalable" title="退回可售" width="80" />
            <VxeColumn
              field="returnQtyNonResalable"
              title="退回不可售"
              width="90"
            />
            <VxeColumn field="unitCost" title="单位成本(CNY)" width="110" />
            <VxeColumn field="totalCost" title="商品成本(CNY)" width="110" />
            <VxeColumn
              field="customsNo"
              title="报关单号"
              width="160"
              show-overflow
            />
          </VxeTable>
        </div>
        <div class="mt-2 flex justify-end">
          <Pagination
            :current="pageNo"
            :page-size="pageSize"
            :total="previewTotal"
            size="small"
            @change="onPageChange"
          />
        </div>
      </template>
    </template>

    <template #footer>
      <Space>
        <Button @click="modalApi.close()">
          {{ canConfirm ? '取消' : '关闭' }}
        </Button>
        <template v-if="canConfirm">
          <Button :loading="confirming" @click="handleConfirm">确认扣减</Button>
          <Button
            type="primary"
            :loading="confirming"
            @click="handleConfirmAndDownload"
          >
            确认扣减并下载
          </Button>
        </template>
      </Space>
    </template>
  </Modal>
</template>
