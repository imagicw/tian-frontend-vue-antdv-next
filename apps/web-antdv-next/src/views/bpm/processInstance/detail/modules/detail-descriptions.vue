<script lang="ts" setup>
import { Descriptions } from 'antdv-next';

defineOptions({ name: 'BpmDetailDescriptions', inheritAttrs: false });

/**
 * 审批详情通用的 key-value 展示：无边框定义列表风格（label 淡色靠左、value 靠右，
 * 行间距分隔而非表格网格线），供「普通表单兜底展示」和各业务域的自定义业务表单
 * 视图共用，避免每个业务域各自维护一套 Descriptions 边框样式。
 */
</script>

<template>
  <Descriptions
    v-bind="$attrs"
    :bordered="false"
    :colon="true"
    size="middle"
    :classes="{
      label: '!text-muted-foreground !font-normal',
      content: '!text-foreground',
    }"
    class="app-detail-descriptions"
  >
    <slot></slot>
  </Descriptions>
</template>

<style lang="scss" scoped>
.app-detail-descriptions {
  :deep(.ant-descriptions-item) {
    padding-block: 10px;
  }

  :deep(.ant-descriptions-row) {
    border-bottom: 1px solid hsl(var(--border) / 60%);

    &:last-child {
      border-bottom: none;
    }
  }

  :deep(.ant-descriptions-item-label) {
    width: 140px;
  }
}
</style>
