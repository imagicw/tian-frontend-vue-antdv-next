<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DormApi } from '#/api/dorm';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Tag,
} from 'antdv-next';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { createAllocation, getAllocationPage } from '#/api/dorm';

import {
  ALLOCATION_STATUS_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';

const TextArea = Input.TextArea;

// TODO: Full allocation creation form (see DormAllocationForm.tsx reference for dept tree + ratio/amount logic)
// Typically triggered from the Order list by selecting settled orders.

const router = useRouter();
const createOpen = ref(false);
const orderSerialInput = ref('');
const newAlloc = ref({
  allocationType: 1,
  settlementYear: new Date().getFullYear(),
  settlementMonth: undefined as number | undefined,
  remark: '',
  deptAllocations: [] as DormApi.DeptAllocation[],
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema() },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getAllocationPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<DormApi.DormFeeAllocation>,
});

function handleRefresh() {
  gridApi.query();
}

async function handleCreateConfirm() {
  const orderSerialList = orderSerialInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (orderSerialList.length === 0) {
    message.error('请输入订单号');
    return;
  }
  await createAllocation({
    ...newAlloc.value,
    orderSerialList,
    settlementYear: newAlloc.value.settlementYear,
    allocationType: newAlloc.value.allocationType,
    deptAllocations: [],
  });
  message.success('创建成功');
  createOpen.value = false;
  handleRefresh();
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="费用分摊列表">
      <template #status="{ row }">
        <Tag
          :color="ALLOCATION_STATUS_MAP[row.status ?? 0]?.color ?? 'default'"
        >
          {{ ALLOCATION_STATUS_MAP[row.status ?? 0]?.text ?? row.status }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '详情',
              type: 'link',
              onClick: () =>
                router.push(`/dorm/allocation/${row.allocationOrderNo}`),
            },
          ]"
        />
      </template>
    </Grid>

    <!-- Simplified create modal -->
    <Modal
      v-model:open="createOpen"
      title="新建费用分摊"
      @ok="handleCreateConfirm"
    >
      <Alert
        type="info"
        class="mb-3"
        message="通常从「住宿订单」页面选中已结算订单后发起分摊。此入口为直接输入订单号创建。"
      />
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium">订单号（多个以逗号分隔）</label>
          <TextArea
            v-model:value="orderSerialInput"
            :rows="3"
            placeholder="如：ORDER001, ORDER002"
          />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium">统计年份</label>
            <InputNumber
              v-model:value="newAlloc.settlementYear"
              class="w-full"
              placeholder="如：2024"
            />
          </div>
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium">统计月份</label>
            <Select
              v-model:value="newAlloc.settlementMonth"
              class="w-full"
              :options="
                Array.from({ length: 12 }, (_, i) => ({
                  label: `${i + 1} 月`,
                  value: i + 1,
                }))
              "
              placeholder="请选择月份"
              allow-clear
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">备注</label>
          <Input v-model:value="newAlloc.remark" placeholder="备注（选填）" />
        </div>
      </div>
    </Modal>
  </Page>
</template>
