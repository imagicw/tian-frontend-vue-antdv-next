<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, message, Popconfirm, Spin } from 'antdv-next';

import { VxeColumn, VxeTable } from '#/adapter/vxe-table';
import { getAllocationDetail, revokeAllocation } from '#/api/dorm';
import { useDescription } from '#/components/description';

import { useAllocationDetailSchema } from '../data';

const [AllocationDescriptions] = useDescription({
  bordered: true,
  column: 3,
  schema: useAllocationDetailSchema(),
  useCard: false,
});

const route = useRoute();
const router = useRouter();
const orderNo = route.params.orderNo as string;

const loading = ref(false);
const detail = ref<DormApi.DormFeeAllocation | null>(null);

async function loadDetail() {
  loading.value = true;
  try {
    detail.value = await getAllocationDetail(orderNo);
  } finally {
    loading.value = false;
  }
}

async function handleRevoke() {
  await revokeAllocation(orderNo);
  message.success('撤销成功');
  await loadDetail();
}

onMounted(loadDetail);
</script>

<template>
  <Page :title="`分摊详情：${orderNo}`" auto-content-height>
    <template #extra>
      <Button @click="router.back()">返回</Button>
    </template>

    <Spin :spinning="loading">
      <template v-if="detail">
        <!-- Header -->
        <div class="mb-4 rounded border bg-white p-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="font-medium">分摊信息</span>
            <Popconfirm
              v-if="detail.status === 0"
              title="确定要撤销此分摊单吗？"
              ok-type="danger"
              @confirm="handleRevoke"
            >
              <Button
                danger
                size="small"
                v-auth="'dorm:dept-fee-allocation:update'"
              >
                撤销
              </Button>
            </Popconfirm>
          </div>
          <AllocationDescriptions :data="detail" size="small" />
        </div>

        <!-- Dept allocations -->
        <div class="mb-4 rounded border bg-white p-4">
          <div class="mb-3 font-medium">部门分摊明细</div>
          <VxeTable
            :data="detail.deptAllocations ?? []"
            border
            show-overflow
            size="small"
          >
            <VxeColumn field="deptName" title="部门" min-width="120" />
            <VxeColumn field="allocationRatio" title="分摊比例" width="100">
              <template #default="{ row }">
                {{
                  row.allocationRatio != null
                    ? `${(row.allocationRatio * 100).toFixed(2)}%`
                    : '-'
                }}
              </template>
            </VxeColumn>
            <VxeColumn field="allocatedAmount" title="分摊金额" width="140">
              <template #default="{ row }">
                {{ row.allocatedAmount }}
                {{ row.settleCurrencyCode ?? detail.settleCurrencyCode }}
              </template>
            </VxeColumn>
            <VxeColumn field="remark" title="备注" min-width="120" />
          </VxeTable>
        </div>

        <!-- Included orders -->
        <div class="rounded border bg-white p-4">
          <div class="mb-3 font-medium">包含订单</div>
          <VxeTable
            :data="detail.orders ?? []"
            border
            show-overflow
            size="small"
          >
            <VxeColumn field="orderSerial" title="订单号" min-width="160" />
            <VxeColumn field="userName" title="申请人" width="100" />
            <VxeColumn field="orderFee" title="费用" width="120" />
            <VxeColumn title="操作" width="90">
              <template #default="{ row }">
                <Button
                  type="link"
                  size="small"
                  class="!p-0"
                  @click="router.push(`/dorm/order/${row.orderSerial}`)"
                >
                  查看订单
                </Button>
              </template>
            </VxeColumn>
          </VxeTable>
        </div>
      </template>

      <div
        v-else-if="!loading"
        class="flex items-center justify-center py-20 text-gray-400"
      >
        分摊单不存在
      </div>
    </Spin>
  </Page>
</template>
