<script lang="ts" setup>
import type { FinanceEcApi } from '#/api/finance/ec';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message, Pagination, Tag } from 'antdv-next';

import { VxeColumn, VxeTable } from '#/adapter/vxe-table';
import { getInventoryLogPage } from '#/api/finance/ec';

const OPERATION_TYPE_MAP: Record<string, { color: string; text: string }> = {
  IMPORT: { text: '初始导入', color: 'blue' },
  ORDER_DEDUCT: { text: '订单扣减', color: 'red' },
  MANUAL_FIX: { text: '手动修正', color: 'orange' },
  ROLLBACK: { text: '回滚', color: 'purple' },
};

const loading = ref(false);
const logs = ref<FinanceEcApi.ECInventoryLog[]>([]);
const inventory = ref<FinanceEcApi.ECInventory>();
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);

async function fetchLogs() {
  if (!inventory.value) return;
  loading.value = true;
  try {
    const res = await getInventoryLogPage({
      gtSku: inventory.value.gtSku,
      shipmentNo: inventory.value.shipmentNo,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    logs.value = res.list;
    total.value = res.total;
  } catch {
    message.error('加载日志失败');
  } finally {
    loading.value = false;
  }
}

async function onPageChange(page: number, size: number) {
  pageNo.value = page;
  pageSize.value = size;
  await fetchLogs();
}

const [Drawer, drawerApi] = useVbenDrawer({
  class: '!w-[1100px]',
  footer: false,
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    inventory.value = drawerApi.getData<FinanceEcApi.ECInventory>();
    pageNo.value = 1;
    pageSize.value = 20;
    await fetchLogs();
  },
});
</script>

<template>
  <Drawer :title="`库存变动日志 - ${inventory?.customsNo ?? ''}`">
    <div class="overflow-auto">
      <VxeTable :data="logs" :loading="loading" show-overflow size="small">
        <VxeColumn field="id" title="ID" width="70" />
        <VxeColumn field="changeQty" title="变动数量" width="90">
          <template #default="{ row }">
            <span
              :style="{ color: row.changeQty >= 0 ? '#52c41a' : '#ff4d4f' }"
            >
              {{ row.changeQty >= 0 ? '+' : '' }}{{ row.changeQty }}
            </span>
          </template>
        </VxeColumn>
        <VxeColumn field="currentRemaining" title="当前剩余" width="90" />
        <VxeColumn field="operationType" title="操作类型" width="110">
          <template #default="{ row }">
            <Tag
              :color="OPERATION_TYPE_MAP[row.operationType]?.color ?? 'default'"
            >
              {{
                OPERATION_TYPE_MAP[row.operationType]?.text ?? row.operationType
              }}
            </Tag>
          </template>
        </VxeColumn>
        <VxeColumn
          field="relatedOrderNo"
          title="关联订单号"
          min-width="160"
          show-overflow
        />
        <VxeColumn field="creator" title="创建人" width="90" />
        <VxeColumn field="createTime" title="创建时间" width="170" />
        <VxeColumn field="remark" title="备注" min-width="120" show-overflow />
      </VxeTable>
    </div>
    <div class="mt-3 flex justify-end">
      <Pagination
        :current="pageNo"
        :page-size="pageSize"
        :total="total"
        size="small"
        @change="onPageChange"
      />
    </div>
  </Drawer>
</template>
