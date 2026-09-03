<script lang="ts" setup>
import {
  Button,
  Card,
  DateRangePicker,
  Drawer,
  Form,
  FormItem,
  Select,
  Space,
} from 'antdv-next';

import { $t } from '#/locales';
import { getRangePickerDefaultProps } from '#/utils';

defineOptions({ name: 'BpmTodoTaskFilterPanel' });

defineProps<{
  categoryOptions: Array<{ label: string; value: string }>;
  isMobile: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
  'update:open': [value: boolean];
}>();

const category = defineModel<string | undefined>('category');
const createTime = defineModel<[string, string] | undefined>('createTime');

function handleApply() {
  emit('apply');
}

function handleReset() {
  emit('reset');
}
</script>

<template>
  <Drawer
    v-if="isMobile"
    :open="open"
    placement="bottom"
    size="auto"
    :title="$t('bpm.todo.filter.title')"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical">
      <FormItem :label="$t('bpm.todo.filter.category')">
        <Select
          v-model:value="category"
          :options="categoryOptions"
          allow-clear
          :placeholder="$t('bpm.todo.filter.categoryPlaceholder')"
        />
      </FormItem>
      <FormItem :label="$t('bpm.todo.filter.createTime')">
        <DateRangePicker
          v-model:value="createTime"
          v-bind="getRangePickerDefaultProps()"
          allow-clear
          class="w-full"
        />
      </FormItem>
      <Space class="w-full justify-end">
        <Button @click="handleReset">{{ $t('bpm.todo.filter.reset') }}</Button>
        <Button type="primary" @click="handleApply">
          {{ $t('bpm.todo.filter.apply') }}
        </Button>
      </Space>
    </Form>
  </Drawer>

  <Card
    v-else-if="open"
    class="shrink-0 shadow-sm"
    size="small"
    :styles="{ body: { padding: '16px' } }"
  >
    <Form layout="vertical">
      <FormItem :label="$t('bpm.todo.filter.category')">
        <Select
          v-model:value="category"
          :options="categoryOptions"
          allow-clear
          :placeholder="$t('bpm.todo.filter.categoryPlaceholder')"
        />
      </FormItem>
      <FormItem :label="$t('bpm.todo.filter.createTime')">
        <DateRangePicker
          v-model:value="createTime"
          v-bind="getRangePickerDefaultProps()"
          allow-clear
          class="w-full"
        />
      </FormItem>
      <Space class="w-full justify-end">
        <Button @click="handleReset">{{ $t('bpm.todo.filter.reset') }}</Button>
        <Button type="primary" @click="handleApply">
          {{ $t('bpm.todo.filter.apply') }}
        </Button>
      </Space>
    </Form>
  </Card>
</template>
