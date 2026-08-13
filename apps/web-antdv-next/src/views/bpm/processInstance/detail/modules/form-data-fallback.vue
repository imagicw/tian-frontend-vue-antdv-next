<script setup lang="ts">
import { computed } from 'vue';

import { DescriptionsItem, Empty, Tag } from 'antdv-next';

import BpmDetailDescriptions from './detail-descriptions.vue';

const props = defineProps<{
  formVariables?: Record<string, unknown>;
  summary?: Array<{ key: string; value: string }>;
}>();

const hiddenKeys = new Set([
  'businessKey',
  'processDefinitionId',
  'processInstanceId',
]);

const items = computed(() => {
  if (props.summary?.length) {
    return props.summary.map((item) => ({
      key: item.key,
      label: item.key,
      value: item.value,
    }));
  }
  return Object.entries(props.formVariables ?? {})
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, value]) => ({ key, label: key, value }));
});

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
</script>

<template>
  <BpmDetailDescriptions v-if="items.length > 0" :column="1">
    <DescriptionsItem v-for="item in items" :key="item.key" :label="item.label">
      <Tag v-if="typeof item.value === 'boolean'">
        {{ displayValue(item.value) }}
      </Tag>
      <div
        v-else-if="typeof item.value === 'object' && item.value !== null"
        class="whitespace-pre-wrap break-all"
      >
        {{ displayValue(item.value) }}
      </div>
      <span v-else>{{ displayValue(item.value) }}</span>
    </DescriptionsItem>
  </BpmDetailDescriptions>
  <Empty v-else description="暂无可展示的表单数据" />
</template>
