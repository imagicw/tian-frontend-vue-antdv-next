<script setup lang="ts">
import { computed } from 'vue';

import { Descriptions, DescriptionsItem, Empty, Tag } from 'antdv-next';

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
  <Descriptions v-if="items.length > 0" bordered :column="1" size="small">
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
  </Descriptions>
  <Empty v-else description="暂无可展示的表单数据" />
</template>
