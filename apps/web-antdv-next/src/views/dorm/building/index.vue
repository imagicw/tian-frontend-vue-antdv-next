<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
  Statistic,
  Tag,
} from 'antdv-next';

import {
  createStorey,
  deleteBuild,
  deleteRoom,
  deleteStorey,
  getAreaSimpleList,
  getBuildInfo,
  getBuildSimpleList,
} from '#/api/dorm';

import AreaForm from '../area/modules/form.vue';
import BuildingForm from './modules/building-form.vue';
import RoomForm from './modules/room-form.vue';

type RoomWithFloor = DormApi.DormRoomInfo & {
  floorLabel: string;
};

const route = useRoute();
const router = useRouter();

const areas = ref<DormApi.DormArea[]>([]);
const selectedAreaId = ref<number>();
const buildings = ref<DormApi.DormBuilding[]>([]);
const buildingInfoMap = ref<Record<number, DormApi.DormBuildingInfo>>({});
const selectedBuildId = ref<number>();
const selectedStoreyId = ref<number>();
const storeyCreateOpen = ref(false);
const storeyCreateFloor = ref<number>();
const storeyCreateSubmitting = ref(false);
const roomStoreySelectOpen = ref(false);
const loading = ref(false);

const [BuildModal, buildModalApi] = useVbenModal({
  connectedComponent: BuildingForm,
  destroyOnClose: true,
});
const [RoomModal, roomModalApi] = useVbenModal({
  connectedComponent: RoomForm,
  destroyOnClose: true,
});
const [AreaModal, areaModalApi] = useVbenModal({
  connectedComponent: AreaForm,
  destroyOnClose: true,
});

const currentArea = computed(() =>
  areas.value.find((area) => area.id === selectedAreaId.value),
);

const currentBuildInfo = computed(() =>
  selectedBuildId.value
    ? buildingInfoMap.value[selectedBuildId.value]
    : undefined,
);

const currentStoreys = computed(
  () => currentBuildInfo.value?.storeyBaseInfo ?? [],
);

const currentStorey = computed(() =>
  currentStoreys.value.find((storey) => storey.id === selectedStoreyId.value),
);

const currentRooms = computed<RoomWithFloor[]>(() => {
  if (!selectedStoreyId.value) {
    return currentStoreys.value.flatMap((storey) =>
      (storey.roomBaseInfo ?? []).map((room) => ({
        ...room,
        floorLabel: `${storey.floor}层`,
      })),
    );
  }
  const storey = currentStoreys.value.find(
    (item) => item.id === selectedStoreyId.value,
  );
  return (storey?.roomBaseInfo ?? []).map((room) => ({
    ...room,
    floorLabel: `${storey?.floor}层`,
  }));
});

const currentRoomCount = computed(() =>
  currentStoreys.value.reduce(
    (total, storey) => total + (storey.roomBaseInfo?.length ?? 0),
    0,
  ),
);

const currentCapacity = computed(() =>
  currentStoreys.value.reduce(
    (total, storey) =>
      total +
      (storey.roomBaseInfo ?? []).reduce(
        (roomTotal, room) => roomTotal + (room.capacity ?? 0),
        0,
      ),
    0,
  ),
);

const availableRoomCount = computed(() =>
  currentStoreys.value.reduce(
    (total, storey) =>
      total +
      (storey.roomBaseInfo ?? []).filter((room) => room.status !== 1).length,
    0,
  ),
);

function getBuildingRoomCount(buildingId?: number) {
  if (!buildingId) return 0;
  return (buildingInfoMap.value[buildingId]?.storeyBaseInfo ?? []).reduce(
    (total, storey) => total + (storey.roomBaseInfo?.length ?? 0),
    0,
  );
}

function getBuildingFloorCount(buildingId?: number) {
  if (!buildingId) return 0;
  return buildingInfoMap.value[buildingId]?.storeyBaseInfo?.length ?? 0;
}

function getRoomState(room: DormApi.DormRoom) {
  if (room.status === 1) {
    return { color: 'warning', label: '已锁定' };
  }
  return { color: 'success', label: '可用' };
}

function getRoomAccentColor(room: DormApi.DormRoom) {
  if (room.status === 1) return '#f59e0b';
  return '#18a058';
}

function getRoomTypeLabel(roomType: number) {
  return roomType === 1 ? '单人间' : '多人间';
}

function formatRoomPrice(room: DormApi.DormRoom) {
  if (room.settleAmount === undefined || room.settleAmount === null) {
    return '未设置';
  }
  return `${room.settleCurrencyCode || ''} ${room.settleAmount} / 人 / 晚`.trim();
}

async function loadAreas() {
  areas.value = await getAreaSimpleList();
  const routeAreaId = route.query.areaId
    ? Number(route.query.areaId)
    : undefined;
  const targetArea =
    areas.value.find((area) => area.id === routeAreaId) ?? areas.value[0];
  selectedAreaId.value = targetArea?.id;
  await loadBuildings();
}

async function loadBuildings(options: { preserveSelection?: boolean } = {}) {
  if (!selectedAreaId.value) {
    buildings.value = [];
    buildingInfoMap.value = {};
    selectedBuildId.value = undefined;
    selectedStoreyId.value = undefined;
    return;
  }

  const previousBuildId = options.preserveSelection
    ? selectedBuildId.value
    : undefined;
  loading.value = true;
  selectedStoreyId.value = undefined;
  try {
    const nextBuildings = await getBuildSimpleList(selectedAreaId.value);
    const nextInfoMap: Record<number, DormApi.DormBuildingInfo> = {};
    await Promise.all(
      nextBuildings.map(async (building) => {
        if (building.id) {
          nextInfoMap[building.id] = await getBuildInfo(building.id);
        }
      }),
    );

    buildings.value = nextBuildings;
    buildingInfoMap.value = nextInfoMap;
    selectedBuildId.value =
      previousBuildId && nextInfoMap[previousBuildId]
        ? previousBuildId
        : nextBuildings[0]?.id;
  } finally {
    loading.value = false;
  }
}

async function handleAreaChange() {
  await router.replace({
    query: { ...route.query, areaId: selectedAreaId.value },
  });
  await loadBuildings();
}

function handleSelectBuilding(buildingId?: number) {
  if (!buildingId) return;
  selectedBuildId.value = buildingId;
  selectedStoreyId.value = undefined;
}

function handleBackToAreas() {
  router.push('/dorm/area');
}

function handleEditArea() {
  if (!currentArea.value) return;
  areaModalApi.setData(currentArea.value).open();
}

function handleOpenScheduler() {
  if (!currentBuildInfo.value?.id) return;
  router.push({
    path: '/dorm/scheduler',
    query: {
      buildId: currentBuildInfo.value.id,
      buildName: currentBuildInfo.value.buildName,
    },
  });
}

function handleAddBuilding() {
  if (!selectedAreaId.value) {
    message.warning('请先选择所属区域');
    return;
  }
  buildModalApi.setData({ areaId: selectedAreaId.value }).open();
}

function handleEditBuilding() {
  if (!currentBuildInfo.value) return;
  buildModalApi
    .setData({
      ...currentBuildInfo.value,
      buildStorey:
        currentBuildInfo.value.buildStorey ?? currentStoreys.value.length,
    })
    .open();
}

async function handleDeleteBuilding() {
  if (!currentBuildInfo.value?.id) return;
  await deleteBuild(currentBuildInfo.value.id);
  message.success(`楼栋「${currentBuildInfo.value.buildName}」已删除`);
  await loadBuildings();
}

function handleAddStorey() {
  if (!currentBuildInfo.value?.id) return;
  storeyCreateFloor.value =
    Math.max(0, ...currentStoreys.value.map((storey) => storey.floor)) + 1;
  storeyCreateOpen.value = true;
}

async function handleCreateStorey() {
  if (!currentBuildInfo.value?.id || !storeyCreateFloor.value) return;
  const floor = storeyCreateFloor.value;
  if (currentStoreys.value.some((storey) => storey.floor === floor)) {
    message.warning(`第 ${floor} 层已存在，请选择其他楼层`);
    return;
  }

  storeyCreateSubmitting.value = true;
  try {
    await createStorey({ buildId: currentBuildInfo.value.id, floor });
    message.success(`第 ${floor} 层已添加`);
    storeyCreateOpen.value = false;
    await refreshCurrentBuilding();
    selectedStoreyId.value = currentStoreys.value.find(
      (storey) => storey.floor === floor,
    )?.id;
  } finally {
    storeyCreateSubmitting.value = false;
  }
}

async function handleDeleteStorey(storey: DormApi.DormStoreyInfo) {
  if (!storey.id || !currentBuildInfo.value?.id) return;
  await deleteStorey(storey.id);
  if (selectedStoreyId.value === storey.id) {
    selectedStoreyId.value = undefined;
  }
  message.success(`第 ${storey.floor} 层已删除`);
  await refreshCurrentBuilding();
}

function handleAddRoom() {
  if (currentStoreys.value.length === 0) {
    message.warning('请先新增楼层');
    return;
  }

  if (selectedStoreyId.value) {
    roomModalApi.setData({ storeyId: selectedStoreyId.value }).open();
    return;
  }

  if (currentStoreys.value.length === 1 && currentStoreys.value[0]?.id) {
    roomModalApi.setData({ storeyId: currentStoreys.value[0].id }).open();
    return;
  }

  roomStoreySelectOpen.value = true;
}

function handleRoomStoreySelect(storeyId?: number) {
  if (!storeyId) return;
  roomStoreySelectOpen.value = false;
  roomModalApi.setData({ storeyId }).open();
}

function handleEditRoom(room: DormApi.DormRoom) {
  roomModalApi.setData({ ...room }).open();
}

async function handleDeleteRoom(room: DormApi.DormRoom) {
  if (!room.id) return;
  await deleteRoom(room.id);
  message.success(`房间「${room.roomAlias}」已删除`);
  await refreshCurrentBuilding();
}

async function refreshCurrentBuilding() {
  if (!selectedBuildId.value) return;
  buildingInfoMap.value[selectedBuildId.value] = await getBuildInfo(
    selectedBuildId.value,
  );
}

async function onBuildingFormSuccess() {
  await loadBuildings({ preserveSelection: true });
}

async function onRoomFormSuccess() {
  await refreshCurrentBuilding();
}

async function onAreaFormSuccess() {
  const currentAreaId = selectedAreaId.value;
  areas.value = await getAreaSimpleList();
  selectedAreaId.value = currentAreaId;
}

onMounted(loadAreas);
</script>

<template>
  <Page auto-content-height>
    <BuildModal @success="onBuildingFormSuccess" />
    <RoomModal @success="onRoomFormSuccess" />
    <AreaModal @success="onAreaFormSuccess" />
    <Modal
      v-model:open="storeyCreateOpen"
      :title="`为「${currentBuildInfo?.buildName ?? ''}」新增楼层`"
      ok-text="确认新增"
      cancel-text="取消"
      :confirm-loading="storeyCreateSubmitting"
      @ok="handleCreateStorey"
    >
      <div class="text-muted-foreground mb-3 text-sm">
        已默认填写下一层，如楼栋存在跳层，可直接修改为实际楼层。
      </div>
      <InputNumber
        v-model:value="storeyCreateFloor"
        class="w-full"
        :min="1"
        :precision="0"
        placeholder="请输入楼层"
      />
      <div
        v-if="currentStoreys.length > 0"
        class="text-muted-foreground mt-3 text-xs"
      >
        已有楼层：{{
          currentStoreys.map((storey) => `${storey.floor} 层`).join('、')
        }}
      </div>
    </Modal>
    <Modal
      v-model:open="roomStoreySelectOpen"
      title="选择新增房间的楼层"
      :footer="null"
      width="640px"
    >
      <div class="text-muted-foreground mb-4 text-sm">
        当前正在查看全部房间，点击楼层卡片即可在该楼层新增房间。
      </div>
      <Row :gutter="[12, 12]">
        <Col
          v-for="storey in currentStoreys"
          :key="storey.id"
          :xs="24"
          :sm="12"
        >
          <Card
            hoverable
            size="small"
            class="h-full cursor-pointer"
            :body-style="{ padding: '14px 16px' }"
            @click="handleRoomStoreySelect(storey.id)"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-foreground font-semibold">
                  {{ storey.floor }} 层
                </div>
                <div class="text-muted-foreground mt-1 text-xs">
                  {{ storey.roomBaseInfo?.length ?? 0 }} 间房
                </div>
              </div>
              <IconifyIcon
                icon="lucide:chevron-right"
                :size="18"
                class="text-muted-foreground"
              />
            </div>
          </Card>
        </Col>
      </Row>
    </Modal>

    <div class="flex h-full flex-col gap-2 overflow-hidden">
      <Card
        class="shrink-0 shadow-sm"
        size="small"
        :body-style="{ padding: '16px' }"
      >
        <div class="building-header-content">
          <div class="flex min-w-0 items-center gap-3">
            <Button type="text" class="hero-back" @click="handleBackToAreas">
              <IconifyIcon icon="lucide:arrow-left" :size="18" />
            </Button>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-foreground m-0 truncate text-lg font-semibold">
                  {{ currentArea?.areaName || '楼栋管理' }}
                </h2>
                <Tag v-if="currentArea?.regionName" color="blue">
                  {{ currentArea.regionName }}
                </Tag>
              </div>
              <p class="text-muted-foreground mb-0 mt-1 truncate text-sm">
                {{ currentArea?.position || '选择区域后维护楼栋、楼层与房间' }}
              </p>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <Select
              v-model:value="selectedAreaId"
              :options="
                areas.map((area) => ({
                  label: area.areaName,
                  value: area.id,
                }))
              "
              class="area-select"
              placeholder="选择宿舍区域"
              show-search
              option-filter-prop="label"
              @change="handleAreaChange"
            />
            <Button
              v-access:code="['dorm:area:update']"
              :disabled="!currentArea"
              @click="handleEditArea"
            >
              <IconifyIcon icon="lucide:pencil" />
              编辑区域
            </Button>
            <Button
              v-access:code="['dorm:build:create']"
              type="primary"
              @click="handleAddBuilding"
            >
              <IconifyIcon icon="lucide:plus" />
              新增楼栋
            </Button>
          </div>
        </div>

        <div class="area-attention">
          <IconifyIcon icon="lucide:info" :size="17" />
          <div class="min-w-0">
            <div class="area-attention__title">区域说明</div>
            <div
              v-if="currentArea?.attention"
              class="area-attention__content"
              v-dompurify-html="currentArea.attention"
            ></div>
            <div v-else class="area-attention__empty">暂未填写区域说明</div>
          </div>
        </div>
      </Card>

      <div class="building-workspace">
        <Card
          class="building-sidebar shadow-sm"
          size="small"
          :body-style="{
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }"
        >
          <div class="building-sidebar__header">
            <div>
              <div class="text-foreground text-sm font-semibold">楼栋列表</div>
              <div class="text-muted-foreground mt-0.5 text-xs">
                共 {{ buildings.length }} 栋
              </div>
            </div>
            <Button
              type="text"
              :loading="loading"
              @click="loadBuildings({ preserveSelection: true })"
            >
              <IconifyIcon icon="lucide:refresh-cw" :size="16" />
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-2">
            <Spin :spinning="loading">
              <Empty
                v-if="!loading && buildings.length === 0"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
                description="当前区域暂无楼栋"
                class="mt-12"
              />
              <div v-else class="space-y-2">
                <button
                  v-for="building in buildings"
                  :key="building.id"
                  type="button"
                  class="building-nav-item"
                  :class="{
                    'building-nav-item--active':
                      building.id === selectedBuildId,
                  }"
                  @click="handleSelectBuilding(building.id)"
                >
                  <span class="building-nav-item__icon">
                    <IconifyIcon icon="lucide:building" :size="18" />
                  </span>
                  <span class="min-w-0 flex-1 text-left">
                    <strong class="block truncate">
                      {{ building.buildName }}
                    </strong>
                    <span class="mt-1 block truncate text-xs">
                      {{
                        building.buildNo
                          ? `编号 ${building.buildNo}`
                          : '未设置编号'
                      }}
                    </span>
                    <span class="mt-2 flex items-center gap-3 text-xs">
                      <span> {{ getBuildingFloorCount(building.id) }} 层 </span>
                      <span>
                        {{ getBuildingRoomCount(building.id) }} 间房
                      </span>
                    </span>
                  </span>
                  <IconifyIcon
                    icon="lucide:chevron-right"
                    :size="16"
                    class="building-nav-item__arrow"
                  />
                </button>
              </div>
            </Spin>
          </div>

          <div class="border-border border-t p-3">
            <Button
              v-access:code="['dorm:build:create']"
              block
              @click="handleAddBuilding"
            >
              <IconifyIcon icon="lucide:plus" />
              添加楼栋
            </Button>
          </div>
        </Card>

        <main class="building-detail">
          <div
            v-if="!currentBuildInfo && !loading"
            class="flex h-full min-h-[420px] items-center justify-center"
          >
            <Empty
              :description="
                buildings.length === 0
                  ? '请先为当前区域添加楼栋'
                  : '请从左侧选择一个楼栋'
              "
            />
          </div>

          <template v-if="currentBuildInfo">
            <Card
              class="build-overview shadow-sm"
              :body-style="{ padding: '12px 16px 16px' }"
            >
              <div class="flex items-start justify-between gap-6">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="size-2 shrink-0 rounded-full bg-[#2f7df6]"
                    ></span>
                    <h3 class="text-foreground m-0 text-xl font-semibold">
                      {{ currentBuildInfo.buildName }}
                    </h3>
                    <Tag v-if="currentBuildInfo.buildNo">
                      编号 {{ currentBuildInfo.buildNo }}
                    </Tag>
                  </div>
                  <div
                    class="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm"
                  >
                    <IconifyIcon icon="lucide:map-pin" :size="15" />
                    <span>
                      {{ currentBuildInfo.address || '暂未填写楼栋地址' }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    v-access:code="['dorm:room:query']"
                    @click="handleOpenScheduler"
                  >
                    <IconifyIcon icon="lucide:calendar-days" />
                    排房管理
                  </Button>
                  <Button
                    v-access:code="['dorm:build:update']"
                    @click="handleEditBuilding"
                  >
                    <IconifyIcon icon="lucide:pencil" />
                    编辑楼栋
                  </Button>
                  <Popconfirm
                    :title="`确定删除楼栋「${currentBuildInfo.buildName}」吗？`"
                    description="楼栋下存在楼层或房间时可能无法删除。"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="handleDeleteBuilding"
                  >
                    <Button
                      v-access:code="['dorm:build:delete']"
                      danger
                      type="text"
                    >
                      <IconifyIcon icon="lucide:trash-2" />
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <Row :gutter="[12, 12]" class="mt-5">
                <Col :xs="12" :xl="6">
                  <Card
                    class="h-full shadow-sm"
                    size="small"
                    :style="{ borderTop: '3px solid #2f7df6' }"
                    :body-style="{ padding: '12px 16px 16px' }"
                  >
                    <Statistic title="楼层" :value="currentStoreys.length" />
                  </Card>
                </Col>
                <Col :xs="12" :xl="6">
                  <Card
                    class="h-full shadow-sm"
                    size="small"
                    :style="{ borderTop: '3px solid #18a058' }"
                    :body-style="{ padding: '12px 16px 16px' }"
                  >
                    <Statistic title="房间" :value="currentRoomCount" />
                  </Card>
                </Col>
                <Col :xs="12" :xl="6">
                  <Card
                    class="h-full shadow-sm"
                    size="small"
                    :style="{ borderTop: '3px solid #f59e0b' }"
                    :body-style="{ padding: '12px 16px 16px' }"
                  >
                    <Statistic
                      title="总可入住人数"
                      :value="currentCapacity"
                      suffix="人"
                    />
                  </Card>
                </Col>
                <Col :xs="12" :xl="6">
                  <Card
                    class="h-full shadow-sm"
                    size="small"
                    :style="{ borderTop: '3px solid #7c3aed' }"
                    :body-style="{ padding: '12px 16px 16px' }"
                  >
                    <Statistic title="可用房间" :value="availableRoomCount" />
                  </Card>
                </Col>
              </Row>

              <div v-if="currentBuildInfo.attention" class="mt-5">
                <Alert type="warning" show-icon>
                  <template #message>
                    <div
                      class="building-attention"
                      v-dompurify-html="currentBuildInfo.attention"
                    ></div>
                  </template>
                </Alert>
              </div>
            </Card>

            <Card
              class="min-h-0 flex-1 shadow-sm"
              :body-style="{
                padding: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }"
            >
              <div class="floor-toolbar">
                <div>
                  <div class="text-foreground text-base font-semibold">
                    楼层与房间
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-xs">
                    选择楼层后可新增、编辑或删除房间
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Popconfirm
                    v-if="currentStorey"
                    :title="`确定删除第 ${currentStorey.floor} 层吗？`"
                    description="该楼层下的房间也会一并删除，请谨慎操作。"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="handleDeleteStorey(currentStorey)"
                  >
                    <Button
                      v-access:code="['dorm:storey:delete']"
                      type="text"
                      danger
                    >
                      <IconifyIcon icon="lucide:trash-2" />
                      删除当前楼层
                    </Button>
                  </Popconfirm>
                  <Button
                    v-access:code="['dorm:storey:create']"
                    @click="handleAddStorey"
                  >
                    <IconifyIcon icon="lucide:layers-3" />
                    新增楼层
                  </Button>
                  <Button
                    v-access:code="['dorm:room:create']"
                    type="primary"
                    :disabled="currentStoreys.length === 0"
                    @click="handleAddRoom"
                  >
                    <IconifyIcon icon="lucide:plus" />
                    {{
                      selectedStoreyId
                        ? `在 ${
                            currentStoreys.find(
                              (storey) => storey.id === selectedStoreyId,
                            )?.floor
                          } 层新增房间`
                        : '新增房间'
                    }}
                  </Button>
                </div>
              </div>

              <div v-if="currentStoreys.length > 0" class="floor-tabs">
                <button
                  type="button"
                  class="floor-tab"
                  :class="{ 'floor-tab--active': !selectedStoreyId }"
                  @click="selectedStoreyId = undefined"
                >
                  <IconifyIcon icon="lucide:layout-grid" :size="15" />
                  全部房间
                  <span>{{ currentRoomCount }}</span>
                </button>
                <div
                  v-for="storey in currentStoreys"
                  :key="storey.id"
                  class="floor-tab"
                  :class="{
                    'floor-tab--active': selectedStoreyId === storey.id,
                  }"
                  role="button"
                  tabindex="0"
                  @click="selectedStoreyId = storey.id"
                  @keydown.enter="selectedStoreyId = storey.id"
                >
                  <IconifyIcon icon="lucide:layers" :size="15" />
                  {{ storey.floor }} 层
                  <span>{{ storey.roomBaseInfo?.length ?? 0 }}</span>
                </div>
              </div>

              <div class="min-h-0 flex-1 overflow-auto p-4">
                <Empty
                  v-if="currentStoreys.length === 0"
                  description="当前楼栋还没有楼层，请先新增楼层"
                  class="mt-14"
                >
                  <Button
                    v-access:code="['dorm:storey:create']"
                    type="primary"
                    @click="handleAddStorey"
                  >
                    新增第 1 层
                  </Button>
                </Empty>
                <Empty
                  v-else-if="currentRooms.length === 0"
                  :description="
                    selectedStoreyId ? '当前楼层暂无房间' : '当前楼栋暂无房间'
                  "
                  class="mt-14"
                >
                  <Button
                    v-access:code="['dorm:room:create']"
                    type="primary"
                    @click="handleAddRoom"
                  >
                    新增房间
                  </Button>
                </Empty>

                <div v-else class="room-grid">
                  <Card
                    v-for="room in currentRooms"
                    :key="room.id"
                    class="room-card shadow-sm"
                    hoverable
                    :style="{
                      borderTop: `3px solid ${getRoomAccentColor(room)}`,
                    }"
                    :body-style="{ padding: 0 }"
                  >
                    <div class="px-4 pb-4 pt-3">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex min-w-0 items-center gap-3">
                          <div class="room-card__icon">
                            <IconifyIcon icon="lucide:bed-single" :size="19" />
                          </div>
                          <div class="min-w-0">
                            <h4
                              class="text-foreground m-0 truncate text-base font-semibold"
                              :title="room.roomAlias"
                            >
                              {{ room.roomAlias }}
                            </h4>
                            <div class="text-muted-foreground mt-1 text-xs">
                              {{ room.floorLabel }}
                              <template v-if="room.roomCode">
                                · 编号 {{ room.roomCode }}
                              </template>
                            </div>
                          </div>
                        </div>
                        <Tag :color="getRoomState(room).color">
                          {{ getRoomState(room).label }}
                        </Tag>
                      </div>

                      <div class="room-card__meta">
                        <div>
                          <span>房型</span>
                          <strong>{{ getRoomTypeLabel(room.roomType) }}</strong>
                        </div>
                        <div>
                          <span>可入住人数</span>
                          <strong>{{ room.capacity }} 人</strong>
                        </div>
                        <div class="col-span-2">
                          <span>结算标准</span>
                          <strong>{{ formatRoomPrice(room) }}</strong>
                        </div>
                      </div>
                    </div>

                    <div class="room-card__actions">
                      <Button
                        v-access:code="['dorm:room:update']"
                        type="text"
                        size="small"
                        @click="handleEditRoom(room)"
                      >
                        <IconifyIcon icon="lucide:pencil" />
                        编辑
                      </Button>
                      <Popconfirm
                        :title="`确定删除房间「${room.roomAlias}」吗？`"
                        ok-text="删除"
                        cancel-text="取消"
                        @confirm="handleDeleteRoom(room)"
                      >
                        <Button
                          v-access:code="['dorm:room:delete']"
                          type="text"
                          danger
                          size="small"
                        >
                          <IconifyIcon icon="lucide:trash-2" />
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
          </template>
        </main>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.building-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.hero-back {
  flex: none;
}

.area-select {
  width: 240px;
}

.area-attention {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 14px;
  padding: 10px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
  background: hsl(var(--muted) / 48%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.area-attention > svg {
  flex: none;
  margin-top: 1px;
  color: hsl(var(--primary));
}

.area-attention__title {
  margin-bottom: 2px;
  color: hsl(var(--foreground));
  font-weight: 600;
}

.area-attention__content :deep(p) {
  margin-bottom: 4px;
}

.area-attention__content :deep(p:last-child) {
  margin-bottom: 0;
}

.area-attention__empty {
  color: hsl(var(--muted-foreground));
}

.building-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
  gap: 16px;
}

.building-sidebar {
  min-height: 0;
  overflow: hidden;
}

.building-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.building-nav-item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  outline: none;
  transition: all 160ms ease;
}

.building-nav-item:hover {
  background: hsl(var(--accent));
}

.building-nav-item--active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 25%);
}

.building-nav-item__icon {
  display: flex;
  width: 34px;
  height: 34px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 9px;
}

.building-nav-item--active .building-nav-item__icon {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.building-nav-item__arrow {
  align-self: center;
  color: hsl(var(--muted-foreground));
}

.building-detail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.build-overview {
  flex: none;
  overflow: hidden;
}

.building-attention :deep(p:last-child) {
  margin-bottom: 0;
}

.floor-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.floor-tabs {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  background: hsl(var(--muted) / 40%);
  border-bottom: 1px solid hsl(var(--border));
}

.floor-tab {
  display: inline-flex;
  height: 32px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  cursor: pointer;
}

.floor-tab:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 40%);
}

.floor-tab--active {
  color: hsl(var(--primary));
  font-weight: 500;
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 35%);
}

.floor-tab > span {
  min-width: 18px;
  padding: 0 5px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  background: hsl(var(--muted));
  border-radius: 9px;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 280px));
  gap: 14px;
}

.room-card {
  position: relative;
  overflow: hidden;
  border-color: hsl(var(--border));
  transition: border-color 160ms ease;
}

.room-card:hover {
  border-color: hsl(var(--primary) / 45%);
}

.room-card__icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 9px;
}

.room-card__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.room-card__meta > div {
  min-width: 0;
  padding: 8px 10px;
  background: hsl(var(--muted) / 60%);
  border-radius: 7px;
}

.room-card__meta span,
.room-card__meta strong {
  display: block;
}

.room-card__meta span {
  color: hsl(var(--muted-foreground));
  font-size: 10px;
}

.room-card__meta strong {
  margin-top: 2px;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  padding: 8px 10px;
  background: hsl(var(--muted) / 40%);
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 960px) {
  .building-header-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .building-workspace {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .building-sidebar {
    min-height: 230px;
  }

  .building-detail {
    min-height: 560px;
    overflow: visible;
  }
}

@media (max-width: 680px) {
  .area-select {
    width: 200px;
  }

  .build-overview > :deep(.ant-card-body) > div:first-child,
  .floor-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .room-grid {
    grid-template-columns: 1fr;
  }
}
</style>
