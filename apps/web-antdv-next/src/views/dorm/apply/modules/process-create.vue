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
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Col,
  DateRangePicker,
  Divider,
  Form,
  FormItem,
  Input,
  message,
  Row,
  Select,
  Space,
  Spin,
  TabPane,
  Tabs,
  TextArea,
} from 'antdv-next';

import { getProcessDefinition } from '#/api/bpm/definition';
import { getApprovalDetail as getApprovalDetailApi } from '#/api/bpm/processInstance';
import {
  createDormApply,
  getAreaSimpleList,
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
  if (!areaId) return;
  buildings.value = await getBuildSimpleList(areaId);
  if (buildings.value.length === 1) {
    formData.buildId = buildings.value[0]?.id;
    await refreshApprovalPrediction();
  }
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
      <Card title="公寓申请" class="min-h-full">
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
                          placeholder="请选择申请楼栋"
                          show-search
                          option-filter-prop="label"
                          @change="refreshApprovalPrediction"
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
                      placeholder="请输入申请事由"
                    />
                  </FormItem>

                  <Divider>入住信息</Divider>
                  <Card
                    v-for="(room, roomIndex) in formData.checkInInfo"
                    :key="roomIndex"
                    :title="`房间 ${roomIndex + 1}`"
                    class="mb-4"
                    size="small"
                  >
                    <template #extra>
                      <Button danger type="link" @click="removeRoom(roomIndex)">
                        删除房间
                      </Button>
                    </template>
                    <Row :gutter="16">
                      <Col :xs="24" :md="8">
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
                      <Col :xs="24" :md="16">
                        <FormItem label="备注">
                          <Input
                            v-model:value="room.remark"
                            placeholder="选填"
                          />
                        </FormItem>
                      </Col>
                    </Row>
                    <Row
                      v-for="(person, personIndex) in room.checkInPersons"
                      :key="personIndex"
                      :gutter="16"
                    >
                      <Col :xs="24" :md="10">
                        <FormItem :label="`入住人 ${personIndex + 1}`" required>
                          <Input
                            v-model:value="person.name"
                            placeholder="请输入姓名"
                          />
                        </FormItem>
                      </Col>
                      <Col :xs="24" :md="14">
                        <FormItem label="邮箱">
                          <Input
                            v-model:value="person.email"
                            placeholder="请输入邮箱"
                          />
                        </FormItem>
                      </Col>
                    </Row>
                  </Card>
                  <Button class="mb-6" block type="dashed" @click="addRoom">
                    添加房间
                  </Button>

                  <Divider>额外需求</Divider>
                  <FormItem label="接机需求">
                    <Input
                      v-model:value="formData.additionalRequire.flightNo"
                      placeholder="如需接机，请填写航班号"
                    />
                  </FormItem>
                  <FormItem label="床上用品">
                    <Input
                      v-model:value="formData.additionalRequire.bedding"
                      placeholder="如需准备，请填写所需物品"
                    />
                  </FormItem>
                  <FormItem label="其他需求">
                    <Input
                      v-model:value="formData.additionalRequire.other"
                      placeholder="选填"
                    />
                  </FormItem>

                  <Space class="flex justify-center">
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
                <Card title="审批节点" size="small">
                  <ProcessInstanceTimeline
                    :activity-nodes="activityNodes"
                    :show-status-icon="false"
                    @select-user-confirm="selectUserConfirm"
                  />
                </Card>
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
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </Spin>
  </Page>
</template>
