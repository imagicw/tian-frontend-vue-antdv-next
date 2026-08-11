<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Avatar,
  Button,
  Card,
  Col,
  DateRangePicker,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Form,
  FormItem,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
} from 'antdv-next';

import { getApplyPage } from '#/api/dorm';
import { getSimpleUserList } from '#/api/system/user';

import {
  APPLY_STATUS_MAP,
  APPLY_STATUS_OPTIONS,
  formatApplyDateTime,
} from './data';

const router = useRouter();
const loading = ref(false);
const applications = ref<DormApi.DormApply[]>([]);
const total = ref(0);
const users = ref<SystemUserApi.User[]>([]);
const queryFormRef = ref();
const detailOpen = ref(false);
const selectedApply = ref<DormApi.DormApply>();

const queryParams = reactive({
  createTime: undefined as [string, string] | undefined,
  orderSerial: undefined as string | undefined,
  pageNo: 1,
  pageSize: 12,
  status: undefined as number | undefined,
  userId: undefined as number | undefined,
});

const userOptions = computed(() =>
  users.value.map((user) => ({
    label: user.nickname || user.username,
    value: user.id,
  })),
);

async function getList() {
  loading.value = true;
  try {
    const data = await getApplyPage(queryParams);
    applications.value = data.list ?? [];
    total.value = data.total ?? 0;
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    users.value = await getSimpleUserList();
  } catch {
    users.value = [];
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

function openDetail(application: DormApi.DormApply) {
  selectedApply.value = application;
  detailOpen.value = true;
}

function openApproval(application: DormApi.DormApply) {
  if (!application.processInstanceId) return;
  router.push({
    name: 'BpmProcessInstanceDetail',
    query: { id: application.processInstanceId },
  });
}

function openOrder(application: DormApi.DormApply) {
  if (!application.orderSerial) return;
  router.push(`/dorm/order/${application.orderSerial}`);
}

function getStatusMeta(status: number) {
  return (
    APPLY_STATUS_MAP[status] ?? {
      color: 'default',
      text: `未知状态（${status}）`,
    }
  );
}

function getApplicantName(application: DormApi.DormApply) {
  if (application.userName) return application.userName;
  const user = users.value.find((item) => item.id === application.userId);
  return (
    user?.nickname || user?.username || `用户 ${application.userId ?? '-'}`
  );
}

function getApplicantAvatar(application: DormApi.DormApply) {
  return users.value.find((item) => item.id === application.userId)?.avatar;
}

function getApplicantInitial(application: DormApi.DormApply) {
  return getApplicantName(application).trim().slice(0, 1).toUpperCase() || '住';
}

function getBuildingName(application: DormApi.DormApply) {
  return application.buildInfo || application.buildName || '未填写申请楼栋';
}

function getRoomTypeLabel(roomType?: number) {
  if (roomType === 1) return '单人间';
  if (roomType === 2) return '双人间';
  return roomType ? `${roomType} 人间` : '未设置房型';
}

function getGuestNames(application: DormApi.DormApply) {
  return (
    application.checkInInfo
      ?.flatMap((group) => group.checkInPersons ?? [])
      .map((person) => person.name)
      .filter(Boolean) ?? []
  );
}

function getGuestCount(application: DormApi.DormApply) {
  return getGuestNames(application).length;
}

function hasAdditionalRequire(application?: DormApi.DormApply) {
  const require = application?.additionalRequire;
  return Boolean(require?.flightNo || require?.bedding || require?.other);
}

onMounted(() => {
  getList();
  loadUsers();
});
</script>

<template>
  <Page auto-content-height>
    <Drawer
      v-model:open="detailOpen"
      title="住宿申请详情"
      width="680"
      :body-style="{ padding: '20px 24px' }"
    >
      <template #extra>
        <Space v-if="selectedApply">
          <Button
            :disabled="!selectedApply.processInstanceId"
            @click="openApproval(selectedApply)"
          >
            <IconifyIcon icon="lucide:workflow" />
            审批详情
          </Button>
          <Button
            v-if="selectedApply.status === 2 && selectedApply.orderSerial"
            type="primary"
            @click="openOrder(selectedApply)"
          >
            查看订单
            <IconifyIcon icon="lucide:arrow-up-right" />
          </Button>
        </Space>
      </template>

      <div v-if="selectedApply" class="apply-detail">
        <div class="apply-detail__hero">
          <div class="min-w-0 flex-1">
            <div class="text-foreground truncate text-lg font-semibold">
              {{ getBuildingName(selectedApply) }}
            </div>
            <div class="text-muted-foreground mt-1 text-sm">
              {{ getApplicantName(selectedApply) }}
              · 提交于 {{ formatApplyDateTime(selectedApply.createTime) }}
            </div>
          </div>
          <Tag :color="getStatusMeta(selectedApply.status).color">
            {{ getStatusMeta(selectedApply.status).text }}
          </Tag>
        </div>

        <Descriptions :column="1" size="small" bordered class="mt-6">
          <DescriptionsItem label="申请单号">
            {{ selectedApply.orderSerial || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="申请事由">
            {{ selectedApply.reason || '未填写' }}
          </DescriptionsItem>
          <DescriptionsItem label="当地时区">
            {{ selectedApply.areaTimezone || '未填写' }}
          </DescriptionsItem>
        </Descriptions>

        <div class="apply-detail__period apply-detail__period--info">
          <div>
            <div class="apply-detail__period-label">
              <IconifyIcon icon="lucide:log-in" :size="15" />
              <span>入住</span>
            </div>
            <strong>{{ selectedApply.startTime || '-' }}</strong>
          </div>
          <div class="apply-detail__period-line">
            <span>{{ selectedApply.day ?? '-' }} 天</span>
          </div>
          <div class="text-right">
            <div class="apply-detail__period-label justify-end">
              <IconifyIcon icon="lucide:log-out" :size="15" />
              <span>退宿</span>
            </div>
            <strong>{{ selectedApply.endTime || '-' }}</strong>
          </div>
        </div>

        <section
          class="apply-detail__section apply-detail__section--after-period"
        >
          <div class="apply-detail__section-title">
            <IconifyIcon icon="lucide:users" :size="17" />
            入住信息
            <Tag>{{ getGuestCount(selectedApply) }} 人</Tag>
          </div>
          <Empty
            v-if="!selectedApply.checkInInfo?.length"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="未填写入住人员"
          />
          <div v-else class="space-y-3">
            <div
              v-for="(group, index) in selectedApply.checkInInfo"
              :key="index"
              class="apply-detail__room"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 font-medium">
                  <IconifyIcon icon="lucide:bed-double" :size="16" />
                  {{ getRoomTypeLabel(group.roomType) }}
                </div>
                <span v-if="group.remark" class="text-muted-foreground text-xs">
                  {{ group.remark }}
                </span>
              </div>
              <div class="mt-3 space-y-2">
                <div
                  v-for="(person, personIndex) in group.checkInPersons"
                  :key="`${person.name}-${personIndex}`"
                  class="apply-detail__person"
                >
                  <Avatar :size="26">
                    {{ person.name?.slice(0, 1) || '住' }}
                  </Avatar>
                  <span class="font-medium">{{
                    person.name || '未填写姓名'
                  }}</span>
                  <span class="text-muted-foreground ml-auto text-xs">
                    {{ person.email || '未填写邮箱' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="apply-detail__section">
          <div class="apply-detail__section-title">
            <IconifyIcon icon="lucide:concierge-bell" :size="17" />
            额外需求
          </div>
          <Empty
            v-if="!hasAdditionalRequire(selectedApply)"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="无额外需求"
          />
          <Descriptions v-else :column="1" size="small" bordered>
            <DescriptionsItem label="接机 / 航班号">
              {{ selectedApply.additionalRequire?.flightNo || '不需要' }}
            </DescriptionsItem>
            <DescriptionsItem label="床上用品">
              {{ selectedApply.additionalRequire?.bedding || '不需要' }}
            </DescriptionsItem>
            <DescriptionsItem label="其他需求">
              {{ selectedApply.additionalRequire?.other || '无' }}
            </DescriptionsItem>
          </Descriptions>
        </section>
      </div>
    </Drawer>

    <div class="flex h-full flex-col gap-2 overflow-hidden">
      <Card
        class="shrink-0 shadow-sm"
        size="small"
        :body-style="{ padding: '16px' }"
      >
        <Form
          ref="queryFormRef"
          :model="queryParams"
          layout="inline"
          class="apply-filter"
          @finish="handleQuery"
        >
          <FormItem name="orderSerial" label="申请单号">
            <Input
              v-model:value="queryParams.orderSerial"
              allow-clear
              placeholder="请输入完整申请单号"
              @press-enter="handleQuery"
            />
          </FormItem>
          <FormItem name="userId" label="申请人">
            <Select
              v-model:value="queryParams.userId"
              :options="userOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="请选择申请人"
            />
          </FormItem>
          <FormItem name="status" label="审批状态">
            <Select
              v-model:value="queryParams.status"
              :options="APPLY_STATUS_OPTIONS"
              allow-clear
              placeholder="全部状态"
            />
          </FormItem>
          <FormItem name="createTime" label="提交时间">
            <DateRangePicker
              v-model:value="queryParams.createTime"
              value-format="YYYY-MM-DD HH:mm:ss"
              show-time
              allow-clear
            />
          </FormItem>
          <FormItem class="apply-filter__actions">
            <Space>
              <Button html-type="submit" type="primary">
                <IconifyIcon icon="lucide:search" />
                查询
              </Button>
              <Button @click="handleReset">
                <IconifyIcon icon="lucide:rotate-ccw" />
                重置
              </Button>
              <Tooltip title="刷新当前结果">
                <Button :loading="loading" @click="getList">
                  <IconifyIcon icon="lucide:refresh-cw" />
                </Button>
              </Tooltip>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-1">
        <Spin :spinning="loading">
          <Card
            v-if="!loading && applications.length === 0"
            class="shadow-sm"
            :body-style="{ padding: '40px 16px' }"
          >
            <Empty
              :description="
                queryParams.orderSerial ||
                queryParams.userId ||
                queryParams.status !== undefined ||
                queryParams.createTime
                  ? '没有找到符合条件的住宿申请'
                  : '暂无住宿申请'
              "
            />
          </Card>

          <Row v-else :gutter="[16, 16]">
            <Col
              v-for="application in applications"
              :key="application.id ?? application.orderSerial"
              class="min-w-0"
              :xs="24"
              :lg="12"
              :xxl="8"
            >
              <Card
                class="apply-card h-full overflow-hidden shadow-sm"
                hoverable
                :body-style="{
                  padding: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }"
                @click="openDetail(application)"
              >
                <div class="flex-1 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div
                        class="text-foreground truncate font-semibold"
                        :title="getBuildingName(application)"
                      >
                        {{ getBuildingName(application) }}
                      </div>
                      <div class="text-muted-foreground mt-1 truncate text-xs">
                        {{ application.orderSerial || '暂无申请单号' }}
                      </div>
                    </div>
                    <Tag :color="getStatusMeta(application.status).color">
                      {{ getStatusMeta(application.status).text }}
                    </Tag>
                  </div>

                  <div class="apply-card__period">
                    <div>
                      <span>入住</span>
                      <strong>{{ application.startTime || '-' }}</strong>
                    </div>
                    <div class="apply-card__period-line">
                      <span>{{ application.day ?? '-' }} 天</span>
                    </div>
                    <div class="text-right">
                      <span>退宿</span>
                      <strong>{{ application.endTime || '-' }}</strong>
                    </div>
                  </div>

                  <div class="mt-4 grid grid-cols-2 gap-3">
                    <div class="apply-card__meta">
                      <IconifyIcon icon="lucide:users" :size="16" />
                      <div class="min-w-0">
                        <div>入住人员</div>
                        <strong :title="getGuestNames(application).join('、')">
                          {{
                            getGuestNames(application).join('、') ||
                            '未填写入住人'
                          }}
                        </strong>
                      </div>
                    </div>
                    <div class="apply-card__meta">
                      <IconifyIcon
                        icon="lucide:message-square-text"
                        :size="16"
                      />
                      <div class="min-w-0">
                        <div>申请事由</div>
                        <strong :title="application.reason">
                          {{ application.reason || '未填写' }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="apply-card__footer" @click.stop>
                  <div class="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      :src="getApplicantAvatar(application)"
                      :style="{
                        backgroundColor: getApplicantAvatar(application)
                          ? undefined
                          : '#1677ff',
                      }"
                      :size="32"
                    >
                      {{ getApplicantInitial(application) }}
                    </Avatar>
                    <div class="min-w-0">
                      <div class="text-foreground truncate text-sm font-medium">
                        {{ getApplicantName(application) }}
                      </div>
                      <div class="text-muted-foreground text-xs">
                        提交于 {{ formatApplyDateTime(application.createTime) }}
                      </div>
                    </div>
                  </div>
                  <div class="ml-auto flex shrink-0 items-center">
                    <Button type="text" @click="openDetail(application)">
                      申请详情
                    </Button>
                    <Button
                      :disabled="!application.processInstanceId"
                      type="text"
                      @click="openApproval(application)"
                    >
                      审批详情
                    </Button>
                    <Button
                      v-if="application.status === 2 && application.orderSerial"
                      type="link"
                      @click="openOrder(application)"
                    >
                      查看订单
                    </Button>
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
        <div class="apply-pagination">
          <span class="text-muted-foreground text-sm">
            共 {{ total }} 条申请
          </span>
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
.apply-filter :deep(.ant-form-item) {
  margin-bottom: 0;
}

.apply-filter :deep(.ant-input) {
  width: 210px;
}

.apply-filter :deep(.ant-select) {
  width: 170px;
}

.apply-filter :deep(.ant-picker) {
  width: 330px;
}

.apply-card {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.apply-card:hover {
  transform: translateY(-2px);
}

.apply-card__period,
.apply-detail__period {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 20px;
}

.apply-card__period span,
.apply-detail__period span {
  display: block;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.apply-card__period strong,
.apply-detail__period strong {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.apply-card__period-line,
.apply-detail__period-line {
  position: relative;
  text-align: center;
}

.apply-card__period-line::after,
.apply-detail__period-line::after {
  display: block;
  height: 1px;
  margin-top: 5px;
  content: '';
  background: hsl(var(--border));
}

.apply-card__meta {
  display: flex;
  gap: 9px;
  align-items: center;
  min-width: 0;
  padding: 10px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 65%);
  border-radius: 8px;
}

.apply-card__meta div > div {
  font-size: 11px;
}

.apply-card__meta strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.apply-card__footer {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  background: hsl(var(--muted) / 40%);
  border-top: 1px solid hsl(var(--border));
}

.apply-detail__hero {
  display: flex;
  gap: 14px;
  align-items: center;
}

.apply-detail__period--info {
  padding: 14px 16px;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.apply-detail__period-label {
  display: flex;
  gap: 6px;
  align-items: center;
  color: hsl(var(--muted-foreground));
}

.apply-detail__period-label span {
  display: inline;
}

.apply-detail__section {
  margin-top: 24px;
}

.apply-detail__section--after-period {
  margin-top: 18px;
}

.apply-detail__section-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.apply-detail__room {
  padding: 14px 16px;
  background: hsl(var(--muted) / 50%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.apply-detail__person {
  display: flex;
  gap: 9px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px dashed hsl(var(--border));
}

.apply-pagination {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 1280px) {
  .apply-filter :deep(.ant-form-item) {
    margin-bottom: 12px;
  }
}

@media (max-width: 640px) {
  .apply-card__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .apply-card__footer > div:last-child {
    width: 100%;
    margin-left: 0;
  }

  .apply-pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
