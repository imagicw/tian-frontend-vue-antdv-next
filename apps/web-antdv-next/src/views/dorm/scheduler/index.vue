<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { DormApi } from '#/api/dorm';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import EventCalendar from '@event-calendar/core';
import Interaction from '@event-calendar/interaction';
import ResourceTimeline from '@event-calendar/resource-timeline';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Image,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Tag,
  Tooltip,
} from 'antdv-next';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

import {
  changeDormStayPeriod,
  getAreaSimpleList,
  getBuildInfo,
  getBuildSimpleList,
  getRoomAllocationHistory,
  getRoomAllocationWorkbench,
  transferDormBed,
} from '#/api/dorm';

import {
  getSingleDatePickerValue,
  type SingleDatePickerValue,
} from '../utils/date-picker';
import AllocationDrawer from './modules/allocation-drawer.vue';

import '@event-calendar/core/index.css';

dayjs.extend(utc);
dayjs.extend(timezone);

interface CalendarResource {
  id: string;
  title: string;
  extendedProps?: {
    bed?: DormApi.RoomAllocationBed;
    bedCount?: number;
    bedIndex?: number;
    collapsed?: boolean;
    floor?: number;
    kind: 'bed' | 'floor' | 'room';
    room?: DormApi.DormRoomInfo | DormApi.RoomAllocationRoom;
    roomCount?: number;
    roomFirst?: boolean;
    roomIndex?: number;
    roomLast?: boolean;
  };
}

interface CalendarEvent {
  backgroundColor: string;
  classNames: string[];
  durationEditable: boolean;
  editable: boolean;
  end: string;
  extendedProps: { subOrder: DormApi.DormSubOrder };
  id: string;
  resourceId: string;
  start: string;
  startEditable: boolean;
  textColor: string;
  title: string;
}

interface AllocationDrawerExpose {
  openAllocation: (
    guest: DormApi.PendingAllocationGuest,
    preset?: { bedId?: number; roomId?: number; startDate?: string },
  ) => Promise<void>;
}

interface CalendarPointInfo {
  date: Date;
  resource?: CalendarResource;
}

const CALENDAR_ROW_HEIGHT = 56;
const SLOT_WIDTH = 48;
const DRAG_SCROLL_EDGE = 64;
const DRAG_SCROLL_STEP = 18;
const CALENDAR_STATUS_CODES = [1, 3, 4] as const;

const STATUS_META: Record<
  number,
  { color: string; label: string; softColor: string; textColor: string }
> = {
  0: {
    color: '#d97706',
    label: '待分配',
    softColor: '#fef3c7',
    textColor: '#92400e',
  },
  1: {
    color: '#2563eb',
    label: '已排房',
    softColor: '#dbeafe',
    textColor: '#1e40af',
  },
  2: {
    color: '#94a3b8',
    label: '已取消',
    softColor: '#e2e8f0',
    textColor: '#475569',
  },
  3: {
    color: '#64748b',
    label: '已结算',
    softColor: '#e2e8f0',
    textColor: '#334155',
  },
  4: {
    color: '#475569',
    label: '已分摊',
    softColor: '#cbd5e1',
    textColor: '#1e293b',
  },
};

const ROOM_EVENT_PALETTE = [
  { softColor: '#dbeafe', textColor: '#1e3a8a' },
  { softColor: '#cffafe', textColor: '#164e63' },
  { softColor: '#d1fae5', textColor: '#064e3b' },
  { softColor: '#fef3c7', textColor: '#78350f' },
  { softColor: '#ffedd5', textColor: '#7c2d12' },
  { softColor: '#ffe4e6', textColor: '#881337' },
  { softColor: '#ede9fe', textColor: '#4c1d95' },
  { softColor: '#fae8ff', textColor: '#701a75' },
] as const;

const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();

const areas = ref<DormApi.DormArea[]>([]);
const selectedAreaId = ref<number>();
const buildings = ref<DormApi.DormBuilding[]>([]);
const selectedBuildId = ref<number>();
const selectedBuildInfo = ref<DormApi.DormBuildingInfo>();
const allocationWorkbench = ref<DormApi.RoomAllocationWorkbench>();
const rawEvents = ref<DormApi.DormSubOrder[]>([]);

const selectedFloorId = ref<number>();
const selectedStatus = ref<number>();
const roomKeyword = ref('');
const currentDate = ref(dayjs().startOf('month'));
const collapsedFloors = ref<Set<number>>(new Set());
const loading = ref(false);
const refreshing = ref(false);

const calendarRef = ref<HTMLElement | null>(null);
let calendarInstance: EventCalendar | null = null;

const detailOpen = ref(false);
const selectedOrder = ref<DormApi.DormSubOrder>();
const allocationHistory = ref<DormApi.RoomAllocationHistory[]>([]);
const historyLoading = ref(false);
const allocationDrawerRef = ref<AllocationDrawerExpose>();
const allocationPresetBedId = ref<number>();
const allocationPresetRoomId = ref<number>();
const allocationPresetStartDate = ref<string>();
const draggingGuest = ref<DormApi.PendingAllocationGuest>();
const pendingGuestKeyword = ref('');
const pendingPanelCollapsed = ref(false);
const transferOpen = ref(false);
const transferLoading = ref(false);
const transferSubmitting = ref(false);
const transferWorkbench = ref<DormApi.RoomAllocationWorkbench>();
const transferDate = ref('');
const transferRoomId = ref<number>();
const transferBedId = ref<number>();
const transferReason = ref('');
const periodChangeOpen = ref(false);
const periodChangeSubmitting = ref(false);
const periodChangeEndDate = ref('');
const periodChangeReason = ref('');
const TextArea = Input.TextArea;

const canManageSchedule = computed(() =>
  hasAccessByCodes(['dorm:room:update']),
);
const canViewPendingOrders = computed(
  () => canManageSchedule.value && hasAccessByCodes(['dorm:order:query']),
);

const currentArea = computed(() =>
  areas.value.find((area) => area.id === selectedAreaId.value),
);

const currentBuilding = computed(() =>
  buildings.value.find((building) => building.id === selectedBuildId.value),
);

const storeys = computed(() => selectedBuildInfo.value?.storeyBaseInfo ?? []);

const allRooms = computed(() =>
  storeys.value.flatMap((storey) =>
    (storey.roomBaseInfo ?? []).map((room) => ({
      ...room,
      floor: storey.floor,
      storeyId: storey.id,
    })),
  ),
);

const dateRange = computed(() => ({
  end: currentDate.value.add(1, 'month').startOf('month').format('YYYY-MM-DD'),
  start: currentDate.value.startOf('month').format('YYYY-MM-DD'),
}));
const areaTimezone = computed(
  () =>
    allocationWorkbench.value?.areaTimezone ||
    currentArea.value?.timeZone ||
    dayjs.tz.guess(),
);
const areaToday = computed(() =>
  dayjs().tz(areaTimezone.value).format('YYYY-MM-DD'),
);
const areaCurrentMonth = computed(() =>
  dayjs(`${areaToday.value.slice(0, 7)}-01`),
);
const pastDaysInWindow = computed(() =>
  Math.max(
    0,
    Math.min(
      currentDate.value.daysInMonth(),
      dayjs(areaToday.value).diff(currentDate.value.startOf('month'), 'day'),
    ),
  ),
);

const floorOptions = computed(() =>
  storeys.value.map((storey) => ({
    label: `${storey.floor} 层 · ${storey.roomBaseInfo?.length ?? 0} 间`,
    value: storey.id,
  })),
);

const statusOptions = CALENDAR_STATUS_CODES.map((status) => ({
  label: STATUS_META[status]!.label,
  value: status,
}));
const calendarLegend = CALENDAR_STATUS_CODES.map((status) => ({
  ...STATUS_META[status]!,
  status,
}));
const pendingGuestCount = computed(
  () => allocationWorkbench.value?.pendingGuests.length ?? 0,
);
const visiblePendingGuests = computed(() => {
  const keyword = pendingGuestKeyword.value.trim().toLocaleLowerCase();
  const guests = allocationWorkbench.value?.pendingGuests ?? [];
  if (!keyword) return guests;
  return guests.filter((guest) =>
    [guest.userName, guest.orderSerial, guest.requestGroupNo]
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLocaleLowerCase().includes(keyword)),
  );
});

const transferRooms = computed(() => transferWorkbench.value?.rooms ?? []);
const selectedTransferRoom = computed(() =>
  transferRooms.value.find((room) => room.id === transferRoomId.value),
);
const transferRoomOptions = computed(() =>
  transferRooms.value.map((room) => ({
    disabled: room.status !== 0,
    label: `${room.roomAlias || room.roomCode} · ${room.floor ?? '-'} 层${
      room.status === 0 ? '' : ' · 房间停用'
    }`,
    value: room.id,
  })),
);
const transferBedOptions = computed(() =>
  (selectedTransferRoom.value?.beds ?? []).map((bed) => ({
    disabled: bed.status !== 0 || bed.assignments.length > 0,
    label:
      bed.assignments.length > 0
        ? `${bed.bedCode} · 已占用`
        : `${bed.bedCode} · 可用`,
    value: bed.id,
  })),
);
const canSubmitTransfer = computed(
  () =>
    selectedOrder.value &&
    transferDate.value &&
    transferRoomId.value &&
    transferBedId.value &&
    transferReason.value.trim(),
);
const canSubmitPeriodChange = computed(
  () =>
    selectedOrder.value &&
    periodChangeEndDate.value &&
    dayjs(
      selectedOrder.value.plannedStartTime || selectedOrder.value.startTime,
    ).isBefore(dayjs(periodChangeEndDate.value)) &&
    periodChangeReason.value.trim(),
);

const calendarResources = computed<CalendarResource[]>(() => {
  const keyword = roomKeyword.value.trim().toLocaleLowerCase();
  const selectedFloor = storeys.value.find(
    (storey) => storey.id === selectedFloorId.value,
  )?.floor;
  const roomsByFloor = new Map<number, DormApi.RoomAllocationRoom[]>();
  for (const room of allocationWorkbench.value?.rooms ?? []) {
    if (selectedFloor !== undefined && room.floor !== selectedFloor) continue;
    if (
      keyword &&
      ![room.roomAlias, room.roomCode]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(keyword))
    ) {
      continue;
    }
    const floorRooms = roomsByFloor.get(room.floor ?? 0) ?? [];
    floorRooms.push(room);
    roomsByFloor.set(room.floor ?? 0, floorRooms);
  }

  const resources: CalendarResource[] = [];
  for (const [floor, floorRooms] of [...roomsByFloor.entries()].toSorted(
    ([left], [right]) => left - right,
  )) {
    const sortedRooms = floorRooms.toSorted((left, right) =>
      String(left.roomCode || left.roomAlias || '').localeCompare(
        String(right.roomCode || right.roomAlias || ''),
      ),
    );
    const collapsed = collapsedFloors.value.has(floor);
    resources.push({
      id: `floor-${floor}`,
      title: `${floor}F 楼层`,
      extendedProps: {
        bedCount: sortedRooms.reduce(
          (total, room) => total + room.beds.length,
          0,
        ),
        collapsed,
        floor,
        kind: 'floor',
        roomCount: sortedRooms.length,
      },
    });
    if (collapsed) continue;

    resources.push(
      ...sortedRooms.flatMap((room, roomIndex) =>
        room.beds.map((bed, bedIndex) => ({
          id: `bed-${bed.id}`,
          title: bed.bedCode,
          extendedProps: {
            bed,
            bedCount: room.beds.length,
            bedIndex,
            floor,
            kind: 'bed' as const,
            room,
            roomFirst: bedIndex === 0,
            roomIndex,
            roomLast: bedIndex === room.beds.length - 1,
          },
        })),
      ),
    );
  }
  return resources;
});

const visibleBedIds = computed(
  () => new Set(calendarResources.value.map((resource) => resource.id)),
);

function getRoomEventColor(roomId?: number, bedId?: number) {
  const colorKey = Math.abs(Number(roomId ?? bedId ?? 0));
  return ROOM_EVENT_PALETTE[colorKey % ROOM_EVENT_PALETTE.length]!;
}

const calendarEvents = computed<CalendarEvent[]>(() =>
  rawEvents.value
    .filter(
      (order) =>
        visibleBedIds.value.has(`bed-${order.bedId}`) &&
        (selectedStatus.value === undefined ||
          order.status === selectedStatus.value),
    )
    .map((order) => {
      const roomColor = getRoomEventColor(order.roomId, order.bedId);
      const start = order.startTime || currentDate.value.format('YYYY-MM-DD');
      const end =
        order.endTime || dayjs(start).add(1, 'day').format('YYYY-MM-DD');
      const editable = canManageSchedule.value && order.status === 1;
      return {
        classNames: [
          `calendar-event--status-${order.status ?? 0}`,
          ...(dayjs(end).isAfter(dayjs(areaToday.value), 'day')
            ? []
            : ['calendar-event--history']),
          ...(order.status === 1 ? [] : ['calendar-event--locked']),
        ],
        id: String(order.id),
        resourceId: `bed-${order.bedId}`,
        title: order.userName || '未填写住客',
        start,
        end,
        extendedProps: { subOrder: order },
        backgroundColor: roomColor.softColor,
        textColor: roomColor.textColor,
        durationEditable: false,
        editable,
        startEditable: editable,
      };
    }),
);

const totalCapacity = computed(() =>
  (allocationWorkbench.value?.rooms ?? [])
    .filter((room) => room.status === 0)
    .reduce(
      (total, room) =>
        total + room.beds.filter((bed) => bed.status === 0).length,
      0,
    ),
);

const currentGuestCount = computed(() =>
  (allocationWorkbench.value?.rooms ?? [])
    .filter((room) => room.status === 0)
    .reduce(
      (total, room) =>
        total +
        room.beds.filter(
          (bed) =>
            bed.status === 0 &&
            bed.assignments.some(
              (assignment) =>
                !dayjs(areaToday.value).isBefore(
                  dayjs(assignment.startDate),
                  'day',
                ) &&
                dayjs(areaToday.value).isBefore(
                  dayjs(assignment.endDate),
                  'day',
                ),
            ),
        ).length,
      0,
    ),
);

const availableBedCount = computed(() =>
  Math.max(0, totalCapacity.value - currentGuestCount.value),
);

const activeBookingCount = computed(
  () => rawEvents.value.filter((order) => order.status !== 2).length,
);

const occupancyRate = computed(() => {
  if (totalCapacity.value === 0) return 0;

  const monthStart = currentDate.value.startOf('month');
  const monthEnd = currentDate.value.add(1, 'month').startOf('month');
  let occupiedRoomDays = 0;
  for (const order of rawEvents.value) {
    if (order.status === 2 || !order.startTime || !order.endTime) continue;
    const start = dayjs(order.startTime).isAfter(monthStart)
      ? dayjs(order.startTime)
      : monthStart;
    const end = dayjs(order.endTime).isBefore(monthEnd)
      ? dayjs(order.endTime)
      : monthEnd;
    occupiedRoomDays += Math.max(
      0,
      end.startOf('day').diff(start.startOf('day'), 'day'),
    );
  }
  const availableRoomDays =
    totalCapacity.value * currentDate.value.daysInMonth();

  return Math.min(
    100,
    Math.round((occupiedRoomDays / availableRoomDays) * 100),
  );
});

const statCards = computed(() => [
  {
    accent: '#2563eb',
    icon: 'lucide:door-open',
    label: '房间总数',
    note: `${storeys.value.length} 个楼层`,
    suffix: '间',
    value: allRooms.value.length,
  },
  {
    accent: '#059669',
    icon: 'lucide:bed-single',
    label: '可用床位',
    note: `启用床位 ${totalCapacity.value}`,
    suffix: '个',
    value: availableBedCount.value,
  },
  {
    accent: '#d97706',
    icon: 'lucide:calendar-check-2',
    label: '本月排房',
    note: `${currentDate.value.format('M 月')}有效安排`,
    suffix: '单',
    value: activeBookingCount.value,
  },
  {
    accent: '#7c3aed',
    icon: 'lucide:gauge',
    label: '房间利用率',
    note: '按占用间夜估算',
    suffix: '%',
    value: occupancyRate.value,
  },
]);

function getStatusMeta(status?: number) {
  return (
    STATUS_META[status ?? -1] ?? {
      color: '#64748b',
      label: '未知状态',
      softColor: '#e2e8f0',
      textColor: '#334155',
    }
  );
}

function getOperationTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    CANCEL: '取消安排',
    CORRECTION: '管理员纠错',
    INITIAL: '首次排房',
    PERIOD_ADJUST: '住宿期变更',
    TRANSFER: '调房',
  };
  return labels[type || ''] || type || '排房操作';
}

function getRoomTypeLabel(roomType?: number) {
  if (roomType === 1) return '单人间';
  if (roomType === 2) return '多人间';
  return '未设置房型';
}

function getRequestedRoomTypeLabel(roomType?: number) {
  if (roomType === 1) return '偏好单人间';
  if (roomType === 2) return '偏好多床间';
  return '房型不限';
}

function getOrderRoom(order?: DormApi.DormSubOrder) {
  if (!order) return undefined;
  return allRooms.value.find((room) => room.id === order.roomId);
}

function getOrderDays(order?: DormApi.DormSubOrder) {
  if (!order?.startTime || !order.endTime) return order?.days ?? 0;
  return Math.max(1, dayjs(order.endTime).diff(dayjs(order.startTime), 'day'));
}

function formatWeekday(value?: string) {
  if (!value) return '-';
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
    dayjs(value).day()
  ];
}

function renderResourceLabel({ resource }: any) {
  const props = resource.extendedProps ?? {};
  const wrapper = document.createElement('div');
  if (props.kind === 'floor') {
    wrapper.className = 'calendar-floor-row';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'calendar-floor-toggle';
    toggle.setAttribute('aria-expanded', String(!props.collapsed));
    toggle.setAttribute(
      'aria-label',
      `${props.collapsed ? '展开' : '收起'} ${props.floor}F 楼层`,
    );

    const chevron = document.createElement('span');
    chevron.className = [
      'calendar-floor-toggle__chevron',
      props.collapsed
        ? 'calendar-floor-toggle__chevron--collapsed'
        : 'calendar-floor-toggle__chevron--expanded',
    ].join(' ');
    chevron.setAttribute('aria-hidden', 'true');
    const chevronIcon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    chevronIcon.setAttribute('class', 'calendar-floor-toggle__icon');
    chevronIcon.setAttribute('viewBox', '0 0 24 24');
    chevronIcon.setAttribute('fill', 'none');
    chevronIcon.setAttribute('stroke', 'currentColor');
    chevronIcon.setAttribute('stroke-width', '2');
    chevronIcon.setAttribute('stroke-linecap', 'round');
    chevronIcon.setAttribute('stroke-linejoin', 'round');
    const chevronPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    chevronPath.setAttribute(
      'd',
      props.collapsed ? 'm9 18 6-6-6-6' : 'm6 9 6 6 6-6',
    );
    chevronIcon.append(chevronPath);
    chevron.append(chevronIcon);
    const title = document.createElement('strong');
    title.textContent = `${props.floor}F 楼层`;
    const meta = document.createElement('span');
    meta.className = 'calendar-floor-toggle__meta';
    meta.textContent = `${props.roomCount ?? 0} 间 · ${props.bedCount ?? 0} 床`;
    toggle.append(chevron, title, meta);
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFloor(Number(props.floor));
    });
    wrapper.append(toggle);
    return { domNodes: [wrapper] };
  }

  const room = props.room as DormApi.RoomAllocationRoom | undefined;
  const bed = props.bed as DormApi.RoomAllocationBed | undefined;
  wrapper.className = [
    'calendar-resource-row',
    props.roomFirst ? 'calendar-resource-row--first' : '',
    props.roomLast ? 'calendar-resource-row--last' : '',
    Number(props.roomIndex ?? 0) % 2 === 0 ? 'calendar-resource-row--even' : '',
  ]
    .filter(Boolean)
    .join(' ');
  wrapper.style.setProperty(
    '--room-row-span',
    String(Math.max(1, Number(props.bedCount) || 1)),
  );
  const roomCell = document.createElement('div');
  roomCell.className = props.roomFirst
    ? 'calendar-room-cell calendar-room-cell--primary'
    : 'calendar-room-cell calendar-room-cell--continuation';

  if (props.roomFirst && room) {
    const roomTop = document.createElement('div');
    roomTop.className = 'calendar-room-cell__top';
    const title = document.createElement('strong');
    title.textContent = room.roomAlias || room.roomCode || `房间 ${room.id}`;
    roomTop.append(title);

    const meta = document.createElement('span');
    meta.className = 'calendar-room-cell__meta';
    meta.textContent = `${getRoomTypeLabel(room.roomType)} · ${room.beds.length} 个床位`;
    roomCell.append(roomTop, meta);
  } else {
    roomCell.setAttribute('aria-hidden', 'true');
  }
  wrapper.append(roomCell);

  const bedCell = document.createElement('div');
  bedCell.className = 'calendar-bed-slot';
  const bedIcon = document.createElement('span');
  bedIcon.className = 'calendar-bed-slot__icon';
  bedIcon.textContent = '床';
  const bedInfo = document.createElement('div');
  bedInfo.className = 'calendar-bed-slot__info';
  const bedTitle = document.createElement('strong');
  bedTitle.textContent = bed?.bedCode || resource.title;
  const bedMeta = document.createElement('span');
  const bedAvailable = room?.status === 0 && bed?.status === 0;
  bedMeta.className = bedAvailable ? 'is-enabled' : 'is-disabled';
  let bedStatusLabel = '已启用';
  if (room?.status !== 0) bedStatusLabel = '房间停用';
  else if (bed?.status !== 0) bedStatusLabel = '床位停用';
  bedMeta.textContent = bedStatusLabel;
  bedInfo.append(bedTitle, bedMeta);
  bedCell.append(bedIcon, bedInfo);
  wrapper.append(bedCell);
  return { domNodes: [wrapper] };
}

function toggleFloor(floor: number) {
  const next = new Set(collapsedFloors.value);
  if (next.has(floor)) next.delete(floor);
  else next.add(floor);
  collapsedFloors.value = next;
}

function renderEventContent({ event }: any) {
  const order = event.extendedProps?.subOrder as
    | DormApi.DormSubOrder
    | undefined;
  const wrapper = document.createElement('div');
  wrapper.className = 'calendar-event-content';
  const start = dayjs(order?.startTime);
  const end = dayjs(order?.endTime);
  const totalDays = Math.max(1, end.diff(start, 'day'));
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, dayjs(areaToday.value).diff(start, 'day')),
  );
  wrapper.style.setProperty(
    '--history-ratio',
    `${(elapsedDays / totalDays) * 100}%`,
  );

  const guest = document.createElement('strong');
  guest.textContent = order?.userName || '未填写住客';
  const days = document.createElement('span');
  days.textContent =
    (order?.status ?? 0) >= 3
      ? `🔒 ${getStatusMeta(order?.status).label}`
      : `${getOrderDays(order)} 天`;
  wrapper.append(guest, days);

  return { domNodes: [wrapper] };
}

function updateCalendarOptions() {
  if (!calendarInstance) return;
  calendarInstance.setOption('resources', calendarResources.value);
  calendarInstance.setOption('events', calendarEvents.value);
  calendarInstance.setOption('highlightedDates', [areaToday.value]);
}

function getCalendarScrollElement() {
  return calendarRef.value?.querySelector<HTMLElement>('.ec-main') ?? null;
}

function applyAllocationWorkbench(data: DormApi.RoomAllocationWorkbench) {
  allocationWorkbench.value = data;
  rawEvents.value = data.rooms.flatMap((room) =>
    room.beds.flatMap((bed) =>
      bed.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        bedId: bed.id,
        days: Math.max(
          1,
          dayjs(assignment.endDate).diff(dayjs(assignment.startDate), 'day'),
        ),
        endTime: assignment.endDate,
        guestVersion: assignment.guestVersion,
        id: assignment.guestId,
        operationType: assignment.operationType,
        orderSerial: assignment.orderSerial,
        plannedEndTime: assignment.plannedEndDate,
        plannedStartTime: assignment.plannedStartDate,
        remark: assignment.remark || assignment.changeReason,
        roomId: room.id,
        startTime: assignment.startDate,
        status: assignment.orderStatus ?? assignment.guestStatus ?? 0,
        subOrderSerial: '',
        userId: 0,
        userName: assignment.guestName,
      })),
    ),
  );
}

async function fetchCalendarEvents() {
  if (!selectedBuildId.value) {
    allocationWorkbench.value = undefined;
    rawEvents.value = [];
    updateCalendarOptions();
    return;
  }

  applyAllocationWorkbench(
    await getRoomAllocationWorkbench({
      buildId: selectedBuildId.value,
      endDate: dateRange.value.end,
      startDate: dateRange.value.start,
    }),
  );
  updateCalendarOptions();
}

async function loadBuildingData() {
  if (!selectedBuildId.value) {
    selectedBuildInfo.value = undefined;
    allocationWorkbench.value = undefined;
    rawEvents.value = [];
    updateCalendarOptions();
    return;
  }

  loading.value = true;
  selectedFloorId.value = undefined;
  try {
    const [buildingInfo, workbenchData] = await Promise.all([
      getBuildInfo(selectedBuildId.value),
      getRoomAllocationWorkbench({
        buildId: selectedBuildId.value,
        endDate: dateRange.value.end,
        startDate: dateRange.value.start,
      }),
    ]);
    selectedBuildInfo.value = buildingInfo;
    applyAllocationWorkbench(workbenchData);
    updateCalendarOptions();
  } finally {
    loading.value = false;
  }
}

async function findInitialBuilding(buildId?: number) {
  const routeAreaId = route.query.areaId
    ? Number(route.query.areaId)
    : undefined;
  const preferredArea =
    areas.value.find((area) => area.id === routeAreaId) ?? areas.value[0];

  if (!preferredArea?.id) return;

  const orderedAreas = [
    preferredArea,
    ...areas.value.filter((area) => area.id !== preferredArea.id),
  ];

  for (const area of orderedAreas) {
    if (!area.id) continue;
    const areaBuildings = await getBuildSimpleList(area.id);
    const matchedBuilding = buildId
      ? areaBuildings.find((building) => building.id === buildId)
      : areaBuildings[0];

    if (matchedBuilding?.id) {
      selectedAreaId.value = area.id;
      buildings.value = areaBuildings;
      selectedBuildId.value = matchedBuilding.id;
      return;
    }
  }

  selectedAreaId.value = preferredArea.id;
  buildings.value = await getBuildSimpleList(preferredArea.id);
  selectedBuildId.value = buildings.value[0]?.id;
}

async function loadInitialData() {
  loading.value = true;
  try {
    areas.value = await getAreaSimpleList();
    const routeBuildId = route.query.buildId
      ? Number(route.query.buildId)
      : undefined;
    await findInitialBuilding(routeBuildId);
    currentDate.value = areaCurrentMonth.value;

    if (selectedBuildId.value) {
      const [buildingInfo, workbenchData] = await Promise.all([
        getBuildInfo(selectedBuildId.value),
        getRoomAllocationWorkbench({
          buildId: selectedBuildId.value,
          endDate: dateRange.value.end,
          startDate: dateRange.value.start,
        }),
      ]);
      selectedBuildInfo.value = buildingInfo;
      applyAllocationWorkbench(workbenchData);
    }
  } finally {
    loading.value = false;
  }
}

function initCalendar() {
  if (!calendarRef.value) return;

  calendarInstance = new EventCalendar({
    target: calendarRef.value,
    props: {
      plugins: [ResourceTimeline, Interaction],
      options: {
        view: 'resourceTimelineMonth',
        date: currentDate.value.startOf('month').toDate(),
        duration: { days: currentDate.value.daysInMonth() },
        firstDay: 1,
        locale: 'zh-CN',
        resources: calendarResources.value,
        events: calendarEvents.value,
        headerToolbar: { start: '', center: '', end: '' },
        dayHeaderFormat: { day: 'numeric' },
        height: 'auto',
        highlightedDates: [areaToday.value],
        slotDuration: { days: 1 },
        slotWidth: SLOT_WIDTH,
        slotHeight: CALENDAR_ROW_HEIGHT,
        editable: canManageSchedule.value,
        selectable: false,
        eventContent: renderEventContent,
        resourceLabelContent: renderResourceLabel,
        eventDrop: handleEventDrop,
        eventResize: handleEventResize,
        dateClick: handleSlotSelect,
        eventClick: handleEventClick,
        nowIndicator: true,
      },
    },
  });
  requestAnimationFrame(() => {
    const scrollElement = getCalendarScrollElement();
    if (scrollElement) scrollElement.scrollLeft = 0;
  });
}

async function handleAreaChange(value: unknown) {
  const areaId = Number(value);
  if (!Number.isFinite(areaId)) return;
  selectedAreaId.value = areaId;
  selectedBuildInfo.value = undefined;
  allocationWorkbench.value = undefined;
  selectedFloorId.value = undefined;
  collapsedFloors.value = new Set();
  rawEvents.value = [];
  loading.value = true;
  try {
    buildings.value = await getBuildSimpleList(areaId);
    selectedBuildId.value = buildings.value[0]?.id;
  } finally {
    loading.value = false;
  }
  await loadBuildingData();
}

async function handleBuildingChange(value: unknown) {
  const buildId = Number(value);
  if (!Number.isFinite(buildId)) return;
  selectedBuildId.value = buildId;
  roomKeyword.value = '';
  selectedStatus.value = undefined;
  collapsedFloors.value = new Set();
  await loadBuildingData();
}

async function handleMonthChange(value: SingleDatePickerValue) {
  const selectedDate = getSingleDatePickerValue(value);
  if (!selectedDate) return;
  currentDate.value = selectedDate.startOf('month');
  calendarInstance?.setOption('date', currentDate.value.toDate());
  calendarInstance?.setOption('duration', {
    days: currentDate.value.daysInMonth(),
  });
  loading.value = true;
  try {
    await fetchCalendarEvents();
    await nextTick();
    requestAnimationFrame(() => {
      const scrollElement = getCalendarScrollElement();
      if (scrollElement) scrollElement.scrollLeft = 0;
    });
  } finally {
    loading.value = false;
  }
}

async function changeMonth(offset: number) {
  await handleMonthChange(currentDate.value.add(offset, 'month'));
}

async function goToCurrentMonth() {
  await handleMonthChange(areaCurrentMonth.value);
}

async function refreshCalendarEvents() {
  refreshing.value = true;
  try {
    await fetchCalendarEvents();
    message.success('排房数据已刷新');
  } finally {
    refreshing.value = false;
  }
}

function confirmScheduleChange(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确认调整',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

async function handleEventDrop({ event, oldEvent, newResource, revert }: any) {
  if (!canManageSchedule.value) {
    revert?.();
    return;
  }

  const order = event.extendedProps?.subOrder as
    | DormApi.DormSubOrder
    | undefined;
  if (!order) {
    revert?.();
    return;
  }
  if (order.status !== 1) {
    let warning = '该住宿人尚未完成首次排房';
    if ((order.status ?? 0) >= 3)
      warning = '该订单已结算或已分摊，不能再拖动调房';
    else if (order.status === 2) warning = '该订单已取消，排房记录仅供查看';
    message.warning(warning);
    revert?.();
    return;
  }

  const resourceProps = newResource?.extendedProps;
  const targetBed = resourceProps?.bed as DormApi.RoomAllocationBed | undefined;
  const targetRoom = resourceProps?.room as
    | DormApi.RoomAllocationRoom
    | undefined;
  if (resourceProps?.kind !== 'bed' || !targetBed || !targetRoom) {
    message.warning('只能将住宿人拖动到具体床位');
    revert?.();
    return;
  }
  if (targetBed.id === order.bedId) {
    message.info('已排房日期不能直接拖动，请使用日期变更流程');
    revert?.();
    return;
  }
  const confirmed = await confirmScheduleChange(
    '确认整段调房？',
    `${order.userName || '该住客'}将从入住首日开始调整至「${
      targetRoom.roomAlias || targetRoom.roomCode
    } / ${targetBed.bedCode}」，原床位历史会保留。`,
  );

  if (!confirmed) {
    revert?.();
    return;
  }

  try {
    await transferDormBed({
      effectiveDate: dayjs(oldEvent.start || order.startTime).format(
        'YYYY-MM-DD',
      ),
      guestId: order.id,
      operationNo: `TRANSFER-${order.id}-${Date.now()}`,
      reason: '排房日历拖拽调房',
      targetBedId: targetBed.id,
      targetRoomId: targetRoom.id,
      version: order.guestVersion,
    });
    message.success('调房完成');
    await fetchCalendarEvents();
  } catch {
    revert?.();
    await fetchCalendarEvents();
  }
}

async function handleEventResize({ event, revert }: any) {
  if (!canManageSchedule.value) {
    revert?.();
    return;
  }

  const order = event.extendedProps?.subOrder as
    | DormApi.DormSubOrder
    | undefined;
  if (!order) {
    revert?.();
    return;
  }

  message.info('首次排房可调整审批日期；已排房记录请走日期变更流程');
  revert?.();
}

function handleSlotSelect({ date, resource, start }: any) {
  if (
    !canViewPendingOrders.value ||
    !resource?.id ||
    resource.extendedProps?.kind !== 'bed'
  ) {
    return;
  }
  const room = resource.extendedProps?.room as
    | DormApi.RoomAllocationRoom
    | undefined;
  const bed = resource.extendedProps?.bed as
    | DormApi.RoomAllocationBed
    | undefined;
  if (room?.status !== 0 || bed?.status !== 0) {
    message.warning(
      room?.status === 0 ? '该床位当前已停用' : '该房间当前已停用',
    );
    return;
  }
  allocationPresetRoomId.value = Number(resource.extendedProps?.room?.id);
  allocationPresetBedId.value = Number(resource.extendedProps?.bed?.id);
  allocationPresetStartDate.value =
    start || date ? dayjs(start || date).format('YYYY-MM-DD') : undefined;
  pendingPanelCollapsed.value = false;
}

function openPendingOrders() {
  allocationPresetRoomId.value = undefined;
  allocationPresetBedId.value = undefined;
  allocationPresetStartDate.value = undefined;
  pendingPanelCollapsed.value = !pendingPanelCollapsed.value;
}

async function openPendingGuestAllocation(
  guest: DormApi.PendingAllocationGuest,
) {
  await allocationDrawerRef.value?.openAllocation(guest, {
    bedId: allocationPresetBedId.value,
    roomId: allocationPresetRoomId.value,
    startDate: allocationPresetStartDate.value,
  });
}

function startPendingGuestDrag(
  guest: DormApi.PendingAllocationGuest,
  event: DragEvent,
) {
  event.dataTransfer?.setData('application/x-dorm-guest-id', String(guest.id));
  event.dataTransfer?.setData('text/plain', String(guest.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  handleCandidateDragStart(guest);
}

function handleCandidateDragOver(event: DragEvent) {
  if (!canViewPendingOrders.value || !calendarInstance) return;
  const point = (
    calendarInstance as EventCalendar & {
      dateFromPoint: (x: number, y: number) => CalendarPointInfo | null;
    }
  ).dateFromPoint(event.clientX, event.clientY);
  if (point?.resource?.extendedProps?.kind !== 'bed') {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';

  const scrollElement = getCalendarScrollElement();
  if (!scrollElement) return;
  const scrollRect = scrollElement.getBoundingClientRect();
  const drawerLeft = document
    .querySelector<HTMLElement>('.ant-drawer-open .ant-drawer-content-wrapper')
    ?.getBoundingClientRect().left;
  const visibleRight = drawerLeft
    ? Math.min(scrollRect.right, drawerLeft)
    : scrollRect.right;
  let left = 0;
  let top = 0;
  if (event.clientX < scrollRect.left + DRAG_SCROLL_EDGE)
    left = -DRAG_SCROLL_STEP;
  else if (event.clientX > visibleRight - DRAG_SCROLL_EDGE)
    left = DRAG_SCROLL_STEP;
  if (event.clientY < scrollRect.top + DRAG_SCROLL_EDGE)
    top = -DRAG_SCROLL_STEP;
  else if (event.clientY > scrollRect.bottom - DRAG_SCROLL_EDGE)
    top = DRAG_SCROLL_STEP;
  if (left || top) scrollElement.scrollBy({ behavior: 'auto', left, top });
}

function handleCandidateDragStart(guest: DormApi.PendingAllocationGuest) {
  draggingGuest.value = guest;
}

function handleCandidateDragEnd() {
  draggingGuest.value = undefined;
}

async function handleCandidateDrop(event: DragEvent) {
  if (!canViewPendingOrders.value || !calendarInstance) return;
  event.preventDefault();
  draggingGuest.value = undefined;
  const guestId = Number(
    event.dataTransfer?.getData('application/x-dorm-guest-id') ||
      event.dataTransfer?.getData('text/plain'),
  );
  const guest = allocationWorkbench.value?.pendingGuests.find(
    (item) => item.id === guestId,
  );
  const point = (
    calendarInstance as EventCalendar & {
      dateFromPoint: (x: number, y: number) => CalendarPointInfo | null;
    }
  ).dateFromPoint(event.clientX, event.clientY);
  const resourceProps = point?.resource?.extendedProps;
  const room = resourceProps?.room as DormApi.RoomAllocationRoom | undefined;
  const bed = resourceProps?.bed as DormApi.RoomAllocationBed | undefined;
  if (!point || !guest || resourceProps?.kind !== 'bed' || !room || !bed) {
    message.warning('请将待分配人员放到具体床位和日期上');
    return;
  }
  if (room.status !== 0 || bed.status !== 0) {
    message.warning('该房间或床位当前不可排');
    return;
  }
  const originalStart = guest.plannedStartDate || guest.approvedStartDate;
  const originalEnd = guest.plannedEndDate || guest.approvedEndDate;
  const droppedStart = dayjs(point.date);
  const nights = Math.max(
    1,
    dayjs(originalEnd).diff(dayjs(originalStart), 'day'),
  );
  const droppedEnd = droppedStart.add(nights, 'day');
  const occupied = bed.assignments.some(
    (assignment) =>
      dayjs(assignment.startDate).isBefore(droppedEnd) &&
      dayjs(assignment.endDate).isAfter(droppedStart),
  );
  if (occupied) {
    message.warning('该床位在住宿人的计划时段内已被占用');
    return;
  }
  allocationPresetRoomId.value = room.id;
  allocationPresetBedId.value = bed.id;
  allocationPresetStartDate.value = droppedStart.format('YYYY-MM-DD');
  await nextTick();
  await allocationDrawerRef.value?.openAllocation(guest, {
    bedId: bed.id,
    roomId: room.id,
    startDate: allocationPresetStartDate.value,
  });
}

async function handleAllocationSuccess() {
  await loadBuildingData();
}

async function handleEventClick({ event }: any) {
  const order = event.extendedProps?.subOrder as
    | DormApi.DormSubOrder
    | undefined;
  if (!order) return;
  selectedOrder.value = order;
  allocationHistory.value = [];
  detailOpen.value = true;
  historyLoading.value = true;
  try {
    allocationHistory.value = await getRoomAllocationHistory(order.id);
  } finally {
    historyLoading.value = false;
  }
}

function openOrderDetail() {
  if (!selectedOrder.value?.orderSerial) return;
  detailOpen.value = false;
  router.push(`/dorm/order/${selectedOrder.value.orderSerial}`);
}

async function loadTransferAvailability() {
  if (
    !selectedBuildId.value ||
    !selectedOrder.value?.endTime ||
    !transferDate.value
  ) {
    return;
  }
  transferLoading.value = true;
  try {
    transferWorkbench.value = await getRoomAllocationWorkbench({
      buildId: selectedBuildId.value,
      endDate: dayjs(selectedOrder.value.endTime).format('YYYY-MM-DD'),
      startDate: transferDate.value,
    });
    if (
      transferRoomId.value &&
      !transferRooms.value.some((room) => room.id === transferRoomId.value)
    ) {
      transferRoomId.value = undefined;
      transferBedId.value = undefined;
    }
  } finally {
    transferLoading.value = false;
  }
}

async function openTransferDialog() {
  if (!selectedOrder.value?.startTime || !selectedOrder.value.endTime) return;
  transferDate.value = dayjs(selectedOrder.value.startTime).format(
    'YYYY-MM-DD',
  );
  transferRoomId.value = undefined;
  transferBedId.value = undefined;
  transferReason.value = '';
  transferOpen.value = true;
  await loadTransferAvailability();
}

function openPeriodChangeDialog() {
  if (!selectedOrder.value) return;
  periodChangeEndDate.value =
    selectedOrder.value.plannedEndTime || selectedOrder.value.endTime || '';
  periodChangeReason.value = '';
  periodChangeOpen.value = true;
}

function disablePeriodChangeEndDate(value: Dayjs) {
  const start =
    selectedOrder.value?.plannedStartTime || selectedOrder.value?.startTime;
  return !start || !value.isAfter(dayjs(start), 'day');
}

function handlePeriodChangeEndDate(value: SingleDatePickerValue) {
  periodChangeEndDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
}

async function submitPeriodChange() {
  const order = selectedOrder.value;
  if (!order || !periodChangeEndDate.value || !canSubmitPeriodChange.value) {
    message.warning('请填写有效的退宿日期和变更原因');
    return;
  }
  periodChangeSubmitting.value = true;
  try {
    await changeDormStayPeriod({
      endDate: periodChangeEndDate.value,
      guestId: order.id,
      operationNo: `PERIOD-${order.id}-${Date.now()}`,
      reason: periodChangeReason.value.trim(),
      version: order.guestVersion,
    });
    message.success('住宿期已更新，床位安排已同步');
    periodChangeOpen.value = false;
    detailOpen.value = false;
    await fetchCalendarEvents();
  } finally {
    periodChangeSubmitting.value = false;
  }
}

function disableTransferDate(value: Dayjs) {
  if (!selectedOrder.value?.startTime || !selectedOrder.value.endTime) {
    return true;
  }
  return (
    value.isBefore(dayjs(selectedOrder.value.startTime), 'day') ||
    !value.isBefore(dayjs(selectedOrder.value.endTime), 'day')
  );
}

async function handleTransferDateChange(value: SingleDatePickerValue) {
  transferDate.value =
    getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
  transferBedId.value = undefined;
  await loadTransferAvailability();
}

function handleTransferRoomChange() {
  transferBedId.value = undefined;
}

async function submitTransfer() {
  const order = selectedOrder.value;
  if (
    !order ||
    !transferDate.value ||
    !transferRoomId.value ||
    !transferBedId.value ||
    !canSubmitTransfer.value
  ) {
    message.warning('请完整填写调房生效日期、目标床位和原因');
    return;
  }
  transferSubmitting.value = true;
  try {
    await transferDormBed({
      effectiveDate: transferDate.value,
      guestId: order.id,
      operationNo: `TRANSFER-${order.id}-${Date.now()}`,
      reason: transferReason.value.trim(),
      targetBedId: transferBedId.value,
      targetRoomId: transferRoomId.value,
      version: order.guestVersion,
    });
    message.success('调房完成，原床位历史已保留');
    transferOpen.value = false;
    detailOpen.value = false;
    await fetchCalendarEvents();
  } finally {
    transferSubmitting.value = false;
  }
}

watch([calendarResources, selectedStatus, areaToday], updateCalendarOptions);

onMounted(async () => {
  await loadInitialData();
  await nextTick();
  initCalendar();
});

onBeforeUnmount(() => {
  calendarInstance?.destroy();
  calendarInstance = null;
});
</script>

<template>
  <Page auto-content-height>
    <AllocationDrawer
      ref="allocationDrawerRef"
      :open="Boolean(selectedBuildId)"
      :build-id="selectedBuildId"
      :start-date="dateRange.start"
      :end-date="dateRange.end"
      list-mode="hidden"
      :preset-bed-id="allocationPresetBedId"
      :preset-room-id="allocationPresetRoomId"
      :preset-start-date="allocationPresetStartDate"
      @success="handleAllocationSuccess"
    />

    <Drawer
      v-model:open="detailOpen"
      title="排房详情"
      width="440"
      :body-style="{ padding: '20px 24px' }"
    >
      <div v-if="selectedOrder" class="schedule-detail">
        <div class="schedule-detail__hero">
          <div class="schedule-detail__avatar">
            {{ (selectedOrder.userName || '住').slice(0, 1).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <div class="text-foreground truncate text-lg font-semibold">
              {{ selectedOrder.userName || '未填写住客' }}
            </div>
            <div class="text-muted-foreground mt-1 text-sm">
              {{ getOrderRoom(selectedOrder)?.roomAlias || '未知房间' }}
              · {{ getOrderDays(selectedOrder) }} 天
            </div>
          </div>
          <Tag
            :color="getStatusMeta(selectedOrder.status).color"
            class="ml-auto"
          >
            {{ getStatusMeta(selectedOrder.status).label }}
          </Tag>
        </div>

        <div class="schedule-detail__actions" aria-label="排房操作">
          <Button
            v-if="canManageSchedule && selectedOrder.status === 1"
            class="schedule-detail__action"
            @click="openPeriodChangeDialog"
          >
            <IconifyIcon icon="lucide:calendar-range" />
            延期 / 提前退宿
          </Button>
          <Button
            v-if="canManageSchedule && selectedOrder.status === 1"
            class="schedule-detail__action"
            @click="openTransferDialog"
          >
            <IconifyIcon icon="lucide:bed-double" />
            调房
          </Button>
          <Button
            type="primary"
            class="schedule-detail__action"
            @click="openOrderDetail"
          >
            <IconifyIcon icon="lucide:arrow-up-right" />
            查看订单
          </Button>
        </div>

        <div class="schedule-detail__period">
          <div>
            <span>入住</span>
            <strong>{{
              dayjs(selectedOrder.startTime).format('YYYY-MM-DD')
            }}</strong>
            <small>{{ formatWeekday(selectedOrder.startTime) }}</small>
          </div>
          <div class="schedule-detail__period-line">
            <span>{{ getOrderDays(selectedOrder) }} 晚</span>
          </div>
          <div class="text-right">
            <span>退宿</span>
            <strong>{{
              dayjs(selectedOrder.endTime).format('YYYY-MM-DD')
            }}</strong>
            <small>{{ formatWeekday(selectedOrder.endTime) }}</small>
          </div>
        </div>

        <Descriptions :column="1" size="small" class="mt-6" bordered>
          <DescriptionsItem label="主订单号">
            {{ selectedOrder.orderSerial || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="子订单号">
            {{ selectedOrder.subOrderSerial || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="房间类型">
            {{ getRoomTypeLabel(getOrderRoom(selectedOrder)?.roomType) }}
          </DescriptionsItem>
          <DescriptionsItem label="备注">
            {{ selectedOrder.remark || '暂无备注' }}
          </DescriptionsItem>
        </Descriptions>

        <div class="mt-6">
          <div class="mb-3 flex items-center justify-between">
            <strong class="text-sm">排房与调房历史</strong>
            <Tag>{{ allocationHistory.length }} 条</Tag>
          </div>
          <Spin :spinning="historyLoading">
            <Empty
              v-if="!historyLoading && allocationHistory.length === 0"
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
              description="暂无排房历史"
            />
            <div v-else class="space-y-3">
              <div
                v-for="history in allocationHistory"
                :key="history.id"
                class="rounded-lg border p-3 text-sm"
                :class="{ 'opacity-50': history.recordStatus !== 0 }"
              >
                <div class="flex items-center justify-between gap-3">
                  <strong>{{
                    getOperationTypeLabel(history.operationType)
                  }}</strong>
                  <Tag
                    :color="history.recordStatus === 0 ? 'green' : 'default'"
                  >
                    {{ history.recordStatus === 0 ? '有效' : '已作废' }}
                  </Tag>
                </div>
                <div class="text-muted-foreground mt-1 text-xs">
                  {{ history.roomName || '未知房间' }} /
                  {{ history.bedCode || '未知床位' }} ·
                  {{ history.startDate }} 至 {{ history.endDate }}
                </div>
                <div v-if="history.changeReason" class="mt-2 text-xs">
                  原因：{{ history.changeReason }}
                </div>
              </div>
            </div>
          </Spin>
        </div>

        <div class="schedule-detail__tip">
          <IconifyIcon icon="lucide:move-horizontal" :size="17" />
          <span v-if="selectedOrder.status === 1">
            可拖动此排房更换床位；如需按日期调房，请使用上方操作区的“调房”。
          </span>
          <span v-else>当前状态的排房记录仅供查看，不支持拖拽调整。</span>
        </div>
      </div>
    </Drawer>

    <Modal
      v-model:open="periodChangeOpen"
      title="延期 / 提前退宿"
      width="560px"
      ok-text="确认变更"
      cancel-text="取消"
      :confirm-loading="periodChangeSubmitting"
      :ok-button-props="{ disabled: !canSubmitPeriodChange }"
      @ok="submitPeriodChange"
    >
      <div v-if="selectedOrder" class="space-y-5">
        <div class="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
          <strong>{{ selectedOrder.userName || '未填写住客' }}</strong>
          <div class="text-muted-foreground mt-1 text-xs">
            当前住宿期
            {{
              dayjs(
                selectedOrder.plannedStartTime || selectedOrder.startTime,
              ).format('YYYY-MM-DD')
            }}
            至
            {{
              dayjs(
                selectedOrder.plannedEndTime || selectedOrder.endTime,
              ).format('YYYY-MM-DD')
            }}
          </div>
        </div>

        <div>
          <div class="mb-1 text-sm font-medium">新退宿日期</div>
          <DatePicker
            :value="
              periodChangeEndDate ? dayjs(periodChangeEndDate) : undefined
            "
            class="w-full"
            :allow-clear="false"
            :disabled-date="disablePeriodChangeEndDate"
            @change="handlePeriodChangeEndDate"
          />
        </div>

        <div>
          <div class="mb-1 text-sm font-medium">变更原因</div>
          <TextArea
            v-model:value="periodChangeReason"
            :rows="3"
            :maxlength="255"
            placeholder="请填写延期或提前退宿原因"
            show-count
          />
        </div>

        <div
          class="text-muted-foreground rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30"
        >
          延期会继续占用当前最后床位并检查时间冲突；提前退宿会释放退宿日之后的床位。
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="transferOpen"
      title="调房"
      width="640px"
      ok-text="确认调房"
      cancel-text="取消"
      :confirm-loading="transferSubmitting"
      :ok-button-props="{ disabled: !canSubmitTransfer }"
      @ok="submitTransfer"
    >
      <Spin :spinning="transferLoading">
        <div v-if="selectedOrder" class="space-y-5">
          <div
            class="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900"
          >
            <strong>{{ selectedOrder.userName || '未填写住客' }}</strong>
            <div class="text-muted-foreground mt-1 text-xs">
              当前 {{ getOrderRoom(selectedOrder)?.roomAlias || '未知房间' }}，
              住宿期
              {{ dayjs(selectedOrder.startTime).format('YYYY-MM-DD') }} 至
              {{ dayjs(selectedOrder.endTime).format('YYYY-MM-DD') }}
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <div class="mb-1 text-sm font-medium">生效日期</div>
              <DatePicker
                :value="transferDate ? dayjs(transferDate) : undefined"
                class="w-full"
                :allow-clear="false"
                :disabled-date="disableTransferDate"
                @change="handleTransferDateChange"
              />
            </div>
            <div>
              <div class="mb-1 text-sm font-medium">目标房间</div>
              <Select
                v-model:value="transferRoomId"
                class="w-full"
                placeholder="请选择"
                :options="transferRoomOptions"
                show-search
                option-filter-prop="label"
                @change="handleTransferRoomChange"
              />
            </div>
            <div>
              <div class="mb-1 text-sm font-medium">目标床位</div>
              <Select
                v-model:value="transferBedId"
                class="w-full"
                placeholder="请选择"
                :disabled="!transferRoomId"
                :options="transferBedOptions"
              />
            </div>
          </div>

          <div>
            <div class="mb-1 text-sm font-medium">调房原因</div>
            <TextArea
              v-model:value="transferReason"
              :rows="3"
              :maxlength="255"
              placeholder="请填写调房原因"
              show-count
            />
          </div>

          <div
            class="text-muted-foreground rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30"
          >
            生效日前保留原床位；从生效日开始切换到目标床位，历史记录不会覆盖。
          </div>
        </div>
      </Spin>
    </Modal>

    <div class="scheduler-page">
      <Card
        class="scheduler-hero shrink-0 shadow-sm"
        :body-style="{ padding: '18px 20px' }"
      >
        <div class="scheduler-hero__main">
          <div class="flex min-w-0 items-center gap-3">
            <Image.PreviewGroup v-if="currentArea?.images?.length">
              <div class="scheduler-hero__photo">
                <Image
                  :alt="`${currentArea.areaName}区域照片`"
                  :src="currentArea.images[0]"
                />
                <span v-if="currentArea.images.length > 1">
                  +{{ currentArea.images.length - 1 }}
                </span>
              </div>
              <Image
                v-for="image in currentArea.images.slice(1)"
                :key="image"
                class="hidden"
                :src="image"
              />
            </Image.PreviewGroup>
            <div v-else class="scheduler-hero__icon">
              <IconifyIcon icon="lucide:calendar-range" :size="22" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-foreground m-0 text-xl font-semibold">
                  排房管理
                </h2>
                <Tag v-if="currentArea?.timeZone" color="blue">
                  {{ currentArea.timeZone }}
                </Tag>
                <Tag v-if="!canManageSchedule">只读</Tag>
              </div>
              <p class="text-muted-foreground mb-0 mt-1 truncate text-sm">
                {{ currentBuilding?.buildName || '请选择楼栋' }}
                <template v-if="currentBuilding?.address">
                  · {{ currentBuilding.address }}
                </template>
              </p>
            </div>
          </div>

          <div class="scheduler-hero__selectors">
            <Select
              :value="selectedAreaId"
              :options="
                areas.map((area) => ({
                  label: area.areaName,
                  value: area.id,
                }))
              "
              class="location-select"
              placeholder="选择区域"
              show-search
              option-filter-prop="label"
              @change="handleAreaChange"
            >
              <template #suffixIcon>
                <IconifyIcon icon="lucide:map-pin" />
              </template>
            </Select>
            <Select
              :value="selectedBuildId"
              :options="
                buildings.map((building) => ({
                  label: building.buildName,
                  value: building.id,
                }))
              "
              class="location-select"
              placeholder="选择楼栋"
              show-search
              option-filter-prop="label"
              :disabled="buildings.length === 0"
              @change="handleBuildingChange"
            >
              <template #suffixIcon>
                <IconifyIcon icon="lucide:building-2" />
              </template>
            </Select>
          </div>
        </div>
      </Card>

      <div class="scheduler-stats shrink-0">
        <Card
          v-for="stat in statCards"
          :key="stat.label"
          class="scheduler-stat shadow-sm"
          :body-style="{ padding: '13px 16px' }"
          :style="{ '--stat-accent': stat.accent }"
        >
          <div class="scheduler-stat__icon">
            <IconifyIcon :icon="stat.icon" :size="18" />
          </div>
          <div>
            <div class="text-muted-foreground text-xs">{{ stat.label }}</div>
            <div class="mt-1 flex items-baseline gap-1">
              <strong class="text-foreground text-xl">{{ stat.value }}</strong>
              <span class="text-muted-foreground text-xs">{{
                stat.suffix
              }}</span>
            </div>
          </div>
          <span class="scheduler-stat__note">{{ stat.note }}</span>
        </Card>
      </div>

      <Card
        class="scheduler-board min-h-0 flex-1 shadow-sm"
        :body-style="{
          padding: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }"
      >
        <div class="scheduler-toolbar">
          <div class="scheduler-month-switcher">
            <Tooltip title="上一个月">
              <Button type="text" class="month-arrow" @click="changeMonth(-1)">
                <IconifyIcon icon="lucide:chevron-left" :size="18" />
              </Button>
            </Tooltip>
            <DatePicker
              :value="currentDate"
              picker="month"
              :allow-clear="false"
              class="month-picker"
              format="YYYY 年 M 月"
              @change="handleMonthChange"
            />
            <Tooltip title="下一个月">
              <Button type="text" class="month-arrow" @click="changeMonth(1)">
                <IconifyIcon icon="lucide:chevron-right" :size="18" />
              </Button>
            </Tooltip>
            <Button class="today-button" @click="goToCurrentMonth">本月</Button>
          </div>

          <div class="scheduler-filters">
            <Input
              v-model:value="roomKeyword"
              allow-clear
              class="room-search"
              placeholder="搜索房间 / 编号"
            >
              <template #prefix>
                <IconifyIcon
                  icon="lucide:search"
                  class="text-muted-foreground"
                />
              </template>
            </Input>
            <Select
              v-model:value="selectedFloorId"
              allow-clear
              class="filter-select"
              placeholder="全部楼层"
              :options="floorOptions"
            />
            <Select
              v-model:value="selectedStatus"
              allow-clear
              class="filter-select"
              placeholder="全部状态"
              :options="statusOptions"
            />
            <Button
              v-if="canViewPendingOrders"
              type="primary"
              ghost
              @click="openPendingOrders"
            >
              <IconifyIcon
                :icon="
                  pendingPanelCollapsed
                    ? 'lucide:panel-right-open'
                    : 'lucide:panel-right-close'
                "
                :size="16"
              />
              待分配住宿人
              <span class="scheduler-pending-count">{{
                pendingGuestCount
              }}</span>
            </Button>
            <Tooltip title="刷新排房数据">
              <Button :loading="refreshing" @click="refreshCalendarEvents">
                <IconifyIcon icon="lucide:refresh-cw" :size="16" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div class="scheduler-legend">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span
              v-for="meta in calendarLegend"
              :key="meta.status"
              class="scheduler-legend__item"
            >
              <i :style="{ backgroundColor: meta.color }"></i>
              {{ meta.label }}
            </span>
            <span class="scheduler-room-color-hint">
              <IconifyIcon icon="lucide:palette" :size="13" />
              色条为状态 · 底色按房间
            </span>
          </div>
          <div class="scheduler-hint">
            <IconifyIcon icon="lucide:mouse-pointer-2" :size="14" />
            <template v-if="canManageSchedule">
              拖动卡片调房，点击空白床位安排入住；首次排房可独立调整人员日期
            </template>
            <template v-else>当前为只读模式，可点击排房卡片查看详情</template>
          </div>
        </div>

        <div class="scheduler-workbench">
          <div
            class="scheduler-calendar-wrap"
            :class="{ 'is-candidate-dragging': draggingGuest }"
            @dragover="handleCandidateDragOver"
            @drop="handleCandidateDrop"
          >
            <div v-if="draggingGuest" class="scheduler-drop-guide">
              <span class="scheduler-drop-guide__icon">
                <IconifyIcon icon="lucide:mouse-pointer-click" :size="17" />
              </span>
              <span>
                正在安排 <strong>{{ draggingGuest.userName }}</strong>
                · 放到具体床位与入住日期
              </span>
            </div>
            <Spin :spinning="loading" wrapper-class-name="scheduler-spin">
              <Empty
                v-if="!selectedBuildId && !loading"
                description="请选择区域和楼栋查看排房管理"
                class="scheduler-empty"
              />
              <Empty
                v-else-if="calendarResources.length === 0 && !loading"
                :description="
                  roomKeyword || selectedFloorId
                    ? '没有符合当前筛选条件的房间'
                    : '当前楼栋还没有可排房间'
                "
                class="scheduler-empty"
              />
              <div
                ref="calendarRef"
                class="ec-scheduler"
                :class="{ 'ec-scheduler--hidden': !selectedBuildId }"
                :style="{ '--past-days': pastDaysInWindow }"
              ></div>
            </Spin>
          </div>

          <aside
            v-if="canViewPendingOrders"
            class="pending-panel"
            :class="{ 'pending-panel--collapsed': pendingPanelCollapsed }"
          >
            <div class="pending-panel__header">
              <div v-if="!pendingPanelCollapsed" class="min-w-0">
                <div class="pending-panel__eyebrow">拖拽排房</div>
                <div class="pending-panel__title">
                  <strong>待分配住宿人</strong>
                  <span>{{ pendingGuestCount }}</span>
                </div>
              </div>
              <Tooltip
                :title="
                  pendingPanelCollapsed ? '展开待分配面板' : '收起待分配面板'
                "
              >
                <Button
                  type="text"
                  class="pending-panel__toggle"
                  :aria-label="
                    pendingPanelCollapsed ? '展开待分配面板' : '收起待分配面板'
                  "
                  @click="openPendingOrders"
                >
                  <IconifyIcon
                    :icon="
                      pendingPanelCollapsed
                        ? 'lucide:panel-right-open'
                        : 'lucide:panel-right-close'
                    "
                    :size="17"
                  />
                </Button>
              </Tooltip>
            </div>

            <template v-if="!pendingPanelCollapsed">
              <div class="pending-panel__search">
                <Input
                  v-model:value="pendingGuestKeyword"
                  allow-clear
                  size="small"
                  placeholder="搜索姓名、订单或申请组"
                >
                  <template #prefix>
                    <IconifyIcon
                      icon="lucide:search"
                      class="text-muted-foreground"
                    />
                  </template>
                </Input>
              </div>

              <div class="pending-panel__body">
                <Empty
                  v-if="visiblePendingGuests.length === 0"
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                  :description="
                    pendingGuestCount ? '没有匹配的住宿人' : '暂无待分配住宿人'
                  "
                  class="pending-panel__empty"
                />
                <template v-else>
                  <article
                    v-for="guest in visiblePendingGuests"
                    :key="guest.id"
                    draggable="true"
                    class="pending-guest"
                    @dragstart="startPendingGuestDrag(guest, $event)"
                    @dragend="handleCandidateDragEnd"
                  >
                    <div class="pending-guest__main">
                      <span class="pending-guest__avatar">
                        {{ (guest.userName || '住').slice(0, 1).toUpperCase() }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="pending-guest__name">
                          <strong>{{ guest.userName }}</strong>
                          <span>{{
                            getRequestedRoomTypeLabel(guest.requestedRoomType)
                          }}</span>
                        </div>
                        <div class="pending-guest__order">
                          {{ guest.orderSerial || '暂无订单号' }}
                        </div>
                      </div>
                      <IconifyIcon
                        icon="lucide:grip-vertical"
                        class="pending-guest__grip"
                        :size="17"
                      />
                    </div>
                    <div class="pending-guest__period">
                      <IconifyIcon icon="lucide:calendar-range" :size="13" />
                      <span>{{ guest.plannedStartDate }} 至
                        {{ guest.plannedEndDate }}</span>
                    </div>
                    <div class="pending-guest__footer">
                      <span v-if="guest.requestGroupNo">组 {{ guest.requestGroupNo }}</span>
                      <span v-else>拖到床位和日期即可安排</span>
                      <Button
                        type="link"
                        size="small"
                        @click="openPendingGuestAllocation(guest)"
                      >
                        直接安排
                      </Button>
                    </div>
                  </article>
                </template>
              </div>
            </template>

            <button
              v-else
              type="button"
              class="pending-panel__collapsed-content"
              @click="openPendingOrders"
            >
              <IconifyIcon icon="lucide:users-round" :size="17" />
              <span>待分配</span>
              <strong>{{ pendingGuestCount }}</strong>
            </button>
          </aside>
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.scheduler-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.scheduler-hero {
  overflow: hidden;
}

.scheduler-hero__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.scheduler-hero__icon {
  display: flex;
  width: 42px;
  height: 42px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 12px;
}

.scheduler-hero__photo {
  position: relative;
  width: 50px;
  height: 50px;
  flex: none;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(15 23 42 / 10%);
}

.scheduler-hero__photo :deep(.ant-image),
.scheduler-hero__photo :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
}

.scheduler-hero__photo :deep(.ant-image-img) {
  object-fit: cover;
}

.scheduler-hero__photo > span {
  position: absolute;
  right: 4px;
  bottom: 4px;
  z-index: 1;
  min-width: 20px;
  padding: 1px 5px;
  color: white;
  font-size: 10px;
  line-height: 17px;
  text-align: center;
  background: rgb(15 23 42 / 72%);
  border-radius: 999px;
  pointer-events: none;
}

.scheduler-hero__selectors,
.scheduler-filters,
.scheduler-month-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scheduler-month-switcher {
  flex: none;
}

.scheduler-filters {
  min-width: 0;
  flex: 1 1 560px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.location-select {
  width: 190px;
}

.scheduler-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.scheduler-stat {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--stat-accent) 18%, hsl(var(--border)));
  border-top: 2px solid var(--stat-accent);
}

.scheduler-stat :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scheduler-stat__icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--stat-accent);
  background: color-mix(in srgb, var(--stat-accent) 10%, transparent);
  border-radius: 10px;
}

.scheduler-stat__note {
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  white-space: nowrap;
}

.scheduler-board {
  overflow: hidden;
  border-color: hsl(var(--border) / 75%);
}

.scheduler-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.month-arrow {
  width: 32px;
  padding-inline: 0;
}

.month-picker {
  width: 148px;
}

.month-picker :deep(.ant-picker-input > input) {
  font-weight: 600;
  text-align: center;
}

.today-button {
  margin-left: 2px;
}

.room-search {
  width: 210px;
}

.filter-select {
  width: 132px;
}

.scheduler-legend {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  background: hsl(var(--muted) / 22%);
  border-bottom: 1px solid hsl(var(--border));
}

.scheduler-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scheduler-legend__item i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentcolor 7%, transparent);
}

.scheduler-room-color-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.scheduler-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  white-space: normal;
}

.scheduler-pending-count {
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  padding: 0 6px;
  color: hsl(var(--primary));
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.scheduler-workbench {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.scheduler-calendar-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.pending-panel {
  display: flex;
  width: 286px;
  min-width: 286px;
  min-height: 0;
  flex-direction: column;
  background: color-mix(in srgb, hsl(var(--muted)) 18%, hsl(var(--card)));
  border-left: 1px solid hsl(var(--border) / 85%);
  box-shadow: -5px 0 14px rgb(15 23 42 / 4%);
  transition:
    width 180ms ease,
    min-width 180ms ease;
}

.pending-panel--collapsed {
  width: 48px;
  min-width: 48px;
}

.pending-panel__header {
  display: flex;
  min-height: 60px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 9px 14px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border) / 75%);
}

.pending-panel--collapsed .pending-panel__header {
  min-height: 48px;
  justify-content: center;
  padding: 6px;
}

.pending-panel__eyebrow {
  color: hsl(var(--primary));
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.pending-panel__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}

.pending-panel__title strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-panel__title span {
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  color: hsl(var(--primary));
  font-size: 10px;
  font-weight: 700;
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.pending-panel__toggle {
  width: 30px;
  flex: none;
  padding-inline: 0;
  color: hsl(var(--muted-foreground));
}

.pending-panel__search {
  flex: none;
  padding: 10px 10px 8px;
}

.pending-panel__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 12px;
  scrollbar-color: hsl(var(--muted-foreground) / 25%) transparent;
  scrollbar-width: thin;
}

.pending-panel__empty {
  margin-top: 64px;
}

.pending-guest {
  padding: 10px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 82%);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  cursor: grab;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

.pending-guest + .pending-guest {
  margin-top: 8px;
}

.pending-guest:hover {
  border-color: hsl(var(--primary) / 42%);
  box-shadow: 0 5px 14px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.pending-guest:active {
  cursor: grabbing;
}

.pending-guest__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.pending-guest__avatar {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 750;
  background: #dbeafe;
  border-radius: 9px;
}

.pending-guest__name {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
}

.pending-guest__name strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-guest__name span,
.pending-guest__order,
.pending-guest__period,
.pending-guest__footer {
  color: hsl(var(--muted-foreground));
  font-size: 10px;
}

.pending-guest__name span {
  flex: none;
}

.pending-guest__order {
  overflow: hidden;
  margin-top: 2px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-guest__grip {
  flex: none;
  color: hsl(var(--muted-foreground) / 65%);
}

.pending-guest__period {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  padding: 6px 8px;
  background: hsl(var(--muted) / 42%);
  border-radius: 7px;
}

.pending-guest__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 5px;
}

.pending-guest__footer > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-guest__footer :deep(.ant-btn) {
  height: 22px;
  flex: none;
  padding: 0;
  font-size: 10px;
}

.pending-panel__collapsed-content {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.pending-panel__collapsed-content span {
  font-size: 11px;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
}

.pending-panel__collapsed-content strong {
  display: inline-flex;
  min-width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  color: hsl(var(--primary));
  font-size: 10px;
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.scheduler-drop-guide {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 32px);
  padding: 8px 13px 8px 9px;
  color: #1e3a8a;
  font-size: 12px;
  pointer-events: none;
  background: rgb(239 246 255 / 96%);
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  box-shadow: 0 8px 22px rgb(30 64 175 / 16%);
  transform: translateX(-50%);
  white-space: nowrap;
}

.scheduler-drop-guide__icon {
  display: inline-flex;
  width: 25px;
  height: 25px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  background: #dbeafe;
  border-radius: 999px;
}

.scheduler-calendar-wrap.is-candidate-dragging :deep(.ec-body) {
  outline: 2px dashed hsl(var(--primary) / 55%);
  outline-offset: -3px;
}

.scheduler-calendar-wrap.is-candidate-dragging :deep(.ec-cell) {
  background-color: hsl(var(--primary) / 3%);
}

.scheduler-spin {
  display: block;
  position: absolute;
  inset: 0;
  min-height: 0;
}

.scheduler-spin :deep(.ant-spin-container) {
  height: 100%;
  min-height: 0;
}

.scheduler-empty {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  margin: 0;
  transform: translate(-50%, -50%);
}

.ec-scheduler {
  height: 100%;
  padding: 0;
  --scheduler-room-width: 208px;
  --scheduler-sidebar-width: 324px;
  --scheduler-slot-width: 48px;
  --ec-accent-color: hsl(var(--primary) / 35%);
  --ec-bg-color: hsl(var(--card));
  --ec-border-color: hsl(var(--border) / 58%);
  --ec-highlight-color: hsl(var(--primary) / 10%);
  --ec-text-color: hsl(var(--foreground));
  --ec-today-bg-color: hsl(var(--primary) / 8%);
}

.ec-scheduler--hidden {
  visibility: hidden;
}

.ec-scheduler :deep(.ec) {
  max-height: 100%;
  color: hsl(var(--foreground));
  font-family: inherit;
  font-size: 12px;
}

.ec-scheduler :deep(.ec-toolbar) {
  display: none;
}

.ec-scheduler :deep(.ec-main) {
  max-height: 100%;
  min-height: 0;
  overflow: auto;
  border: 0;
  scrollbar-color: hsl(var(--muted-foreground) / 30%) transparent;
  scrollbar-width: thin;
}

.ec-scheduler :deep(.ec-sidebar) {
  width: var(--scheduler-sidebar-width);
  min-width: var(--scheduler-sidebar-width);
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border-inline-end: 1px solid hsl(var(--border) / 80%);
  box-shadow: 5px 0 14px rgb(15 23 42 / 4%);
}

.ec-scheduler :deep(.ec-body > .ec-sidebar) {
  z-index: 6;
  isolation: isolate;
  background: hsl(var(--card));
}

.ec-scheduler :deep(.ec-header .ec-sidebar) {
  position: sticky;
  z-index: 5;
  left: 0;
  isolation: isolate;
  min-height: 48px;
  background:
    linear-gradient(
      to right,
      transparent calc(var(--scheduler-room-width) - 1px),
      hsl(var(--border) / 65%) calc(var(--scheduler-room-width) - 1px),
      hsl(var(--border) / 65%) var(--scheduler-room-width),
      transparent var(--scheduler-room-width)
    ),
    color-mix(in srgb, hsl(var(--muted)) 32%, hsl(var(--card)));
  box-shadow: 6px 0 14px rgb(15 23 42 / 7%);
}

.ec-scheduler :deep(.ec-header .ec-sidebar::after) {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 18px;
  color: hsl(var(--foreground) / 82%);
  font-size: 12px;
  font-weight: 650;
  content: '房间信息';
  transform: translateY(-50%);
}

.ec-scheduler :deep(.ec-header .ec-sidebar::before) {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: calc(var(--scheduler-room-width) + 18px);
  color: hsl(var(--foreground) / 82%);
  font-size: 12px;
  font-weight: 650;
  content: '床位';
  transform: translateY(-50%);
}

.ec-scheduler :deep(.ec-header) {
  z-index: 7;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 30%);
  box-shadow: 0 2px 8px rgb(15 23 42 / 4%);
}

.ec-scheduler :deep(.ec-col-head) {
  min-height: 48px;
  padding-top: 8px;
  font-size: 12px;
  font-weight: 550;
  text-align: center;
}

.ec-scheduler :deep(.ec-col-head time) {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 2px;
  line-height: 15px;
}

.ec-scheduler :deep(.ec-col-head time::after) {
  color: hsl(var(--muted-foreground));
  font-size: 9px;
  font-weight: 500;
  line-height: 12px;
}

.ec-scheduler :deep(.ec-col-head.ec-sun time::after) {
  content: '周日';
}

.ec-scheduler :deep(.ec-col-head.ec-mon time::after) {
  content: '周一';
}

.ec-scheduler :deep(.ec-col-head.ec-tue time::after) {
  content: '周二';
}

.ec-scheduler :deep(.ec-col-head.ec-wed time::after) {
  content: '周三';
}

.ec-scheduler :deep(.ec-col-head.ec-thu time::after) {
  content: '周四';
}

.ec-scheduler :deep(.ec-col-head.ec-fri time::after) {
  content: '周五';
}

.ec-scheduler :deep(.ec-col-head.ec-sat time::after) {
  content: '周六';
}

.ec-scheduler :deep(.ec-day.ec-today:not(.ec-highlight)) {
  background-color: transparent;
}

.ec-scheduler :deep(.ec-day.ec-highlight) {
  background-color: var(--ec-today-bg-color);
}

.ec-scheduler :deep(.ec-col-group),
.ec-scheduler :deep(.ec-col-head[style*='--ec-col-group-span']) {
  grid-column: span var(--ec-col-group-span);
  min-height: 30px;
  padding-block: 6px;
  color: hsl(var(--foreground) / 75%);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  background: hsl(var(--muted) / 42%);
}

.ec-scheduler :deep(.ec-row-head) {
  position: relative;
  min-height: 56px;
  align-items: center;
  overflow: visible;
  padding: 0;
  background: hsl(var(--card));
  border-block-end: 0;
  font-size: 12px;
  text-align: left;
}

.ec-scheduler :deep(.ec-row-head > span) {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
}

.ec-scheduler :deep(.calendar-resource-row) {
  position: relative;
  display: grid;
  grid-template-columns: var(--scheduler-room-width) minmax(0, 1fr);
  width: 100%;
  height: 56px;
  min-width: 0;
  align-items: center;
  background: hsl(var(--card));
}

.ec-scheduler :deep(.calendar-resource-row--even) {
  background: color-mix(in srgb, hsl(var(--muted)) 16%, hsl(var(--card)));
}

.ec-scheduler :deep(.calendar-room-cell) {
  position: relative;
  display: flex;
  height: 100%;
  min-width: 0;
  grid-column: 1;
  flex-direction: column;
  justify-content: center;
  padding: 7px 12px 7px 14px;
  background: color-mix(in srgb, hsl(var(--muted)) 25%, hsl(var(--card)));
  border-bottom: 1px solid hsl(var(--border) / 36%);
  border-right: 1px solid hsl(var(--border) / 65%);
}

.ec-scheduler :deep(.calendar-room-cell--primary) {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 0;
  width: var(--scheduler-room-width);
  height: calc(56px * var(--room-row-span));
  box-shadow: inset 3px 0 0 hsl(var(--primary) / 55%);
}

.ec-scheduler :deep(.calendar-resource-row--last .calendar-room-cell) {
  border-bottom: 1px solid hsl(var(--border) / 90%);
}

.ec-scheduler :deep(.calendar-resource-row--even .calendar-room-cell) {
  background: color-mix(in srgb, hsl(var(--muted)) 38%, hsl(var(--card)));
}

.ec-scheduler :deep(.calendar-room-cell__top) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.ec-scheduler :deep(.calendar-room-cell__top strong) {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-room-cell__meta) {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 10px;
  line-height: 1;
}

.ec-scheduler :deep(.calendar-room-cell--continuation) {
  padding: 0;
  visibility: hidden;
  pointer-events: none;
}

.ec-scheduler :deep(.calendar-bed-slot) {
  display: flex;
  height: 100%;
  grid-column: 2;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border) / 55%);
}

.ec-scheduler :deep(.calendar-resource-row--even .calendar-bed-slot) {
  background: color-mix(in srgb, hsl(var(--muted)) 16%, hsl(var(--card)));
}

.ec-scheduler :deep(.calendar-resource-row--last .calendar-bed-slot) {
  border-bottom-color: hsl(var(--border) / 90%);
}

.ec-scheduler :deep(.calendar-floor-row) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: color-mix(in srgb, hsl(var(--primary)) 7%, hsl(var(--card)));
  border-bottom: 1px solid hsl(var(--primary) / 18%);
}

.ec-scheduler :deep(.calendar-floor-toggle) {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 0;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.ec-scheduler :deep(.calendar-floor-toggle__chevron) {
  display: inline-grid;
  width: 24px;
  height: 24px;
  flex: none;
  place-items: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 7px;
}

.ec-scheduler :deep(.calendar-floor-toggle__icon) {
  width: 14px;
  height: 14px;
}

.ec-scheduler :deep(.calendar-floor-toggle strong) {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-floor-toggle__meta) {
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 10px;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-bed-slot__icon) {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary));
  font-size: 10px;
  font-weight: 650;
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 14%);
  border-radius: 8px;
}

.ec-scheduler :deep(.calendar-bed-slot__info) {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
}

.ec-scheduler :deep(.calendar-bed-slot__info strong) {
  color: hsl(var(--foreground));
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
}

.ec-scheduler :deep(.calendar-bed-slot__info span) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  line-height: 1;
}

.ec-scheduler :deep(.calendar-bed-slot__info span::before) {
  width: 5px;
  height: 5px;
  background: #10b981;
  border-radius: 50%;
  content: '';
}

.ec-scheduler :deep(.calendar-bed-slot__info .is-disabled::before) {
  background: #94a3b8;
}

.ec-scheduler :deep(.ec-body) {
  position: relative;
}

.ec-scheduler :deep(.ec-body::after) {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  left: var(--scheduler-sidebar-width);
  width: calc(var(--past-days) * var(--scheduler-slot-width));
  background: rgb(148 163 184 / 7%);
  box-shadow: inset -1px 0 0 rgb(100 116 139 / 14%);
  content: '';
  pointer-events: none;
}

.ec-scheduler :deep(.ec-event) {
  --calendar-event-status-color: #64748b;
  min-height: 40px;
  align-self: center;
  block-size: 40px;
  margin-block-end: 1px;
  overflow: hidden;
  border-color: color-mix(
    in srgb,
    var(--calendar-event-status-color) 32%,
    hsl(var(--border))
  );
  border-left-color: var(--calendar-event-status-color);
  border-width: 1px 1px 1px 4px;
  border-style: solid;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgb(15 23 42 / 10%);
  cursor: pointer;
  transition:
    filter 140ms ease,
    box-shadow 140ms ease;
}

.ec-scheduler :deep(.calendar-event--status-0) {
  --calendar-event-status-color: #d97706;
}

.ec-scheduler :deep(.calendar-event--status-1) {
  --calendar-event-status-color: #2563eb;
}

.ec-scheduler :deep(.calendar-event--status-2) {
  --calendar-event-status-color: #94a3b8;
}

.ec-scheduler :deep(.calendar-event--status-3) {
  --calendar-event-status-color: #64748b;
}

.ec-scheduler :deep(.calendar-event--status-4) {
  --calendar-event-status-color: #475569;
}

.ec-scheduler :deep(.ec-event:hover) {
  z-index: 5;
  filter: saturate(1.08);
  box-shadow: 0 3px 9px rgb(15 23 42 / 16%);
}

.ec-scheduler :deep(.calendar-event-content) {
  position: relative;
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 9px;
  line-height: 30px;
}

.ec-scheduler :deep(.calendar-event-content::before) {
  position: absolute;
  z-index: 0;
  inset: 0 auto 0 0;
  width: var(--history-ratio);
  background: rgb(248 250 252 / 48%);
  content: '';
  pointer-events: none;
}

.ec-scheduler :deep(.calendar-event-content > *) {
  position: relative;
  z-index: 1;
}

.ec-scheduler :deep(.calendar-event-content strong) {
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-event-content span) {
  flex: none;
  font-size: 10px;
  opacity: 0.75;
}

.ec-scheduler :deep(.calendar-event--history) {
  opacity: 0.58;
  filter: saturate(0.55);
}

.ec-scheduler :deep(.calendar-event--locked) {
  cursor: not-allowed;
  filter: saturate(0.45);
}

.schedule-detail__hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.schedule-detail__avatar {
  display: flex;
  width: 44px;
  height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #1d4ed8;
  font-size: 16px;
  font-weight: 700;
  background: #dbeafe;
  border-radius: 12px;
}

.schedule-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.schedule-detail__action {
  flex: none;
}

.schedule-detail__action svg {
  flex: none;
}

.schedule-detail__period {
  display: grid;
  grid-template-columns: 1fr 86px 1fr;
  align-items: center;
  margin-top: 18px;
}

.schedule-detail__period span,
.schedule-detail__period strong,
.schedule-detail__period small {
  display: block;
}

.schedule-detail__period > div > span,
.schedule-detail__period small {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.schedule-detail__period strong {
  margin: 4px 0 2px;
  color: hsl(var(--foreground));
  font-size: 14px;
}

.schedule-detail__period-line {
  position: relative;
  height: 1px;
  background: hsl(var(--border));
}

.schedule-detail__period-line::before,
.schedule-detail__period-line::after {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  background: hsl(var(--primary));
  border-radius: 50%;
  content: '';
  transform: translateY(-50%);
}

.schedule-detail__period-line::before {
  left: 0;
}

.schedule-detail__period-line::after {
  right: 0;
}

.schedule-detail__period-line span {
  position: absolute;
  top: -8px;
  left: 50%;
  padding: 0 6px;
  color: hsl(var(--primary));
  font-size: 10px;
  background: hsl(var(--background));
  transform: translateX(-50%);
  white-space: nowrap;
}

.schedule-detail__tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 18px;
  padding: 11px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
  background: hsl(var(--muted) / 55%);
  border-radius: 8px;
}

.schedule-detail__tip svg {
  flex: none;
  margin-top: 1px;
}

@media (max-width: 1080px) {
  .scheduler-toolbar,
  .scheduler-legend {
    align-items: flex-start;
    flex-direction: column;
  }

  .scheduler-hero__main {
    gap: 12px;
  }

  .scheduler-hero__selectors {
    width: auto;
    flex: none;
    flex-wrap: nowrap;
  }

  .scheduler-hero__selectors .location-select {
    width: 150px;
  }

  .scheduler-filters {
    width: 100%;
    flex-wrap: wrap;
  }

  .scheduler-filters {
    flex: 0 1 auto;
    justify-content: flex-start;
  }

  .scheduler-filters .room-search {
    width: 180px;
  }

  .scheduler-filters .filter-select {
    width: 118px;
  }

  .scheduler-stats {
    grid-template-columns: repeat(4, minmax(112px, 1fr));
  }

  .scheduler-stat :deep(.ant-card-body) {
    padding: 10px 12px !important;
  }

  .scheduler-stat__note {
    display: none;
  }

  .scheduler-hint {
    white-space: normal;
  }
}

@media (max-width: 680px) {
  .scheduler-hero__main {
    align-items: flex-start;
    flex-direction: column;
  }

  .scheduler-hero__selectors {
    width: 100%;
    flex-wrap: wrap;
  }

  .scheduler-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .location-select,
  .room-search,
  .filter-select {
    width: 100%;
  }

  .scheduler-hero__selectors .location-select {
    width: 100%;
  }
}

@media (max-width: 460px) {
  .scheduler-stats {
    grid-template-columns: 1fr;
  }
}
</style>
