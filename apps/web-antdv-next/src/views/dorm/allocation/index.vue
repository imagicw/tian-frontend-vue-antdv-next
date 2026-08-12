<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DormApi } from '#/api/dorm';
import type { SystemUserApi } from '#/api/system/user';

import { h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, Input, message, Modal, Table, Tag, Tooltip } from 'antdv-next';
import dayjs from 'dayjs';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAllocationPage, getOrderPage } from '#/api/dorm';
import { getSimpleUserList } from '#/api/system/user';

import { ALLOCATION_STATUS_MAP, useGridColumns, useGridFormSchema } from './data';
import AllocationForm from './modules/allocation-form.vue';

// Primary entry point is the settled-order multi-select on the Order list page
// (see order-list.vue). This modal is a fallback: pick from settled orders here.

const router = useRouter();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: AllocationForm,
  destroyOnClose: true,
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

// ─── Order picker modal ────────────────────────────────────────────────────
const pickerOpen = ref(false);
const pickerLoading = ref(false);
const pickerOrders = ref<DormApi.DormOrder[]>([]);
const pickerTotal = ref(0);
const pickerSerial = ref('');
const pickerPageNo = ref(1);
const pickerPageSize = ref(10);
const selectedKeys = ref<string[]>([]);
const selectedOrders = ref<DormApi.DormOrder[]>([]);
const users = ref<SystemUserApi.User[]>([]);

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

const pickerColumns = [
  { title: '订单号', dataIndex: 'orderSerial', key: 'orderSerial' },
  {
    title: '申请人',
    key: 'userName',
    width: 100,
    render: (_value: unknown, record: DormApi.DormOrder) =>
      record.userName ||
      users.value.find((u) => String(u.id) === String(record.userId))
        ?.nickname ||
      '-',
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

async function loadPickerOrders() {
  pickerLoading.value = true;
  try {
    const data = await getOrderPage({
      pageNo: pickerPageNo.value,
      pageSize: pickerPageSize.value,
      status: 3,
      orderSerial: pickerSerial.value || undefined,
    });
    pickerOrders.value = data.list ?? [];
    pickerTotal.value = data.total ?? 0;
  } finally {
    pickerLoading.value = false;
  }
}

function handlePickerSearch() {
  pickerPageNo.value = 1;
  loadPickerOrders();
}

function handlePickerTableChange(pagination: {
  current?: number;
  pageSize?: number;
}) {
  pickerPageNo.value = pagination.current ?? 1;
  pickerPageSize.value = pagination.pageSize ?? 10;
  loadPickerOrders();
}

function handleSelectionChange(
  keys: (number | string)[],
  rows: DormApi.DormOrder[],
) {
  selectedKeys.value = keys as string[];
  // Merge across pages: keep previously-selected rows from other pages.
  const rowsByKey = new Map(rows.map((row) => [row.orderSerial!, row]));
  selectedOrders.value = [
    ...selectedOrders.value.filter(
      (order) =>
        selectedKeys.value.includes(order.orderSerial!) &&
        !rowsByKey.has(order.orderSerial!),
    ),
    ...rows,
  ];
}

function openPicker() {
  pickerSerial.value = '';
  pickerPageNo.value = 1;
  selectedKeys.value = [];
  selectedOrders.value = [];
  pickerOpen.value = true;
  loadPickerOrders();
  if (users.value.length === 0) {
    getSimpleUserList()
      .then((data) => (users.value = data))
      .catch(() => {});
  }
}

function handlePickerConfirm() {
  if (selectedOrders.value.length === 0) {
    message.error('请至少选择一个已结算订单');
    return;
  }
  const currencies = new Set(
    selectedOrders.value.map((order) => order.settleCurrencyCode),
  );
  if (currencies.size > 1) {
    message.error('所选订单存在多个币种，请选择相同币种的订单');
    return;
  }
  const areas = new Set(
    selectedOrders.value.map((order) => order.dormOrderSnapshot?.areaName),
  );
  if (areas.size > 1) {
    message.error('所选订单存在多个区域，请选择相同区域的订单');
    return;
  }
  pickerOpen.value = false;
  const orders = selectedOrders.value.map((order) => ({
    ...order,
    userName:
      order.userName ||
      users.value.find((u) => String(u.id) === String(order.userId))
        ?.nickname,
  }));
  formModalApi.setData({ orders }).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />

    <Grid table-title="费用分摊列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新建费用分摊',
              type: 'primary',
              onClick: openPicker,
            },
          ]"
        />
      </template>
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

    <!-- Order picker: select settled orders to create an allocation -->
    <Modal
      v-model:open="pickerOpen"
      title="选择已结算订单"
      width="800px"
      @ok="handlePickerConfirm"
    >
      <div class="mb-3 flex items-center gap-2">
        <Input
          v-model:value="pickerSerial"
          allow-clear
          placeholder="按订单号搜索"
          class="w-[240px]"
          @press-enter="handlePickerSearch"
        />
        <Button @click="handlePickerSearch">搜索</Button>
        <span class="text-muted-foreground ml-auto text-sm">
          已选 {{ selectedOrders.length }} 个订单
        </span>
      </div>
      <Table
        :data-source="pickerOrders"
        :columns="pickerColumns"
        :loading="pickerLoading"
        :pagination="{
          current: pickerPageNo,
          pageSize: pickerPageSize,
          total: pickerTotal,
        }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: handleSelectionChange,
        }"
        row-key="orderSerial"
        size="small"
        @change="handlePickerTableChange"
      />
    </Modal>
  </Page>
</template>
