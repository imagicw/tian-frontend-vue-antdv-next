<script setup lang="ts">
import type { BpmProcessInstanceApi } from '#/api/bpm/processInstance';
import type { DormApi } from '#/api/dorm';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import {
  BpmCandidateStrategyEnum,
  BpmModelType,
  BpmNodeIdEnum,
} from '@vben/constants';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Col,
  DateRangePicker,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  TabPane,
  Tabs,
  Tag,
  TextArea,
} from 'antdv-next';

import { getProcessDefinition } from '#/api/bpm/definition';
import { getApprovalDetail as getApprovalDetailApi } from '#/api/bpm/processInstance';
import {
  createDormApply,
  getAreaSimpleList,
  getBuildInfo,
  getBuildSimpleList,
} from '#/api/dorm';
import { router } from '#/router';
import ProcessInstanceBpmnViewer from '#/views/bpm/processInstance/detail/modules/bpm-viewer.vue';
import ProcessInstanceSimpleViewer from '#/views/bpm/processInstance/detail/modules/simple-bpm-viewer.vue';
import ProcessInstanceTimeline from '#/views/bpm/processInstance/detail/modules/time-line.vue';

defineOptions({ name: 'BpmDormApplyCreate' });

interface DormApplyFormData {
  additionalRequire: {
    bedding: string;
    flightNo: string;
    other: string;
  };
  applyTime: [string | undefined, string | undefined];
  areaId?: number;
  buildId?: number;
  checkInInfo: DormApi.CheckInInfo[];
  reason: string;
}

const userStore = useUserStore();
const formRef = ref();
const loading = ref(false);
const submitting = ref(false);
const activeTab = ref('form');
const areas = ref<DormApi.DormArea[]>([]);
const buildings = ref<DormApi.DormBuilding[]>([]);
const processDefinition = ref<any>();
const bpmnXml = ref('');
const simpleJson = ref<string>();
const activityNodes = ref<BpmProcessInstanceApi.ApprovalNodeInfo[]>([]);
const startUserSelectAssignees = ref<Record<string, number[]>>({});
const buildingAttention = ref<string>();

function createRoom(roomType = 1): DormApi.CheckInInfo {
  return {
    checkInPersons: Array.from({ length: roomType }, (_, index) => ({
      email: '',
      name: index === 0 ? userStore.userInfo?.nickname || '' : '',
    })),
    remark: '',
    roomType,
  };
}

const formData = reactive<DormApplyFormData>({
  additionalRequire: {
    bedding: '',
    flightNo: '',
    other: '',
  },
  applyTime: [undefined, undefined],
  areaId: undefined,
  buildId: undefined,
  checkInInfo: [createRoom()],
  reason: '',
});

const areaOptions = computed(() =>
  areas.value.map((area) => ({
    label: `${area.regionName ? `${area.regionName} / ` : ''}${area.areaName}`,
    value: area.id,
  })),
);
const buildingOptions = computed(() =>
  buildings.value.map((building) => ({
    label: building.address
      ? `${building.buildName}（${building.address}）`
      : building.buildName,
    value: building.id,
  })),
);
async function loadBuildings(areaId?: number) {
  formData.buildId = undefined;
  buildings.value = [];
  activityNodes.value = [];
  buildingAttention.value = undefined;
  if (!areaId) return;
  buildings.value = await getBuildSimpleList(areaId);
  if (buildings.value.length === 1) {
    formData.buildId = buildings.value[0]?.id;
    await onBuildingChange();
  }
}

async function loadBuildingAttention(buildId?: number) {
  buildingAttention.value = buildId
    ? (await getBuildInfo(buildId))?.attention
    : undefined;
}

async function onBuildingChange() {
  await Promise.all([
    refreshApprovalPrediction(),
    loadBuildingAttention(formData.buildId),
  ]);
}

function updateRoomType(room: DormApi.CheckInInfo, roomType: number) {
  room.roomType = roomType;
  const people = room.checkInPersons ?? [];
  if (people.length < roomType) {
    room.checkInPersons = [
      ...people,
      ...Array.from({ length: roomType - people.length }, () => ({
        email: '',
        name: '',
      })),
    ];
  } else {
    room.checkInPersons = people.slice(0, roomType);
  }
}

function addRoom() {
  formData.checkInInfo.push(createRoom());
}

function removeRoom(index: number) {
  if (formData.checkInInfo.length === 1) {
    message.warning('至少需要一间房');
    return;
  }
  formData.checkInInfo.splice(index, 1);
}

function validateGuests() {
  const names = new Set<string>();
  for (const room of formData.checkInInfo) {
    if (!room.roomType || !room.checkInPersons?.length) {
      message.warning('请完整填写入住信息');
      return false;
    }
    for (const person of room.checkInPersons) {
      const name = person.name?.trim();
      if (!name) {
        message.warning('入住人姓名不能为空');
        return false;
      }
      if (names.has(name)) {
        message.warning(`入住人员「${name}」重复`);
        return false;
      }
      names.add(name);
      if (person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) {
        message.warning(`入住人员「${name}」的邮箱格式不正确`);
        return false;
      }
    }
  }
  return true;
}

async function refreshApprovalPrediction() {
  if (!processDefinition.value?.id || !formData.buildId) return;
  const data = await getApprovalDetailApi({
    activityId: BpmNodeIdEnum.START_USER_NODE_ID,
    processDefinitionId: processDefinition.value.id,
    processVariablesStr: JSON.stringify({ buildId: formData.buildId }),
  });
  activityNodes.value = data?.activityNodes ?? [];
  const selectableNodeIds = activityNodes.value
    .filter(
      (node) =>
        node.candidateStrategy === BpmCandidateStrategyEnum.START_USER_SELECT,
    )
    .map((node) => node.id);
  startUserSelectAssignees.value = Object.fromEntries(
    selectableNodeIds.map((id) => [id, startUserSelectAssignees.value[id] ?? []]),
  );
}

function selectUserConfirm(activityId: string, userList: any[]) {
  startUserSelectAssignees.value[activityId] = userList.map((item) => item.id);
}

async function submitApply() {
  await formRef.value?.validate();
  if (!validateGuests()) return;

  for (const [activityId, userIds] of Object.entries(
    startUserSelectAssignees.value,
  )) {
    if (userIds.length === 0) {
      const node = activityNodes.value.find((item) => item.id === activityId);
      message.warning(`请选择${node?.name || '审批节点'}的候选人`);
      return;
    }
  }

  const area = areas.value.find((item) => item.id === formData.areaId);
  const building = buildings.value.find((item) => item.id === formData.buildId);
  const userId = Number(userStore.userInfo?.id);
  const [startTime, endTime] = formData.applyTime;
  if (!area?.timeZone || !building?.id || !userId || !startTime || !endTime) {
    message.error('申请基础信息不完整，请重新选择区域和楼栋');
    return;
  }

  submitting.value = true;
  try {
    const processInstanceId = await createDormApply({
      additionalRequire: { ...formData.additionalRequire },
      areaTimezone: area.timeZone,
      buildId: building.id,
      buildInfo: `${area.areaName} - ${building.buildName}`,
      checkInInfo: formData.checkInInfo,
      endTime,
      reason: formData.reason.trim(),
      startTime,
      startUserSelectAssignees: startUserSelectAssignees.value,
      userId,
    });
    message.success('公寓申请已提交');
    await router.push({
      name: 'BpmProcessInstanceDetail',
      query: { id: processInstanceId },
    });
  } finally {
    submitting.value = false;
  }
}

async function init() {
  loading.value = true;
  try {
    const [areaList, definition] = await Promise.all([
      getAreaSimpleList(),
      getProcessDefinition(undefined, 'dorm_apply'),
    ]);
    areas.value = areaList ?? [];
    processDefinition.value = definition;
    bpmnXml.value = definition?.bpmnXml || '';
    simpleJson.value = definition?.simpleModel;
  } finally {
    loading.value = false;
  }
}

onMounted(init);
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading" tip="正在加载公寓申请...">
      <Card class="apply-card min-h-full" :body-style="{ padding: '20px 24px 24px' }">
        <template #title>
          <div class="section-title">
            <span class="section-title__icon">
              <IconifyIcon icon="lucide:home" :size="18" />
            </span>
            <strong>公寓申请</strong>
          </div>
        </template>
        <Tabs v-model:active-key="activeTab">
          <TabPane key="form" tab="申请表单">
            <Row :gutter="[24, 24]">
              <Col :xs="24" :lg="16">
                <Form
                  ref="formRef"
                  :model="formData"
                  layout="vertical"
                  @finish="submitApply"
                >
                  <div class="section-title mb-4">
                    <span class="section-title__icon is-blue">
                      <IconifyIcon icon="lucide:map-pin" :size="16" />
                    </span>
                    <strong>基本信息</strong>
                  </div>
                  <Row :gutter="16">
                    <Col :xs="24" :md="12">
                      <FormItem
                        label="申请区域"
                        name="areaId"
                        :rules="[{ required: true, message: '请选择申请区域' }]"
                      >
                        <Select
                          v-model:value="formData.areaId"
                          :options="areaOptions"
                          placeholder="请选择申请区域"
                          show-search
                          option-filter-prop="label"
                          @change="loadBuildings"
                        />
                      </FormItem>
                    </Col>
                    <Col :xs="24" :md="12">
                      <FormItem
                        label="申请楼栋"
                        name="buildId"
                        :rules="[{ required: true, message: '请选择申请楼栋' }]"
                      >
                        <Select
                          v-model:value="formData.buildId"
                          :disabled="!formData.areaId"
                          :options="buildingOptions"
                          placeholder="请先选择申请区域"
                          show-search
                          option-filter-prop="label"
                          @change="onBuildingChange"
                        />
                      </FormItem>
                    </Col>
                  </Row>

                  <FormItem
                    label="申请时间"
                    name="applyTime"
                    :rules="[
                      {
                        required: true,
                        type: 'array',
                        min: 2,
                        message: '请选择申请时间',
                      },
                    ]"
                  >
                    <DateRangePicker
                      v-model:value="formData.applyTime"
                      class="w-full"
                      value-format="YYYY-MM-DD"
                    />
                  </FormItem>

                  <FormItem
                    label="申请事由"
                    name="reason"
                    :rules="[
                      { required: true, message: '请输入申请事由' },
                      { max: 200, message: '申请事由不能超过 200 字' },
                    ]"
                  >
                    <TextArea
                      v-model:value="formData.reason"
                      :maxlength="200"
                      :rows="3"
                      show-count
                      placeholder="请简要说明本次申请入住的原因"
                    />
                  </FormItem>

                  <div class="section-title mb-4 mt-6">
                    <span class="section-title__icon is-purple">
                      <IconifyIcon icon="lucide:bed-double" :size="16" />
                    </span>
                    <strong>入住信息</strong>
                  </div>

                  <div class="room-grid">
                    <Card
                      v-for="(room, roomIndex) in formData.checkInInfo"
                      :key="roomIndex"
                      class="room-card"
                      size="small"
                      :body-style="{ padding: '12px 14px 4px' }"
                    >
                      <template #title>
                        <div class="room-card__title">
                          <span class="room-card__badge">{{
                            roomIndex + 1
                          }}</span>
                          <span>房间 {{ roomIndex + 1 }}</span>
                          <Tag :color="room.roomType === 2 ? 'purple' : 'blue'">
                            {{ room.roomType === 2 ? '双人间' : '单人间' }}
                          </Tag>
                        </div>
                      </template>
                      <template #extra>
                        <Popconfirm
                          title="确定删除该房间吗？"
                          ok-text="删除"
                          cancel-text="取消"
                          ok-type="danger"
                          :disabled="formData.checkInInfo.length === 1"
                          @confirm="removeRoom(roomIndex)"
                        >
                          <Button
                            danger
                            type="text"
                            size="small"
                            :disabled="formData.checkInInfo.length === 1"
                          >
                            <IconifyIcon icon="lucide:trash-2" :size="14" />
                          </Button>
                        </Popconfirm>
                      </template>
                      <Row :gutter="12">
                        <Col :xs="24" :sm="10">
                          <FormItem label="房型" required>
                            <Select
                              :value="room.roomType"
                              :options="[
                                { label: '单人间', value: 1 },
                                { label: '双人间', value: 2 },
                              ]"
                              @change="
                                (value) => updateRoomType(room, Number(value))
                              "
                            />
                          </FormItem>
                        </Col>
                        <Col :xs="24" :sm="14">
                          <FormItem label="备注">
                            <Input
                              v-model:value="room.remark"
                              placeholder="选填"
                            />
                          </FormItem>
                        </Col>
                      </Row>
                      <div
                        v-for="(person, personIndex) in room.checkInPersons"
                        :key="personIndex"
                        class="guest-row"
                      >
                        <FormItem
                          :label="`入住人 ${personIndex + 1}`"
                          required
                          class="guest-row__field"
                        >
                          <Input
                            v-model:value="person.name"
                            placeholder="姓名"
                          />
                        </FormItem>
                        <FormItem label="邮箱" class="guest-row__field">
                          <Input
                            v-model:value="person.email"
                            placeholder="选填"
                          />
                        </FormItem>
                      </div>
                    </Card>
                  </div>
                  <button
                    type="button"
                    class="add-room-btn"
                    @click="addRoom"
                  >
                    <IconifyIcon icon="lucide:plus" :size="16" />
                    添加房间
                  </button>

                  <div class="section-title mb-4 mt-6">
                    <span class="section-title__icon is-green">
                      <IconifyIcon icon="lucide:sparkles" :size="16" />
                    </span>
                    <strong>额外需求</strong>
                  </div>
                  <Row :gutter="16">
                    <Col :xs="24" :md="8">
                      <FormItem label="接机需求">
                        <Input
                          v-model:value="formData.additionalRequire.flightNo"
                          placeholder="如需接机，请填写航班号"
                        />
                      </FormItem>
                    </Col>
                    <Col :xs="24" :md="8">
                      <FormItem label="床上用品">
                        <Input
                          v-model:value="formData.additionalRequire.bedding"
                          placeholder="如需准备，请填写所需物品"
                        />
                      </FormItem>
                    </Col>
                    <Col :xs="24" :md="8">
                      <FormItem label="其他需求">
                        <Input
                          v-model:value="formData.additionalRequire.other"
                          placeholder="选填"
                        />
                      </FormItem>
                    </Col>
                  </Row>

                  <Space class="mt-2 flex justify-center">
                    <Button
                      html-type="submit"
                      type="primary"
                      :loading="submitting"
                    >
                      提交申请
                    </Button>
                    <Button @click="router.back()">取消</Button>
                  </Space>
                </Form>
              </Col>
              <Col :xs="24" :lg="8">
                <div class="side-stack">
                  <Card class="notice-card" size="small">
                    <template #title>
                      <div class="section-title">
                        <span class="section-title__icon is-blue">
                          <IconifyIcon
                            icon="lucide:circle-alert"
                            :size="16"
                          />
                        </span>
                        <strong>注意事项</strong>
                      </div>
                    </template>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div
                      v-if="buildingAttention"
                      class="notice-text"
                      v-html="buildingAttention"
                    ></div>
                    <Empty
                      v-else
                      description="请先选择申请楼栋，查看入住须知"
                      :image="Empty.PRESENTED_IMAGE_SIMPLE"
                    />
                  </Card>
                  <Card
                    class="approval-card"
                    size="small"
                    :body-style="{ padding: '16px 16px 12px 24px' }"
                  >
                    <template #title>
                      <div class="section-title">
                        <span class="section-title__icon is-blue">
                          <IconifyIcon icon="lucide:list-checks" :size="16" />
                        </span>
                        <strong>审批节点</strong>
                      </div>
                    </template>
                    <Empty
                      v-if="!formData.buildId"
                      description="请先选择申请楼栋，查看审批流程预览"
                      :image="Empty.PRESENTED_IMAGE_SIMPLE"
                    />
                    <ProcessInstanceTimeline
                      v-else
                      :activity-nodes="activityNodes"
                      :show-status-icon="false"
                      @select-user-confirm="selectUserConfirm"
                    />
                  </Card>
                </div>
              </Col>
            </Row>
          </TabPane>
          <TabPane key="diagram" tab="流程图" :force-render="true">
            <div class="h-[560px] w-full">
              <ProcessInstanceBpmnViewer
                v-if="processDefinition?.modelType === BpmModelType.BPMN"
                :bpmn-xml="bpmnXml"
              />
              <ProcessInstanceSimpleViewer
                v-else-if="processDefinition?.modelType === BpmModelType.SIMPLE"
                :simple-json="simpleJson"
              />
              <Empty
                v-else
                class="mt-20"
                description="暂无流程图数据"
              />
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </Spin>
  </Page>
</template>

<style scoped>
.section-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.section-title__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: #1677ff;
}

.section-title__icon.is-blue {
  color: #1677ff;
}

.section-title__icon.is-purple {
  color: #722ed1;
}

.section-title__icon.is-green {
  color: #389e0d;
}

.section-title strong,
.section-title small {
  display: block;
}

.section-title strong {
  color: hsl(var(--foreground));
  font-size: 15px;
  line-height: 1.35;
}

.section-title small {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 640px) {
  .room-grid {
    grid-template-columns: 1fr;
  }
}

.room-card {
  border: 1px solid hsl(var(--border));
  transition: border-color 0.2s ease;
}

.room-card:hover {
  border-color: hsl(var(--primary) / 40%);
}

.room-card :deep(.ant-card-head) {
  min-height: 40px;
  padding: 0 12px;
}

.room-card :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.room-card :deep(.ant-form-item-label) {
  padding-bottom: 2px;
}

.room-card__title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 500;
}

.room-card__badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-weight: 600;
  color: #722ed1;
  background: #f9f0ff;
  border-radius: 50%;
}

.guest-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: start;
  margin-top: 2px;
}

.guest-row__field {
  margin-bottom: 8px;
}

@media (max-width: 480px) {
  .guest-row {
    grid-template-columns: 1fr;
  }
}

.add-room-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px;
  margin-bottom: 24px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
  gap: 6px;
  transition: all 0.2s ease;
}

.add-room-btn:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 4%);
  border-color: hsl(var(--primary) / 50%);
}

.side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notice-card {
  border: 1px solid hsl(var(--border));
}

.notice-text {
  font-size: inherit;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
  word-break: break-word;
}

.notice-text :deep(p) {
  margin: 0 0 8px;
}

.notice-text :deep(p:last-child) {
  margin-bottom: 0;
}

.notice-text :deep(ul),
.notice-text :deep(ol) {
  padding-left: 18px;
  margin: 0 0 8px;
}

.notice-text :deep(img) {
  max-width: 100%;
}

.approval-card {
  position: sticky;
  top: 16px;
  border: 1px solid hsl(var(--border));
}
</style>
