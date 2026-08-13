<script setup lang="ts">
import type { TableColumnsType } from 'antdv-next';

import type { DormApi } from '#/api/dorm';

import { computed, ref, watch } from 'vue';

import { Alert, DescriptionsItem, Empty, Spin, Table, Tag } from 'antdv-next';

import { getApplyList } from '#/api/dorm';
import BpmDetailDescriptions from '#/views/bpm/processInstance/detail/modules/detail-descriptions.vue';

import { getDormTimezoneLabel } from '../../area/timezones';
import { APPLY_STATUS_MAP } from '../data';

const props = defineProps<{
  businessKey?: number | string;
  data?: DormApi.DormApply;
  id?: number | string;
  printMode?: boolean;
}>();

interface GuestRow extends DormApi.CheckInPerson {
  key: string;
  remark?: string;
  roomType?: number;
}

const loading = ref(false);
const loadError = ref(false);
const application = ref<DormApi.DormApply>();

const applicationId = computed(() => props.id ?? props.businessKey);
const statusMeta = computed(
  () =>
    APPLY_STATUS_MAP[application.value?.status ?? -1] ?? {
      color: 'default',
      text: '未知状态',
    },
);
const guestRows = computed<GuestRow[]>(() =>
  (application.value?.checkInInfo ?? []).flatMap((group, groupIndex) =>
    (group.checkInPersons ?? []).map((person, personIndex) => ({
      ...person,
      key: `${groupIndex}-${personIndex}`,
      remark: group.remark,
      roomType: group.roomType,
    })),
  ),
);

const guestColumns: TableColumnsType<GuestRow> = [
  { dataIndex: 'name', key: 'name', title: '入住人', width: 120 },
  { dataIndex: 'email', key: 'email', title: '邮箱', width: 200 },
  { key: 'roomType', title: '房型', width: 90 },
  { key: 'departments', title: '费用分摊部门', width: 220 },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
];

function getRoomTypeLabel(roomType?: number) {
  if (roomType === 1) return '单人间';
  if (roomType === 2) return '双人间';
  return roomType ? `${roomType} 人间` : '-';
}

function displayRequirement(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

async function loadApplication() {
  application.value = undefined;
  loadError.value = false;
  if (props.data) {
    application.value = props.data;
    return;
  }
  if (!applicationId.value) return;

  loading.value = true;
  try {
    const list = await getApplyList([applicationId.value]);
    application.value = list?.[0];
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

watch([applicationId, () => props.data], loadApplication, { immediate: true });
</script>

<template>
  <Spin :spinning="loading" description="正在加载住宿申请...">
    <Alert
      v-if="loadError"
      message="住宿申请加载失败"
      description="请确认当前账号拥有住宿申请查询权限，或稍后重试。"
      show-icon
      type="error"
    />
    <div v-else-if="application">
      <BpmDetailDescriptions :column="printMode ? 2 : 1">
        <DescriptionsItem label="申请单号">
          {{ application.orderSerial || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="审批状态">
          <Tag :color="statusMeta.color">{{ statusMeta.text }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="申请公寓">
          {{ application.buildInfo || application.buildName || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="入住时间">
          {{ application.startTime || '-' }} 至 {{ application.endTime || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="入住天数">
          {{ application.day ?? '-' }} 天
        </DescriptionsItem>
        <DescriptionsItem label="当地时区">
          {{ getDormTimezoneLabel(application.areaTimezone) }}
        </DescriptionsItem>
        <DescriptionsItem label="申请原因" :span="printMode ? 2 : 1">
          {{ application.reason || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="是否需要接机">
          {{ displayRequirement(application.additionalRequire?.flightNo) }}
        </DescriptionsItem>
        <DescriptionsItem label="是否需要床上用品">
          {{ displayRequirement(application.additionalRequire?.bedding) }}
        </DescriptionsItem>
        <DescriptionsItem label="其他需求" :span="printMode ? 2 : 1">
          {{ displayRequirement(application.additionalRequire?.other) }}
        </DescriptionsItem>
      </BpmDetailDescriptions>

      <Table
        class="mt-6"
        :columns="guestColumns"
        :data-source="guestRows"
        :pagination="false"
        bordered
        size="small"
      >
        <template #emptyText><Empty description="暂无入住人员" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'roomType'">
            {{ getRoomTypeLabel(record.roomType) }}
          </template>
          <template v-else-if="column.key === 'departments'">
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="dept in record.feeAllocationDepts ?? []"
                :key="dept.deptId"
              >
                {{ dept.deptName }}
              </Tag>
              <span v-if="!record.feeAllocationDepts?.length">-</span>
            </div>
          </template>
        </template>
      </Table>
    </div>
    <Empty v-else-if="!loading" description="未查询到住宿申请数据" />
  </Spin>
</template>
