<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { handleTree } from '@vben/utils';

import { TreeSelect } from 'antdv-next';

import { getSimpleDeptList } from '#/api/system/dept';

defineOptions({ name: 'DeptSelect' });

withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  {
    placeholder: '请选择部门',
  },
);

const modelValue = defineModel<number | undefined>();

const deptTree = ref<any[]>([]); // 部门树

onMounted(async () => {
  const data = await getSimpleDeptList();
  deptTree.value = handleTree(data);
});

/** 树节点过滤方法（支持搜索过滤） */
function filterTreeNode(inputValue: string, treeNode: any): boolean {
  return treeNode.name?.toLowerCase().includes(inputValue.toLowerCase());
}
</script>

<template>
  <TreeSelect
    v-model:value="modelValue"
    allow-clear
    class="w-full"
    :field-names="{ label: 'name', value: 'id', children: 'children' }"
    :filter-tree-node="filterTreeNode"
    :placeholder="placeholder"
    show-search
    tree-default-expand-all
    :tree-data="deptTree"
  />
</template>
