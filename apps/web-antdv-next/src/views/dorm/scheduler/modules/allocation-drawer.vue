<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import { allocateDormBed, getRoomAllocationWorkbench } from '#/api/dorm';

import {
  getSingleDatePickerValue,
  type SingleDatePickerValue,
} from '../../utils/date-picker';

const props = defineProps<{
  buildId?: number;
  endDate: string;
  listMode?: 'drawer' | 'hidden';
  open: boolean;
  presetBedId?: number;
  presetRoomId?: number;
  presetStartDate?: string;
  startDate: string;
}>();

const emit = defineEmits<{
  dragEnd: [];
  dragStart: [guest: DormApi.PendingAllocationGuest];
  success: [];
  'update:open': [value: boolean];
}>();

const TextArea = Input.TextArea;

const loading = ref(false);
const availabilityLoading = ref(false);
const submitting = ref(false);
const workbench = ref<DormApi.RoomAllocationWorkbench>();
const allocationOpen = ref(false);
const selectedGuest = ref<DormApi.PendingAllocationGuest>();
const selectedRoomId = ref<number>();
const selectedBedId = ref<number>();
const plannedStartDate = ref('');
const plannedEndDate = ref('');
const reason = ref('');
const guestKeyword = ref('');

const pendingGuests = computed(() => workbench.value?.pendingGuests ?? []);
const visiblePendingGuests = computed(() => {
  const keyword = guestKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return pendingGuests.value;
  return pendingGuests.value.filter((guest) =>
    [guest.userName, guest.orderSerial, guest.requestGroupNo]
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLocaleLowerCase().includes(keyword)),
  );
});
const rooms = computed(() => workbench.value?.rooms ?? []);
const selectedRoom = computed(() =>
  rooms.value.find((room) => room.id === selectedRoomId.value),
);
const presetRoom = computed(() =>
  rooms.value.find((room) => room.id === props.presetRoomId),
);
const presetBed = computed(() =>
  presetRoom.value?.beds.find((bed) => bed.id === props.presetBedId),
);
const periodChanged = computed(
  () =>
    selectedGuest.value?.approvedStartDate !== plannedStartDate.value ||
    selectedGuest.value?.approvedEndDate !== plannedEndDate.value,
);
const canSubmit = computed(
  () =>
    selectedGuest.value &&
    selectedRoomId.value &&
    selectedBedId.value &&
    plannedStartDate.value &&
    plannedEndDate.value &&
    dayjs(plannedStartDate.value).isBefore(dayjs(plannedEndDate.value)) &&
    (!periodChanged.value || reason.value.trim()),
);

function isBedOccupied(bed: DormApi.RoomAllocationBed) {
  if (!plannedStartDate.value || !plannedEndDate.value) return false;
  return bed.assignments.some(
    (assignment) =>
      dayjs(assignment.startDate).isBefore(dayjs(plannedEndDate.value)) &&
      dayjs(assignment.endDate).isAfter(dayjs(plannedStartDate.value)),
  );
}

const roomOptions = computed(() =>
  rooms.value.map((room) => {
    const availableCount = room.beds.filter(
      (bed) => bed.status === 0 && !isBedOccupied(bed),
    ).length;
    return {
      disabled: room.status !== 0 || availableCount === 0,
      label:
        room.status === 0
          ? `${room.roomAlias || room.roomCode} · ${
              room.floor ?? '-'
            } 层 · 可用 ${availableCount}/${room.beds.length}`
          : `${room.roomAlias || room.roomCode} · ${room.floor ?? '-'} 层 · 房间停用`,
      value: room.id,
    };
  }),
);

const bedOptions = computed(() =>
  (selectedRoom.value?.beds ?? []).map((bed) => {
    const occupied = isBedOccupied(bed);
    return {
      disabled: bed.status !== 0 || occupied,
      label: occupied ? `${bed.bedCode} · 已占用` : `${bed.bedCode} · 可用`,
      value: bed.id,
    };
  }),
);

function roomTypeLabel(roomType?: number) {
  if (roomType === 1) return '偏好单人间';
  if (roomType === 2) return '偏好多床间';
  return '不限房型';
}

function createOperationNo(guestId: number) {
  return `ROOM-${guestId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadWorkbench() {
  if (!props.open || !props.buildId) {
    workbench.value = undefined;
    return;
  }
  loading.value = true;
  try {
    workbench.value = await getRoomAllocationWorkbench({
      buildId: props.buildId,
      endDate: props.endDate,
      startDate: props.startDate,
    });
  } finally {
    loading.value = false;
  }
}

async function openAllocation(
  guest: DormApi.PendingAllocationGuest,
  preset?: { bedId?: number; roomId?: number; startDate?: string },
) {
  if (!workbench.value && props.buildId) await loadWorkbench();
  selectedGuest.value = guest;
  const originalStart =
    guest.plannedStartDate || guest.approvedStartDate || props.startDate;
  const originalEnd =
    guest.plannedEndDate || guest.approvedEndDate || props.endDate;
  const startDate = preset?.startDate || props.presetStartDate || originalStart;
  const nights = Math.max(
    1,
    dayjs(originalEnd).diff(dayjs(originalStart), 'day'),
  );
  plannedStartDate.value = startDate;
  plannedEndDate.value =
    startDate === originalStart
      ? originalEnd
      : dayjs(startDate).add(nights, 'day').format('YYYY-MM-DD');
  reason.value = guest.adjustReason ?? '';
  selectedRoomId.value = preset?.roomId ?? props.presetRoomId;
  selectedBedId.value = preset?.bedId ?? props.presetBedId;
  if (
    selectedRoomId.value &&
    !rooms.value.some((room) => room.id === selectedRoomId.value)
  ) {
    selectedRoomId.value = undefined;
    selectedBedId.value = undefined;
  }
  allocationOpen.value = true;
  await refreshAllocationAvailability();
  if (
    !bedOptions.value.some(
      (bed) => bed.value === selectedBedId.value && !bed.disabled,
    )
  ) {
    selectedBedId.value = undefined;
  }
}

function startGuestDrag(
  guest: DormApi.PendingAllocationGuest,
  event: DragEvent,
) {
  event.dataTransfer?.setData('application/x-dorm-guest-id', String(guest.id));
  event.dataTransfer?.setData('text/plain', String(guest.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  emit('dragStart', guest);
}

function endGuestDrag() {
  emit('dragEnd');
}

function handleRoomChange() {
  selectedBedId.value = undefined;
}

async function handleStartDateChange(value: SingleDatePickerValue) {
  plannedStartDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
  selectedBedId.value = undefined;
  await refreshAllocationAvailability();
}

async function handleEndDateChange(value: SingleDatePickerValue) {
  plannedEndDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
  selectedBedId.value = undefined;
  await refreshAllocationAvailability();
}

async function refreshAllocationAvailability() {
  if (
    !props.buildId ||
    !plannedStartDate.value ||
    !plannedEndDate.value ||
    !dayjs(plannedStartDate.value).isBefore(dayjs(plannedEndDate.value))
  ) {
    return;
  }
  availabilityLoading.value = true;
  try {
    workbench.value = await getRoomAllocationWorkbench({
      buildId: props.buildId,
      endDate: plannedEndDate.value,
      startDate: plannedStartDate.value,
    });
    if (
      selectedRoomId.value &&
      !rooms.value.some((room) => room.id === selectedRoomId.value)
    ) {
      selectedRoomId.value = undefined;
      selectedBedId.value = undefined;
    }
  } finally {
    availabilityLoading.value = false;
  }
}

async function submitAllocation() {
  const guest = selectedGuest.value;
  if (
    !guest ||
    !selectedRoomId.value ||
    !selectedBedId.value ||
    !canSubmit.value
  ) {
    message.warning('请完整选择日期、房间和床位');
    return;
  }
  submitting.value = true;
  try {
    await allocateDormBed({
      bedId: selectedBedId.value,
      endDate: plannedEndDate.value,
      guestId: guest.id,
      operationNo: createOperationNo(guest.id),
      reason: reason.value.trim() || undefined,
      roomId: selectedRoomId.value,
      startDate: plannedStartDate.value,
      version: guest.version,
    });
    message.success(`已为 ${guest.userName} 分配床位`);
    allocationOpen.value = false;
    await loadWorkbench();
    emit('success');
  } finally {
    submitting.value = false;
  }
}

watch(
  () => [props.open, props.buildId, props.startDate, props.endDate],
  ([open]) => {
    if (open) guestKeyword.value = '';
    return loadWorkbench();
  },
  { immediate: true },
);

defineExpose({ openAllocation });
</script>

<template>
  <Drawer
    v-if="listMode !== 'hidden'"
    :open="open"
    title="待分配住宿人"
    width="560"
    :mask="false"
    :body-style="{ padding: '16px' }"
    @update:open="emit('update:open', $event)"
  >
    <template #extra>
      <Button :loading="loading" type="text" @click="loadWorkbench">
        <IconifyIcon icon="lucide:refresh-cw" />
        刷新
      </Button>
    </template>

    <div class="text-muted-foreground mb-4 text-sm">
      每位住宿人可独立调整日期和床位；同一申请组可以拆分，不同订单也可以拼住同一房间。
    </div>

    <div v-if="presetRoom || presetStartDate" class="allocation-target mb-4">
      <div class="allocation-target__icon">
        <IconifyIcon icon="lucide:map-pin-check" :size="18" />
      </div>
      <div class="min-w-0">
        <div class="text-muted-foreground text-xs">当前排房目标</div>
        <strong class="allocation-target__title">
          {{ presetRoom?.roomAlias || presetRoom?.roomCode || '已选房间' }}
          <template v-if="presetBed"> / {{ presetBed.bedCode }}</template>
        </strong>
        <div v-if="presetStartDate" class="text-muted-foreground mt-1 text-xs">
          从 {{ presetStartDate }} 开始，选择住宿人后仍可调整入住和退宿日期
        </div>
      </div>
    </div>

    <Spin :spinning="loading">
      <Empty
        v-if="!loading && pendingGuests.length === 0"
        description="当前楼栋没有待分配住宿人"
        class="mt-16"
      />

      <div v-else class="space-y-3">
        <div class="pending-guest-toolbar">
          <Input
            v-model:value="guestKeyword"
            allow-clear
            placeholder="搜索姓名、订单号或申请组"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="text-muted-foreground" />
            </template>
          </Input>
          <Tag>
{{ visiblePendingGuests.length }} /
            {{ pendingGuests.length }} 人
</Tag>
        </div>

        <Empty
          v-if="visiblePendingGuests.length === 0"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="没有匹配的待分配住宿人"
          class="py-10"
        />

        <Card
          v-for="guest in visiblePendingGuests"
          :key="guest.id"
          draggable="true"
          size="small"
          class="pending-guest-card"
          :body-style="{ padding: '14px 16px' }"
          @dragstart="startGuestDrag(guest, $event)"
          @dragend="endGuestDrag"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <strong class="text-foreground">{{ guest.userName }}</strong>
                <Tag color="processing">待分配</Tag>
                <Tag v-if="guest.requestGroupNo">
组 {{ guest.requestGroupNo }}
</Tag>
                <Tag color="purple">
{{
                  roomTypeLabel(guest.requestedRoomType)
                }}
</Tag>
              </div>
              <div class="text-muted-foreground mt-1 truncate text-xs">
                {{ guest.orderSerial }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="pending-guest-card__drag">
                <IconifyIcon icon="lucide:grip-vertical" />
                拖到日历
              </span>
              <Button type="primary" size="small" @click="openAllocation(guest)">
分配床位
</Button>
            </div>
          </div>

          <div class="pending-guest-card__meta">
            <div>
              <IconifyIcon icon="lucide:calendar-days" :size="14" />
              <span>
                计划 {{ guest.plannedStartDate }} 至 {{ guest.plannedEndDate }}
              </span>
            </div>
            <div v-if="guest.remark">
              <IconifyIcon icon="lucide:message-square-text" :size="14" />
              <span>{{ guest.remark }}</span>
            </div>
          </div>
        </Card>
      </div>
    </Spin>
  </Drawer>

  <Modal
    v-model:open="allocationOpen"
    title="按住宿人分配床位"
    width="680px"
    ok-text="确认排房"
    cancel-text="取消"
    :confirm-loading="submitting"
    :ok-button-props="{ disabled: !canSubmit }"
    @ok="submitAllocation"
  >
    <Spin :spinning="availabilityLoading">
      <div v-if="selectedGuest" class="space-y-5">
        <div class="rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
          <div class="flex flex-wrap items-center gap-2">
            <strong>{{ selectedGuest.userName }}</strong>
            <Tag>{{ selectedGuest.orderSerial }}</Tag>
            <Tag v-if="selectedGuest.requestGroupNo">
              申请组 {{ selectedGuest.requestGroupNo }}
            </Tag>
          </div>
          <div class="text-muted-foreground mt-2 text-xs">
            审批时间：{{ selectedGuest.approvedStartDate }} 至
            {{ selectedGuest.approvedEndDate }}
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <div class="mb-1 text-sm font-medium">计划入住日期</div>
            <DatePicker
              :value="plannedStartDate ? dayjs(plannedStartDate) : undefined"
              class="w-full"
              :allow-clear="false"
              @change="handleStartDateChange"
            />
          </div>
          <div>
            <div class="mb-1 text-sm font-medium">计划退宿日期</div>
            <DatePicker
              :value="plannedEndDate ? dayjs(plannedEndDate) : undefined"
              class="w-full"
              :allow-clear="false"
              @change="handleEndDateChange"
            />
          </div>
          <div>
            <div class="mb-1 text-sm font-medium">房间</div>
            <Select
              v-model:value="selectedRoomId"
              class="w-full"
              placeholder="请选择房间"
              :options="roomOptions"
              show-search
              option-filter-prop="label"
              @change="handleRoomChange"
            />
          </div>
          <div>
            <div class="mb-1 text-sm font-medium">床位</div>
            <Select
              v-model:value="selectedBedId"
              class="w-full"
              placeholder="请选择床位"
              :disabled="!selectedRoomId"
              :options="bedOptions"
            />
          </div>
        </div>

        <div>
          <div class="mb-1 flex items-center gap-2 text-sm font-medium">
            调整原因
            <Tag v-if="periodChanged" color="orange">
日期偏离审批结果，必填
</Tag>
            <span v-else class="text-muted-foreground text-xs">选填</span>
          </div>
          <TextArea
            v-model:value="reason"
            :rows="3"
            :maxlength="255"
            placeholder="例如：该人员延后到达，调整首次排房日期"
            show-count
          />
        </div>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.pending-guest-card {
  border-color: hsl(var(--border));
  cursor: grab;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.allocation-target {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 12px 14px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 10px;
}

.allocation-target__icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 9px;
}

.allocation-target__title {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: hsl(var(--foreground));
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-guest-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding-bottom: 2px;
}

.pending-guest-card:active {
  cursor: grabbing;
}

.pending-guest-card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 4px 12px rgb(15 23 42 / 7%);
}

.pending-guest-card__meta {
  display: grid;
  gap: 7px;
  margin-top: 12px;
  padding-top: 11px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  border-top: 1px solid hsl(var(--border));
}

.pending-guest-card__meta > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.pending-guest-card__drag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  white-space: nowrap;
}
</style>
