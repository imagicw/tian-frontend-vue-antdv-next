<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, h, onMounted, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { handleTree } from '@vben/utils';

import {
  Alert,
  Button,
  Divider,
  Input,
  InputNumber,
  message,
  RadioButton,
  RadioGroup,
  Select,
  Table,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antdv-next';
import dayjs from 'dayjs';

import { createAllocation } from '#/api/dorm';
import { getSimpleDeptList } from '#/api/system/dept';

interface AllocationRow {
  deptId?: number;
  allocationRatio?: number;
  allocatedAmount?: number;
  remark?: string;
}

const emit = defineEmits<{ success: [] }>();

const { Text } = Typography;

const orders = ref<DormApi.DormOrder[]>([]);
const errorMessage = ref('');

const allocationType = ref(1);
const settlementYear = ref<number>(new Date().getFullYear());
const settlementMonth = ref<number | undefined>();
const remark = ref('');
const rows = ref<AllocationRow[]>([]);

const deptList = ref<SystemDeptApi.Dept[]>([]);
const deptTree = ref<any[]>([]);

function getGuestNames(order: DormApi.DormOrder) {
  return (
    order.dormOrderSnapshot?.checkInInfo
      ?.flatMap((group) => group.checkInPersons ?? [])
      .map((person) => person.name)
      .filter(Boolean) ?? []
  );
}

function getGuestSummary(order: DormApi.DormOrder) {
  const names = getGuestNames(order);
  if (names.length === 0) return '未填写';
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 人`;
}

function getStartTime(order: DormApi.DormOrder) {
  return order.serveStartTime || order.dormOrderSnapshot?.serveStartTime;
}

function getEndTime(order: DormApi.DormOrder) {
  return order.serveEndTime || order.dormOrderSnapshot?.serveEndTime;
}

function formatServiceDate(value?: string) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value;
}

const orderColumns = [
  { title: '订单号', dataIndex: 'orderSerial', key: 'orderSerial' },
  {
    title: '申请人',
    key: 'userName',
    width: 100,
    render: (_value: unknown, record: DormApi.DormOrder) =>
      record.userName || '-',
  },
  {
    title: '区域',
    key: 'areaName',
    width: 140,
    render: (_value: unknown, record: DormApi.DormOrder) =>
      record.dormOrderSnapshot?.areaName ?? '-',
  },
  {
    title: '入住信息',
    key: 'checkInInfo',
    width: 160,
    render: (_value: unknown, record: DormApi.DormOrder) =>
      h(
        Tooltip,
        {
          title: () =>
            h('div', { class: 'max-w-[260px] space-y-1' }, [
              h(
                'div',
                {},
                `入住时间：${formatServiceDate(getStartTime(record))} ~ ${formatServiceDate(getEndTime(record))}`,
              ),
              h('div', {}, `入住人：${getGuestNames(record).join('、') || '未填写'}`),
            ]),
        },
        {
          default: () =>
            h(
              'span',
              { class: 'cursor-help underline decoration-dotted' },
              getGuestSummary(record),
            ),
        },
      ),
  },
  {
    title: '费用',
    key: 'orderFee',
    width: 120,
    render: (_value: unknown, record: DormApi.DormOrder) =>
      `${record.orderFee ?? 0} ${record.settleCurrencyCode ?? ''}`,
  },
];

const totalPrice = computed(() =>
  orders.value.reduce((sum, order) => sum + (order.orderFee || 0), 0),
);
const currency = computed(() => orders.value[0]?.settleCurrencyCode);

const totalAllocatedAmount = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.allocatedAmount || 0), 0),
);
const totalAllocatedRatio = computed(() =>
  totalPrice.value > 0
    ? (totalAllocatedAmount.value / totalPrice.value) * 100
    : 0,
);
const balance = computed(() => totalPrice.value - totalAllocatedAmount.value);

function formatAmount(value: number) {
  return `${value.toFixed(2)} ${currency.value ?? ''}`.trim();
}

function validateOrders(list: DormApi.DormOrder[]) {
  if (list.length === 0) return '请至少选择一个订单';
  const currencies = new Set(list.map((order) => order.settleCurrencyCode));
  if (currencies.size > 1) {
    return '所选订单存在多个币种，请选择相同币种的订单进行分摊';
  }
  const areas = new Set(
    list.map((order) => order.dormOrderSnapshot?.areaName),
  );
  if (areas.size > 1) {
    return '所选订单存在多个区域，请选择相同区域的订单进行分摊';
  }
  if (list.some((order) => order.status !== 3)) {
    return '所选订单中含有未结算或已分摊的订单，请重新选择';
  }
  return '';
}

function recomputeAmounts() {
  if (allocationType.value !== 1 || rows.value.length === 0) return;
  const total = totalPrice.value;
  const totalRatio = rows.value.reduce(
    (sum, row) => sum + (row.allocationRatio || 0),
    0,
  );
  if (Math.abs(totalRatio - 100) < 0.001) {
    let sumOfAllButLast = 0;
    const lastIndex = rows.value.length - 1;
    rows.value.forEach((row, index) => {
      if (index === lastIndex) return;
      const amount = Number(
        ((total * (row.allocationRatio || 0)) / 100).toFixed(2),
      );
      row.allocatedAmount = amount;
      sumOfAllButLast += amount;
    });
    const lastRow = rows.value[lastIndex];
    if (lastRow) {
      lastRow.allocatedAmount = Number(
        (total - sumOfAllButLast).toFixed(2),
      );
    }
  } else {
    rows.value.forEach((row) => {
      row.allocatedAmount = Number(
        ((total * (row.allocationRatio || 0)) / 100).toFixed(2),
      );
    });
  }
}

function handleAllocationTypeChange() {
  recomputeAmounts();
}

function addRow() {
  rows.value.push({});
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
  recomputeAmounts();
}

function markNonLeafDisabled(nodes: any[]): any[] {
  return nodes.map((node) => {
    const hasChildren = !!node.children && node.children.length > 0;
    return {
      ...node,
      disabled: hasChildren,
      children: hasChildren ? markNonLeafDisabled(node.children) : undefined,
    };
  });
}

const baseDeptTree = computed(() => markNonLeafDisabled(deptTree.value));

function treeDataForRow(index: number) {
  const otherIds = new Set(
    rows.value
      .filter((_, i) => i !== index)
      .map((row) => row.deptId)
      .filter((id): id is number => id !== undefined),
  );
  function mark(nodes: any[]): any[] {
    return nodes.map((node) => ({
      ...node,
      disabled: node.disabled || otherIds.has(node.id),
      children: node.children ? mark(node.children) : undefined,
    }));
  }
  return mark(baseDeptTree.value);
}

function findDeptName(id?: number) {
  return deptList.value.find((dept) => dept.id === id)?.name;
}

function validateRows(): string {
  if (rows.value.length === 0) return '请至少添加一个分摊部门';
  if (rows.value.some((row) => !row.deptId)) return '请为每一行选择分摊部门';
  if (allocationType.value === 1) {
    if (
      rows.value.some(
        (row) => row.allocationRatio === undefined || row.allocationRatio <= 0,
      )
    ) {
      return '请为每一行填写分摊比例';
    }
    const totalRatio = rows.value.reduce(
      (sum, row) => sum + (row.allocationRatio || 0),
      0,
    );
    if (totalRatio > 100.001) return '总分摊比例不能超过 100%';
  } else {
    if (
      rows.value.some(
        (row) =>
          row.allocatedAmount === undefined || row.allocatedAmount <= 0,
      )
    ) {
      return '请为每一行填写分摊金额';
    }
    const totalAmount = rows.value.reduce(
      (sum, row) => sum + (row.allocatedAmount || 0),
      0,
    );
    if (totalAmount > totalPrice.value + 0.001) {
      return '总分摊金额不能超过总金额';
    }
  }
  return '';
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (errorMessage.value) return;
    if (!settlementYear.value) {
      message.error('请填写统计年份');
      return;
    }
    const rowsError = validateRows();
    if (rowsError) {
      message.error(rowsError);
      return;
    }
    modalApi.lock();
    try {
      await createAllocation({
        orderSerialList: orders.value
          .map((order) => order.orderSerial)
          .filter((serial): serial is string => !!serial),
        allocationType: allocationType.value,
        settlementYear: settlementYear.value,
        settlementMonth: settlementMonth.value,
        remark: remark.value || undefined,
        deptAllocations: rows.value.map((row) => ({
          deptId: row.deptId!,
          deptName: findDeptName(row.deptId),
          allocationRatio:
            allocationType.value === 1
              ? (row.allocationRatio ?? 0) / 100
              : undefined,
          allocatedAmount: row.allocatedAmount,
          remark: row.remark,
          settleCurrencyCode: currency.value,
        })),
      });
      message.success('创建成功');
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      orders.value = [];
      errorMessage.value = '';
      rows.value = [];
      return;
    }
    const data = modalApi.getData<{ orders: DormApi.DormOrder[] }>();
    orders.value = data?.orders ?? [];
    errorMessage.value = validateOrders(orders.value);
    allocationType.value = 1;
    settlementYear.value = new Date().getFullYear();
    settlementMonth.value = undefined;
    remark.value = '';
    if (!errorMessage.value) {
      rows.value = [
        { deptId: undefined, allocationRatio: 100, allocatedAmount: totalPrice.value },
      ];
    } else {
      rows.value = [];
    }
  },
});

onMounted(async () => {
  const data = await getSimpleDeptList();
  deptList.value = data;
  deptTree.value = handleTree(data);
});
</script>

<template>
  <Modal title="费用分摊" class="w-[900px]">
    <template v-if="errorMessage">
      <Alert type="warning" show-icon :message="errorMessage" />
    </template>
    <template v-else>
      <Divider title-placement="center" plain>结算费用明细</Divider>
      <div class="mb-2 flex items-center justify-between px-1">
        <span class="text-sm text-gray-500">{{ orders.length }} 个订单</span>
        <Text strong>合计：{{ formatAmount(totalPrice) }}</Text>
      </div>
      <Table
        :data-source="orders"
        :columns="orderColumns"
        :pagination="false"
        size="small"
        row-key="orderSerial"
        :scroll="{ y: 220 }"
      />

      <Divider title-placement="center" plain>分摊方案</Divider>

      <!-- Row 1: 分摊方式 + 统计年月 -->
      <div class="grid grid-cols-2 gap-x-6 px-1">
        <div>
          <label class="mb-1 block text-sm font-medium">分摊方式</label>
          <RadioGroup
            v-model:value="allocationType"
            button-style="solid"
            @change="handleAllocationTypeChange"
          >
            <RadioButton :value="1">按比例分摊</RadioButton>
            <RadioButton :value="2">按金额分摊</RadioButton>
          </RadioGroup>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">统计年月</label>
          <div class="flex gap-2">
            <InputNumber
              v-model:value="settlementYear"
              class="flex-1"
              :precision="0"
              placeholder="年份，如：2024"
            />
            <Select
              v-model:value="settlementMonth"
              class="flex-1"
              :options="
                Array.from({ length: 12 }, (_, i) => ({
                  label: `${i + 1} 月`,
                  value: i + 1,
                }))
              "
              placeholder="月份（选填）"
              allow-clear
            />
          </div>
        </div>
      </div>

      <!-- Row 2: 分摊部门 -->
      <div class="mt-4 px-1">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">分摊部门</span>
          <Button size="small" @click="addRow">
            <IconifyIcon icon="lucide:plus" />
            新增分摊部门
          </Button>
        </div>

        <div
          v-for="(row, index) in rows"
          :key="index"
          class="mb-2 flex items-center gap-2"
        >
          <TreeSelect
            v-model:value="row.deptId"
            class="w-[220px]"
            placeholder="请选择部门"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
            :tree-data="treeDataForRow(index)"
            tree-default-expand-all
            tree-node-filter-prop="name"
            show-search
          />
          <InputNumber
            v-if="allocationType === 1"
            v-model:value="row.allocationRatio"
            class="w-[130px]"
            :min="0.01"
            :max="100"
            :precision="2"
            :formatter="(value: any) => (value ? `${value}%` : '')"
            placeholder="分摊比例"
            @change="recomputeAmounts"
          />
          <InputNumber
            v-model:value="row.allocatedAmount"
            class="w-[150px]"
            :min="0.01"
            :max="totalPrice"
            :precision="2"
            :disabled="allocationType === 1"
            :placeholder="allocationType === 1 ? '自动计算' : '请输入分摊金额'"
          />
          <Input
            v-model:value="row.remark"
            class="flex-1"
            placeholder="备注（选填）"
          />
          <Button
            type="text"
            danger
            :disabled="rows.length <= 1"
            @click="removeRow(index)"
          >
            <IconifyIcon icon="lucide:trash-2" />
          </Button>
        </div>

        <div class="mt-2 text-right">
          <Text strong>
            已分摊 {{ formatAmount(totalAllocatedAmount) }}
            ({{ totalAllocatedRatio.toFixed(2) }}%)
          </Text>
          <Text
            v-if="Math.abs(balance) > 0.001"
            :type="balance >= 0 ? 'warning' : 'danger'"
            class="ml-2"
          >
            {{ balance >= 0 ? '剩余 ' : '超出 '
            }}{{ formatAmount(Math.abs(balance)) }}
            ({{ (100 - totalAllocatedRatio).toFixed(2) }}%)
          </Text>
        </div>
      </div>

      <!-- Row 3: 备注 -->
      <div class="mt-4 px-1">
        <label class="mb-1 block text-sm font-medium">备注</label>
        <Input v-model:value="remark" placeholder="备注（选填）" />
      </div>
    </template>
  </Modal>
</template>
