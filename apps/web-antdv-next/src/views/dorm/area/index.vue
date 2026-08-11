<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Pagination,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
} from 'antdv-next';

import { deleteArea, getAreaPage } from '#/api/dorm';

import AreaFormModal from './modules/form.vue';
import { getDormTimezoneLabel } from './timezones';

const router = useRouter();
const loading = ref(false);
const areas = ref<DormApi.DormArea[]>([]);
const total = ref(0);
const queryFormRef = ref();

const queryParams = reactive({
  pageNo: 1,
  pageSize: 12,
  areaName: undefined as string | undefined,
  regionName: undefined as string | undefined,
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: AreaFormModal,
  destroyOnClose: true,
});

async function getList() {
  loading.value = true;
  try {
    const data = await getAreaPage(queryParams);
    areas.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNo = 1;
  getList();
}

function handleReset() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handlePageChange(pageNo: number, pageSize: number) {
  queryParams.pageNo = pageNo;
  queryParams.pageSize = pageSize;
  getList();
}

function handleCreate() {
  formModalApi.setData({}).open();
}

function handleEdit(row: DormApi.DormArea) {
  formModalApi.setData(row).open();
}

function handleManage(row: DormApi.DormArea) {
  router.push({ path: '/dorm/building', query: { areaId: row.id } });
}

async function handleDelete(row: DormApi.DormArea) {
  const hide = message.loading({
    content: `正在删除区域「${row.areaName}」...`,
    duration: 0,
  });
  try {
    await deleteArea(row.id!);
    if (areas.value.length === 1 && queryParams.pageNo > 1) {
      queryParams.pageNo -= 1;
    }
    message.success(`区域「${row.areaName}」已删除`);
    await getList();
  } finally {
    hide();
  }
}

function getAreaInitial(areaName: string) {
  return areaName.trim().slice(0, 1).toUpperCase() || '区';
}

onMounted(getList);
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="getList" />

    <div class="flex h-full flex-col gap-2 overflow-hidden">
      <Card
        class="shrink-0 shadow-sm"
        size="small"
        :body-style="{ padding: '16px' }"
      >
        <div class="area-filter-row flex items-center justify-between gap-4">
          <Form
            ref="queryFormRef"
            :model="queryParams"
            layout="inline"
            class="area-filter min-w-0 flex-1"
            @finish="handleQuery"
          >
            <FormItem name="areaName" label="区域名称">
              <Input
                v-model:value="queryParams.areaName"
                allow-clear
                placeholder="搜索区域名称"
                @press-enter="handleQuery"
              />
            </FormItem>
            <FormItem name="regionName" label="国家 / 地区">
              <Input
                v-model:value="queryParams.regionName"
                allow-clear
                placeholder="搜索国家或地区"
                @press-enter="handleQuery"
              />
            </FormItem>
            <FormItem class="area-filter__actions">
              <Space>
                <Button html-type="submit" type="primary">
                  <IconifyIcon icon="lucide:search" />
                  查询
                </Button>
                <Button @click="handleReset">
                  <IconifyIcon icon="lucide:rotate-ccw" />
                  重置
                </Button>
              </Space>
            </FormItem>
          </Form>

          <Button
            v-access:code="['dorm:area:create']"
            class="shrink-0"
            type="primary"
            @click="handleCreate"
          >
            <IconifyIcon icon="lucide:plus" />
            新增区域
          </Button>
        </div>
      </Card>

      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-1">
        <Spin :spinning="loading">
          <Card
            v-if="!loading && areas.length === 0"
            class="shadow-sm"
            :body-style="{ padding: '16px' }"
          >
            <Empty
              :description="
                queryParams.areaName || queryParams.regionName
                  ? '没有找到符合条件的区域'
                  : '还没有宿舍区域，点击“新增区域”开始创建'
              "
            />
          </Card>

          <Row v-else :gutter="[16, 16]">
            <Col
              v-for="area in areas"
              :key="area.id"
              class="min-w-0"
              :xs="24"
              :md="12"
              :xl="8"
            >
              <Card
                class="h-full overflow-hidden shadow-sm"
                hoverable
                :body-style="{
                  padding: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }"
              >
                <div class="area-cover">
                  <Image.PreviewGroup v-if="area.images?.length">
                    <Image
                      :alt="`${area.areaName}区域照片`"
                      class="area-cover__image"
                      :src="area.images[0]"
                    />
                    <Image
                      v-for="image in area.images.slice(1)"
                      :key="image"
                      class="hidden"
                      :src="image"
                    />
                  </Image.PreviewGroup>
                  <div v-else class="area-cover__placeholder">
                    <IconifyIcon icon="lucide:image" :size="24" />
                    <span>{{ area.areaName }}</span>
                  </div>
                  <div v-if="area.images?.length" class="area-cover__count">
                    <IconifyIcon icon="lucide:images" :size="13" />
                    {{ area.images.length }} 张
                  </div>
                </div>

                <div class="flex-1 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <div
                        class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg font-semibold"
                      >
                        {{ getAreaInitial(area.areaName) }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-foreground truncate font-semibold">
                          {{ area.areaName }}
                        </div>
                        <div
                          class="text-muted-foreground mt-1 flex items-center gap-1 text-sm"
                        >
                          <IconifyIcon icon="lucide:map-pin" :size="14" />
                          <span class="truncate">
                            {{ area.regionName || '未设置国家 / 地区' }}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Tag v-if="area.settleCurrencyCode" color="blue">
                      {{ area.settleCurrencyCode }}
                    </Tag>
                    <Tag v-else>未设币种</Tag>
                  </div>

                  <div class="mt-5 grid grid-cols-2 gap-3">
                    <div
                      class="bg-muted text-muted-foreground flex min-w-0 items-center gap-2 rounded-md px-3 py-2"
                    >
                      <IconifyIcon icon="lucide:clock-3" :size="16" />
                      <div class="min-w-0">
                        <div class="text-xs">时区</div>
                        <div
                          class="text-foreground mt-0.5 truncate text-xs font-medium"
                          :title="getDormTimezoneLabel(area.timeZone)"
                        >
                          {{ getDormTimezoneLabel(area.timeZone) }}
                        </div>
                      </div>
                    </div>
                    <div
                      class="bg-muted text-muted-foreground flex min-w-0 items-center gap-2 rounded-md px-3 py-2"
                    >
                      <IconifyIcon icon="lucide:landmark" :size="16" />
                      <div class="min-w-0">
                        <div class="text-xs">结算币种</div>
                        <div
                          class="text-foreground mt-0.5 truncate text-xs font-medium"
                        >
                          {{ area.settleCurrencyCode || '未设置' }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4">
                    <div
                      class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs"
                    >
                      <IconifyIcon icon="lucide:navigation" :size="13" />
                      详细地址
                    </div>
                    <div
                      class="text-foreground truncate text-sm"
                      :title="area.position"
                    >
                      {{ area.position || '暂未填写详细地址' }}
                    </div>
                  </div>
                </div>

                <div
                  class="border-border bg-muted/40 flex items-center gap-2 border-t px-3.5 py-2.5"
                >
                  <Button type="primary" ghost @click="handleManage(area)">
                    <IconifyIcon icon="lucide:building-2" />
                    管理楼栋
                  </Button>
                  <div class="ml-auto flex items-center">
                    <Button
                      v-access:code="['dorm:area:update']"
                      type="text"
                      @click="handleEdit(area)"
                    >
                      <IconifyIcon icon="lucide:pencil" />
                      编辑
                    </Button>
                    <Popconfirm
                      :title="`确定删除区域「${area.areaName}」吗？`"
                      description="删除后不可恢复，请确认区域下已无楼栋。"
                      ok-text="删除"
                      cancel-text="取消"
                      @confirm="handleDelete(area)"
                    >
                      <Button
                        v-access:code="['dorm:area:delete']"
                        type="text"
                        danger
                      >
                        <IconifyIcon icon="lucide:trash-2" />
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Spin>
      </div>

      <Card
        v-if="total > 0"
        class="shrink-0 shadow-sm"
        size="small"
        :body-style="{ padding: '12px 16px' }"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-sm">共 {{ total }} 个区域</span>
          <Pagination
            v-model:current="queryParams.pageNo"
            v-model:page-size="queryParams.pageSize"
            :total="total"
            :page-size-options="['12', '24', '48']"
            show-size-changer
            show-less-items
            @change="handlePageChange"
          />
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.area-filter :deep(.ant-form-item) {
  margin-bottom: 0;
}

.area-filter :deep(.ant-input) {
  width: 220px;
}

.area-cover {
  position: relative;
  height: 148px;
  flex: none;
  overflow: hidden;
  background: hsl(var(--muted));
}

.area-cover :deep(.ant-image) {
  width: 100%;
  height: 100%;
}

.area-cover :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 240ms ease;
}

.area-cover:hover :deep(.ant-image-img) {
  transform: scale(1.025);
}

.area-cover__placeholder {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: hsl(var(--primary));
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
  background:
    radial-gradient(
      circle at 20% 20%,
      hsl(var(--primary) / 16%),
      transparent 34%
    ),
    linear-gradient(135deg, hsl(var(--primary) / 8%), hsl(var(--muted)));
}

.area-cover__placeholder svg {
  opacity: 0.6;
}

.area-cover__count {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  color: white;
  font-size: 11px;
  background: rgb(15 23 42 / 68%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  backdrop-filter: blur(6px);
  pointer-events: none;
}

@media (max-width: 768px) {
  .area-filter-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .area-filter :deep(.ant-form-item) {
    width: 100%;
    margin-bottom: 10px;
  }

  .area-filter :deep(.ant-input) {
    width: 100%;
  }
}
</style>
