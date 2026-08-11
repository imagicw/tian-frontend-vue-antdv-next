<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Col,
  Descriptions,
  DescriptionsItem,
  Divider,
  Empty,
  message,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  confirmConsolidation,
  getClientProfileByCode,
  getClientProfileSimpleList,
  getNotBookedOrderPage,
  suggestConsolidation,
} from '#/api/shipment';

const PORT_OPTIONS = [
  { label: '上海港', value: 'shanghai' },
  { label: '青岛港', value: 'qingdao' },
];
const CONTAINER_TYPE_OPTIONS = ['40GP', '40HQ', '20GP'].map((v) => ({
  label: v,
  value: v,
}));
const BOOKING_TYPE_OPTIONS = [
  { label: '拼柜', value: 1 },
  { label: '散货', value: 2 },
];

const clientOptions = ref<{ label: string; value: string }[]>([]);
const selectedClientCode = ref('');
const clientProfile = ref<null | ShipmentApi.ClientProfile>(null);
const orderTableData = ref<ShipmentApi.ShipmentOrder[]>([]);
const selectedOrderIds = ref<number[]>([]);
const suggestResult = ref<null | ShipmentApi.ConsolidationSuggestResult>(null);
const loading = ref(false);
const confirming = ref(false);

async function loadClients() {
  const list = await getClientProfileSimpleList();
  clientOptions.value = list.map((c) => ({
    label: `${c.clientName} (${c.clientCode})`,
    value: c.clientCode,
  }));
}

async function loadOrders() {
  if (!selectedClientCode.value) return;
  const res = await getNotBookedOrderPage({
    pageNo: 1,
    pageSize: 200,
    clientCode: selectedClientCode.value,
  });
  orderTableData.value = (res as any).list ?? [];
  selectedOrderIds.value = [];
  suggestResult.value = null;
}

async function loadClientProfile(code: string) {
  clientProfile.value = await getClientProfileByCode(code);
}

async function handleClientChange(code: unknown) {
  if (typeof code !== 'string') return;
  selectedClientCode.value = code;
  await Promise.all([loadOrders(), loadClientProfile(code)]);
}

function handleOrderSelectionChange(keys: any[]) {
  selectedOrderIds.value = keys.map(Number);
}

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 110 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'bookingType',
      label: '订舱类型',
      component: 'RadioGroup',
      componentProps: { options: BOOKING_TYPE_OPTIONS, optionType: 'button' },
      rules: 'required',
      defaultValue: 1,
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'containerType',
      label: '箱型',
      component: 'Select',
      componentProps: {
        options: CONTAINER_TYPE_OPTIONS,
        placeholder: '请选择箱型',
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'freightForwarder',
      label: '货代',
      component: 'Input',
      componentProps: { placeholder: '请输入货代' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'productionCountry',
      label: '生产国',
      component: 'Input',
      componentProps: { placeholder: '请输入生产国' },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'departurePort',
      label: '出发港',
      component: 'Select',
      componentProps: {
        options: PORT_OPTIONS,
        placeholder: '请选择出发港',
        allowClear: true,
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'maxAllowedDays',
      label: '最大交期跨度',
      component: 'InputNumber',
      componentProps: { min: 1, max: 999, class: 'w-full' },
      formItemClass: 'col-span-2',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

const orderColumns = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: '颜色', dataIndex: 'color', key: 'color' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  { title: '总体积(CBM)', dataIndex: 'totalVolume', key: 'totalVolume' },
  {
    title: '装柜工厂',
    dataIndex: 'loadingFactoryName',
    key: 'loadingFactoryName',
  },
];

const planOrderColumns = [
  { title: 'PO号', dataIndex: 'poNo', key: 'poNo' },
  { title: '款号', dataIndex: 'styleNo', key: 'styleNo' },
  { title: '颜色', dataIndex: 'color', key: 'color' },
  { title: '数量', dataIndex: 'qty', key: 'qty' },
  { title: '体积', dataIndex: 'volume', key: 'volume' },
  { title: '交期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
  {
    title: '装柜工厂',
    dataIndex: 'loadingFactoryName',
    key: 'loadingFactoryName',
  },
];

async function handleSuggest() {
  if (selectedOrderIds.value.length === 0) {
    message.warning('请先选择订单');
    return;
  }
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = (await formApi.getValues()) as any;
  loading.value = true;
  try {
    suggestResult.value = await suggestConsolidation({
      clientCode: selectedClientCode.value,
      bookingType: values.bookingType,
      containerType: values.containerType,
      freightForwarder: values.freightForwarder,
      productionCountry: values.productionCountry,
      departurePort: values.departurePort,
      maxAllowedDays: values.maxAllowedDays,
      orderIds: selectedOrderIds.value,
    });
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  if (!suggestResult.value?.plans.length) {
    message.warning('请先生成拼柜方案');
    return;
  }
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = (await formApi.getValues()) as any;
  confirming.value = true;
  try {
    await confirmConsolidation({
      clientCode: selectedClientCode.value,
      bookingType: values.bookingType,
      plans: suggestResult.value.plans.map((p) => ({
        planId: p.planId,
        departurePort: p.departurePort,
        containerType: p.containerType,
        orderIds: (p.orders ?? []).map((o) => o.orderId),
      })),
    });
    message.success('拼柜方案已确认，订舱已创建');
    suggestResult.value = null;
    await loadOrders();
  } finally {
    confirming.value = false;
  }
}

loadClients();
</script>

<template>
  <Page>
    <Card title="智能拼柜" class="mb-4">
      <div class="mb-4 flex items-center gap-3">
        <span class="text-sm font-medium">选择客户：</span>
        <Select
          v-model:value="selectedClientCode"
          :options="clientOptions"
          placeholder="请选择客户"
          class="w-64"
          show-search
          option-filter-prop="label"
          @change="handleClientChange"
        />
      </div>

      <template v-if="clientProfile">
        <Descriptions size="small" :column="4" bordered class="mb-4">
          <DescriptionsItem label="允许箱型">
{{
            clientProfile.allowedContainerTypes ?? '-'
          }}
</DescriptionsItem>
          <DescriptionsItem label="拼柜交期跨度">
{{
            clientProfile.consolidationDeliveryDays != null
              ? `${clientProfile.consolidationDeliveryDays} 天`
              : '-'
          }}
</DescriptionsItem>
          <DescriptionsItem label="两地装货">
            <Tag
              :color="clientProfile.allowMultiLocation ? 'success' : 'default'"
            >
              {{ clientProfile.allowMultiLocation ? '允许' : '不允许' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="允许港口">
{{
            clientProfile.allowedPorts ?? '-'
          }}
</DescriptionsItem>
        </Descriptions>
      </template>
    </Card>

    <template v-if="selectedClientCode">
      <Row :gutter="16">
        <Col :span="14">
          <Card title="待订舱订单" :bordered="false" size="small">
            <Table
              :data-source="orderTableData"
              :columns="orderColumns"
              :pagination="{ pageSize: 20 }"
              :row-selection="{
                selectedRowKeys: selectedOrderIds,
                onChange: handleOrderSelectionChange,
              }"
              row-key="id"
              size="small"
              :scroll="{ x: 700 }"
            />
            <div class="mt-2 text-sm text-gray-500">
              已选 {{ selectedOrderIds.length }} 条订单
            </div>
          </Card>
        </Col>
        <Col :span="10">
          <Card title="拼柜参数" :bordered="false" size="small">
            <Form class="mt-2" />
            <div class="flex gap-2">
              <Button
                type="primary"
                :loading="loading"
                :disabled="selectedOrderIds.length === 0"
                @click="handleSuggest"
              >
                生成拼柜方案
              </Button>
              <Button
                v-if="suggestResult?.plans.length"
                type="primary"
                ghost
                :loading="confirming"
                @click="handleConfirm"
              >
                确认方案并创建订舱
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <template v-if="suggestResult">
        <Divider>拼柜方案</Divider>
        <Row :gutter="16" class="mb-2">
          <Col :span="6">
<Statistic title="匹配订单" :value="suggestResult.matchedOrders" />
</Col>
          <Col :span="6">
<Statistic
              title="未匹配订单"
              :value="suggestResult.unmatchedOrders"
          />
</Col>
          <Col :span="6">
<Statistic title="拼柜方案数" :value="suggestResult.plans.length" />
</Col>
        </Row>

        <Spin :spinning="loading">
          <div v-if="suggestResult.plans.length === 0">
            <Empty description="无可拼柜方案" />
          </div>
          <Row v-else :gutter="16">
            <Col
              v-for="(plan, idx) in suggestResult.plans"
              :key="plan.planId"
              :span="24"
              class="mb-3"
            >
              <Card
                :title="`方案 ${idx + 1} — ${plan.containerType ?? '-'} | ${plan.departurePort ?? '-'} | 利用率: ${plan.volumeUtilRate != null ? `${(plan.volumeUtilRate * 100).toFixed(1)}%` : '-'}`"
                size="small"
              >
                <Table
                  :data-source="plan.orders ?? []"
                  :columns="planOrderColumns"
                  :pagination="false"
                  size="small"
                  row-key="orderId"
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      </template>
    </template>
  </Page>
</template>
