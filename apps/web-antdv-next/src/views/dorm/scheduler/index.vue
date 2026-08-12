<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { DormApi } from '#/api/dorm';

import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  render as renderVue,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

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
  allocateDormBeds,
  changeDormStayPeriod,
  correctRoomAllocationPeriod,
  getAreaSimpleList,
  getBuildInfo,
  getBuildSimpleList,
  getRoomAllocationHistory,
  getRoomAllocationWorkbench,
  transferDormBed,
} from '#/api/dorm';
import {
  type SchedulerEvent as CalendarEventBase,
  type SchedulerResource as CalendarResourceBase,
  ResourceTimelineScheduler,
  type SchedulerPointInfo,
} from '#/components/resource-scheduler';

import { getSingleDatePickerValue, type SingleDatePickerValue } from '../utils/date-picker';
import AllocationDrawer from './modules/allocation-drawer.vue';

dayjs.extend(utc);
dayjs.extend(timezone);

interface CalendarResourceProps {
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
}

type CalendarResource = CalendarResourceBase & { extendedProps?: CalendarResourceProps };

interface CalendarEventProps {
  dropPreview?: PendingGuestDropPreview;
  pendingDraft?: PendingAllocationDraft;
  subOrder?: DormApi.DormSubOrder;
}

type CalendarEvent = CalendarEventBase & { extendedProps: CalendarEventProps };

interface AllocationDrawerExpose {
  openAllocation: (
    guest: DormApi.PendingAllocationGuest,
    preset?: { bedId?: number; roomId?: number; startDate?: string }
  ) => Promise<void>;
}

type CalendarPointInfo = SchedulerPointInfo & { resource?: CalendarResource };

interface PendingGuestDropPreview {
  bedId: number;
  end: string;
  isAvailable: boolean;
  roomId: number;
  roomName: string;
  start: string;
}

interface PendingAllocationDraft {
  bedId: number;
  endDate: string;
  guest: DormApi.PendingAllocationGuest;
  roomId: number;
  startDate: string;
}

const COMPACT_LAYOUT_MAX_WIDTH = 1180;
const CALENDAR_STATUS_CODES = [1, 3, 4] as const;
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

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
    color: '#059669',
    label: '已结算',
    softColor: '#d1fae5',
    textColor: '#047857',
  },
  4: {
    color: '#7c3aed',
    label: '已分摊',
    softColor: '#ede9fe',
    textColor: '#6d28d9',
  },
};

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
const isCalendarEventDragging = ref(false);

const schedulerPageRef = ref<HTMLElement | null>(null);
const schedulerRef = ref<InstanceType<typeof ResourceTimelineScheduler>>();
let schedulerResizeObserver: null | ResizeObserver = null;

const detailOpen = ref(false);
const selectedOrder = ref<DormApi.DormSubOrder>();
const allocationHistory = ref<DormApi.RoomAllocationHistory[]>([]);
const historyLoading = ref(false);
const allocationDrawerRef = ref<AllocationDrawerExpose>();
const allocationPresetBedId = ref<number>();
const allocationPresetRoomId = ref<number>();
const allocationPresetStartDate = ref<string>();
const draggingGuest = ref<DormApi.PendingAllocationGuest>();
const pendingGuestDropPreview = ref<PendingGuestDropPreview>();
const pendingAllocationDrafts = ref<PendingAllocationDraft[]>([]);
const draftReasonDialogOpen = ref(false);
const draftReasons = ref<Record<number, string>>({});
const savingDrafts = ref(false);
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
const dragPeriodChangeOpen = ref(false);
const dragPeriodChangeSubmitting = ref(false);
const dragPeriodChangeOrder = ref<DormApi.DormSubOrder>();
const dragPeriodChangeStart = ref('');
const dragPeriodChangeEnd = ref('');
const dragPeriodChangeReason = ref('');
let dragPeriodChangeRevert: (() => void) | undefined;
let periodChangeRevert: (() => void) | undefined;
const TextArea = Input.TextArea;

const canManageSchedule = computed(() => hasAccessByCodes(['dorm:room:update']));
const canViewPendingOrders = computed(
  () => canManageSchedule.value && hasAccessByCodes(['dorm:order:query'])
);

const currentArea = computed(() => areas.value.find((area) => area.id === selectedAreaId.value));

const currentBuilding = computed(() =>
  buildings.value.find((building) => building.id === selectedBuildId.value)
);

const storeys = computed(() => selectedBuildInfo.value?.storeyBaseInfo ?? []);

const allRooms = computed(() =>
  storeys.value.flatMap((storey) =>
    (storey.roomBaseInfo ?? []).map((room) => ({
      ...room,
      floor: storey.floor,
      storeyId: storey.id,
    }))
  )
);

const dateRange = computed(() => ({
  end: currentDate.value.add(1, 'month').startOf('month').format('YYYY-MM-DD'),
  start: currentDate.value.startOf('month').format('YYYY-MM-DD'),
}));
const calendarViewDate = computed(() => currentDate.value.startOf('month').toDate());
const calendarDurationDays = computed(() => currentDate.value.daysInMonth());
const areaTimezone = computed(
  () => allocationWorkbench.value?.areaTimezone || currentArea.value?.timeZone || dayjs.tz.guess()
);
const areaToday = computed(() => dayjs().tz(areaTimezone.value).format('YYYY-MM-DD'));
const areaCurrentMonth = computed(() => dayjs(`${areaToday.value.slice(0, 7)}-01`));
const pastDaysInWindow = computed(() =>
  Math.max(
    0,
    Math.min(
      currentDate.value.daysInMonth(),
      dayjs(areaToday.value).diff(currentDate.value.startOf('month'), 'day')
    )
  )
);

const floorOptions = computed(() =>
  storeys.value.map((storey) => ({
    label: `${storey.floor} 层 · ${storey.roomBaseInfo?.length ?? 0} 间`,
    value: storey.id,
  }))
);

const statusOptions = CALENDAR_STATUS_CODES.map((status) => ({
  label: STATUS_META[status]!.label,
  value: status,
}));
const calendarLegend = CALENDAR_STATUS_CODES.map((status) => ({
  ...STATUS_META[status]!,
  status,
}));
const pendingGuestCount = computed(() => allocationWorkbench.value?.pendingGuests.length ?? 0);
const pendingDraftCount = computed(() => pendingAllocationDrafts.value.length);
const conflictedDrafts = computed(() =>
  pendingAllocationDrafts.value.filter((draft) => isDraftConflicted(draft))
);
const hasBlockingConflicts = computed(() => conflictedDrafts.value.length > 0);
const unassignedPendingGuestCount = computed(
  () => visiblePendingGuests.value.filter((guest) => !getPendingDraft(guest.id)).length
);
const visiblePendingGuests = computed(() => {
  const keyword = pendingGuestKeyword.value.trim().toLocaleLowerCase();
  const guests = allocationWorkbench.value?.pendingGuests ?? [];
  return guests.filter(
    (guest) =>
      !keyword ||
      [guest.userName, guest.orderSerial, guest.requestGroupNo]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLocaleLowerCase().includes(keyword))
  );
});

const transferRooms = computed(() => transferWorkbench.value?.rooms ?? []);
const selectedTransferRoom = computed(() =>
  transferRooms.value.find((room) => room.id === transferRoomId.value)
);
const transferRoomOptions = computed(() =>
  transferRooms.value.map((room) => ({
    disabled: room.status !== 0,
    label: `${room.roomAlias || room.roomCode} · ${room.floor ?? '-'} 层${
      room.status === 0 ? '' : ' · 房间停用'
    }`,
    value: room.id,
  }))
);
const transferBedOptions = computed(() =>
  (selectedTransferRoom.value?.beds ?? []).map((bed) => ({
    disabled: bed.status !== 0 || bed.assignments.length > 0,
    label: bed.assignments.length > 0 ? `${bed.bedCode} · 已占用` : `${bed.bedCode} · 可用`,
    value: bed.id,
  }))
);
const canSubmitTransfer = computed(
  () =>
    selectedOrder.value &&
    transferDate.value &&
    transferRoomId.value &&
    transferBedId.value &&
    transferReason.value.trim()
);
const canSubmitPeriodChange = computed(
  () =>
    selectedOrder.value &&
    periodChangeEndDate.value &&
    dayjs(selectedOrder.value.plannedStartTime || selectedOrder.value.startTime).isBefore(
      dayjs(periodChangeEndDate.value)
    ) &&
    periodChangeReason.value.trim()
);
const dragPeriodChangeConflicts = computed(() => {
  const order = dragPeriodChangeOrder.value;
  if (!order || !dragPeriodChangeStart.value || !dragPeriodChangeEnd.value) return [];
  const bed = findRoomAndBedById(order.bedId)?.bed;
  if (!bed) return [];
  return getBedAssignmentConflicts(
    bed,
    dragPeriodChangeStart.value,
    dragPeriodChangeEnd.value,
    order.id
  );
});
const canSubmitDragPeriodChange = computed(
  () =>
    dragPeriodChangeOrder.value &&
    dragPeriodChangeStart.value &&
    dragPeriodChangeEnd.value &&
    dayjs(dragPeriodChangeStart.value).isBefore(dayjs(dragPeriodChangeEnd.value), 'day') &&
    dragPeriodChangeReason.value.trim() &&
    dragPeriodChangeConflicts.value.length === 0
);

const calendarResources = computed<CalendarResource[]>(() => {
  const keyword = roomKeyword.value.trim().toLocaleLowerCase();
  const selectedFloor = storeys.value.find((storey) => storey.id === selectedFloorId.value)?.floor;
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
    ([left], [right]) => left - right
  )) {
    const sortedRooms = floorRooms.toSorted((left, right) =>
      String(left.roomCode || left.roomAlias || '').localeCompare(
        String(right.roomCode || right.roomAlias || '')
      )
    );
    const collapsed = collapsedFloors.value.has(floor);
    resources.push({
      id: `floor-${floor}`,
      title: `${floor}F 楼层`,
      extendedProps: {
        bedCount: sortedRooms.reduce((total, room) => total + room.beds.length, 0),
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
        }))
      )
    );
  }
  return resources;
});

const visibleBedIds = computed(
  () => new Set(calendarResources.value.map((resource) => resource.id))
);

const calendarEvents = computed<CalendarEvent[]>(() => {
  const events: CalendarEvent[] = rawEvents.value
    .filter(
      (order) =>
        visibleBedIds.value.has(`bed-${order.bedId}`) &&
        (selectedStatus.value === undefined || order.status === selectedStatus.value)
    )
    .map((order) => {
      const statusMeta = getStatusMeta(order.status);
      const start = order.startTime || currentDate.value.format('YYYY-MM-DD');
      const end = order.endTime || dayjs(start).add(1, 'day').format('YYYY-MM-DD');
      const editable = canManageSchedule.value && order.status === 1;
      return {
        classNames: [
          `calendar-event--status-${order.status ?? 0}`,
          ...(dayjs(end).isAfter(dayjs(areaToday.value), 'day') ? [] : ['calendar-event--history']),
          ...(order.status === 1 ? [] : ['calendar-event--locked']),
        ],
        id: String(order.id),
        resourceId: `bed-${order.bedId}`,
        title: order.userName || '未填写住客',
        start,
        end,
        extendedProps: { subOrder: order },
        backgroundColor: statusMeta.softColor,
        textColor: statusMeta.textColor,
        durationEditable: editable,
        editable,
        startEditable: editable,
      } satisfies CalendarEvent;
    });
  const preview = pendingGuestDropPreview.value;
  if (preview) {
    events.push({
      backgroundColor: preview.isAvailable ? '#dbeafe' : '#ef4444',
      classNames: [
        'calendar-event--drop-preview',
        preview.isAvailable
          ? 'calendar-event--drop-preview-available'
          : 'calendar-event--drop-preview-unavailable',
      ],
      durationEditable: false,
      editable: false,
      end: preview.end,
      extendedProps: { dropPreview: preview },
      id: `pending-drop-preview-${preview.bedId}`,
      resourceId: `bed-${preview.bedId}`,
      start: preview.start,
      startEditable: false,
      textColor: preview.isAvailable ? '#1e40af' : '#ffffff',
      title: '待分配住宿人',
    });
  }
  for (const draft of pendingAllocationDrafts.value) {
    if (!visibleBedIds.value.has(`bed-${draft.bedId}`)) continue;
    const depth = getDraftConflictDepth(draft);
    // 冲突配色取决于是否真的存在冲突；层级（depth）只决定错位量，
    // 两个互相冲突的草稿里排在前面的那个 depth 可能是 0（不挪位），但仍要标红。
    const conflicted = isDraftConflicted(draft);
    events.push({
      backgroundColor: conflicted ? '#ef4444' : '#dbeafe',
      classNames: [
        'calendar-event--pending-draft',
        ...(conflicted ? ['calendar-event--pending-draft-conflict'] : []),
      ],
      durationEditable: true,
      editable: true,
      end: draft.endDate,
      extendedProps: { pendingDraft: draft },
      id: `pending-draft-${draft.guest.id}`,
      resourceId: `bed-${draft.bedId}`,
      start: draft.startDate,
      startEditable: true,
      styles: getDraftConflictStyles(depth),
      textColor: conflicted ? '#ffffff' : '#1e40af',
      title: draft.guest.userName || '待保存排房',
    });
  }
  return events;
});

const totalCapacity = computed(() =>
  (allocationWorkbench.value?.rooms ?? [])
    .filter((room) => room.status === 0)
    .reduce((total, room) => total + room.beds.filter((bed) => bed.status === 0).length, 0)
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
                !dayjs(areaToday.value).isBefore(dayjs(assignment.startDate), 'day') &&
                dayjs(areaToday.value).isBefore(dayjs(assignment.endDate), 'day')
            )
        ).length,
      0
    )
);

const availableBedCount = computed(() =>
  Math.max(0, totalCapacity.value - currentGuestCount.value)
);

const activeBookingCount = computed(
  () => rawEvents.value.filter((order) => order.status !== 2).length
);

const occupancyRate = computed(() => {
  if (totalCapacity.value === 0) return 0;

  const monthStart = currentDate.value.startOf('month');
  const monthEnd = currentDate.value.add(1, 'month').startOf('month');
  let occupiedRoomDays = 0;
  for (const order of rawEvents.value) {
    if (order.status === 2 || !order.startTime || !order.endTime) continue;
    const start = dayjs(order.startTime).isAfter(monthStart) ? dayjs(order.startTime) : monthStart;
    const end = dayjs(order.endTime).isBefore(monthEnd) ? dayjs(order.endTime) : monthEnd;
    occupiedRoomDays += Math.max(0, end.startOf('day').diff(start.startOf('day'), 'day'));
  }
  const availableRoomDays = totalCapacity.value * currentDate.value.daysInMonth();

  return Math.min(100, Math.round((occupiedRoomDays / availableRoomDays) * 100));
});

const statCards = computed(() => [
  {
    icon: 'lucide:door-open',
    label: '房间总数',
    note: `${storeys.value.length} 个楼层`,
    suffix: '间',
    value: allRooms.value.length,
  },
  {
    icon: 'lucide:bed-single',
    label: '可用床位',
    note: `启用床位 ${totalCapacity.value}`,
    suffix: '个',
    value: availableBedCount.value,
  },
  {
    icon: 'lucide:calendar-check-2',
    label: '本月排房',
    note: `${currentDate.value.format('M 月')}有效安排`,
    suffix: '单',
    value: activeBookingCount.value,
  },
  {
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
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(value).day()];
}

function formatCalendarDayHeader(date: Date) {
  return `${date.getDate()}\n${WEEKDAY_LABELS[date.getDay()]}`;
}

function createCalendarIcon(icon: string, className: string) {
  const host = document.createElement('span');
  host.className = className;
  host.setAttribute('aria-hidden', 'true');
  renderVue(h(IconifyIcon, { icon, size: 14 }), host);
  return host;
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
    toggle.setAttribute('aria-label', `${props.collapsed ? '展开' : '收起'} ${props.floor}F 楼层`);

    const chevron = createCalendarIcon(
      props.collapsed ? 'lucide:chevron-right' : 'lucide:chevron-down',
      'calendar-floor-toggle__chevron'
    );
    const title = document.createElement('strong');
    title.textContent = `${props.floor}F 楼层`;
    const meta = document.createElement('span');
    meta.className = 'calendar-floor-toggle__meta';
    meta.textContent = `${props.roomCount ?? 0} 间 · ${props.bedCount ?? 0} 床`;
    toggle.append(chevron, title, meta);
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (isCalendarEventDragging.value) return;
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
    props.roomFirst ? '' : 'calendar-resource-row--continuation',
    props.roomLast ? 'calendar-resource-row--last' : '',
    Number(props.roomIndex ?? 0) % 2 === 0 ? 'calendar-resource-row--even' : '',
  ]
    .filter(Boolean)
    .join(' ');
  wrapper.style.setProperty('--room-row-span', String(Math.max(1, Number(props.bedCount) || 1)));
  if (props.roomFirst && room) {
    const roomCell = document.createElement('div');
    roomCell.className = [
      'calendar-room-cell',
      'calendar-room-cell--primary',
      room.status !== 0 ? 'calendar-room-cell--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const roomTop = document.createElement('div');
    roomTop.className = 'calendar-room-cell__top';
    const title = document.createElement('strong');
    title.textContent = room.roomAlias || room.roomCode || `房间 ${room.id}`;
    roomTop.append(title);

    const meta = document.createElement('span');
    meta.className = 'calendar-room-cell__meta';
    meta.textContent = `${getRoomTypeLabel(room.roomType)} · ${room.beds.length} 个床位`;
    roomCell.append(roomTop, meta);
    wrapper.append(roomCell);
  }

  const bedCell = document.createElement('div');
  const bedAvailable = room?.status === 0 && bed?.status === 0;
  bedCell.className = ['calendar-bed-slot', bedAvailable ? '' : 'calendar-bed-slot--disabled']
    .filter(Boolean)
    .join(' ');
  const bedIcon = createCalendarIcon('lucide:bed-single', 'calendar-bed-slot__icon');
  const bedInfo = document.createElement('div');
  bedInfo.className = 'calendar-bed-slot__info';
  const bedTitle = document.createElement('strong');
  bedTitle.textContent = bed?.bedCode || resource.title;
  const bedMeta = document.createElement('span');
  bedMeta.className = bedAvailable ? 'is-enabled' : 'is-disabled';
  let bedStatusLabel = '可用';
  let bedStatusDescription = '床位可用';
  if (room?.status !== 0) {
    bedStatusLabel = '停用';
    bedStatusDescription = '房间已停用';
  } else if (bed?.status !== 0) {
    bedStatusLabel = '停用';
    bedStatusDescription = '床位已停用';
  }
  bedMeta.textContent = bedStatusLabel;
  bedInfo.append(bedTitle, bedMeta);
  bedCell.setAttribute(
    'aria-label',
    `床位 ${bed?.bedCode || resource.title}，${bedStatusDescription}`
  );
  bedCell.title = bedStatusDescription;
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
  const dropPreview = event.extendedProps?.dropPreview as PendingGuestDropPreview | undefined;
  if (dropPreview) {
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-drop-preview-content';
    const guest = document.createElement('strong');
    guest.textContent = draggingGuest.value?.userName || '待分配住宿人';
    const target = document.createElement('span');
    target.textContent = dropPreview.isAvailable
      ? `候选位置 · ${dropPreview.roomName}`
      : '时段内已有入住安排';
    wrapper.append(guest, target);
    return { domNodes: [wrapper] };
  }
  const pendingDraft = event.extendedProps?.pendingDraft as PendingAllocationDraft | undefined;
  if (pendingDraft) {
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-draft-content';
    const guest = document.createElement('strong');
    guest.textContent = pendingDraft.guest.userName || '待保存排房';
    const status = document.createElement('span');
    status.textContent = isDraftConflicted(pendingDraft) ? '⚠ 冲突' : '待保存';
    wrapper.append(guest, status);
    return { domNodes: [wrapper] };
  }
  const order = event.extendedProps?.subOrder as DormApi.DormSubOrder | undefined;
  const wrapper = document.createElement('div');
  wrapper.className = 'calendar-event-content';
  const start = dayjs(order?.startTime);
  const end = dayjs(order?.endTime);
  const totalDays = Math.max(1, end.diff(start, 'day'));
  const elapsedDays = Math.max(0, Math.min(totalDays, dayjs(areaToday.value).diff(start, 'day')));
  wrapper.style.setProperty('--history-ratio', `${(elapsedDays / totalDays) * 100}%`);

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

// 日历自身的渲染/布局机制（行高同步、跨行合并、滚动阴影、滚轮转发等）已下沉到
// <ResourceTimelineScheduler>，此处只保留业务侧需要的几个轻量委托。
function revertCalendarChange(revert?: () => void) {
  schedulerRef.value?.revertChange(revert);
}

function scrollCalendarToFocusDate() {
  const isCurrentAreaMonth = currentDate.value.isSame(areaCurrentMonth.value, 'month');
  schedulerRef.value?.scrollToDayOffset(isCurrentAreaMonth ? pastDaysInWindow.value - 2 : 0);
}

function handleEventDragStart() {
  isCalendarEventDragging.value = true;
}

function handleEventDragStop() {
  isCalendarEventDragging.value = false;
}

function syncCompactLayout(width = schedulerPageRef.value?.clientWidth ?? 0) {
  if (width > 0 && width <= COMPACT_LAYOUT_MAX_WIDTH) {
    pendingPanelCollapsed.value = true;
  }
}

// 调房/延期/纠错等操作在后端都是"作废旧片段 + 插入新片段"的追加式历史模型（同一住客、
// 同一床位会产生多条 assignment 记录），如果按记录逐条渲染，日历上会显示成好几段连续的条，
// 看起来像是新增了入住记录。这里把同一住客、同一床位上首尾相接（前一段的退宿日 = 后一段的
// 入住日）的片段合并成一条日历事件，保证同一次住宿在日历上始终是一根连续的条。
function mergeContiguousAssignments(
  segments: DormApi.DormSubOrder[]
): DormApi.DormSubOrder[] {
  const groups = new Map<string, DormApi.DormSubOrder[]>();
  for (const segment of segments) {
    const key = `${segment.id}-${segment.bedId}`;
    const group = groups.get(key);
    if (group) group.push(segment);
    else groups.set(key, [segment]);
  }

  const merged: DormApi.DormSubOrder[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => dayjs(a.startTime).diff(dayjs(b.startTime)));
    let current = sorted[0]!;
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;
      if (!dayjs(next.startTime).isAfter(dayjs(current.endTime))) {
        current = {
          ...next,
          plannedEndTime: next.plannedEndTime || current.plannedEndTime,
          plannedStartTime: current.plannedStartTime || next.plannedStartTime,
          startTime: current.startTime,
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
  }
  return merged.map((order) => ({
    ...order,
    days: Math.max(1, dayjs(order.endTime).diff(dayjs(order.startTime), 'day')),
  }));
}

function applyAllocationWorkbench(data: DormApi.RoomAllocationWorkbench) {
  allocationWorkbench.value = data;
  const segments = data.rooms.flatMap((room) =>
    room.beds.flatMap((bed) =>
      bed.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        bedId: bed.id,
        days: Math.max(1, dayjs(assignment.endDate).diff(dayjs(assignment.startDate), 'day')),
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
      }))
    )
  );
  rawEvents.value = mergeContiguousAssignments(segments);
}

async function fetchCalendarEvents() {
  if (!selectedBuildId.value) {
    allocationWorkbench.value = undefined;
    rawEvents.value = [];
    return;
  }

  applyAllocationWorkbench(
    await getRoomAllocationWorkbench({
      buildId: selectedBuildId.value,
      endDate: dateRange.value.end,
      startDate: dateRange.value.start,
    })
  );
}

async function loadBuildingData() {
  if (!selectedBuildId.value) {
    selectedBuildInfo.value = undefined;
    allocationWorkbench.value = undefined;
    rawEvents.value = [];
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
  } finally {
    loading.value = false;
  }
}

async function findInitialBuilding(buildId?: number) {
  const routeAreaId = route.query.areaId ? Number(route.query.areaId) : undefined;
  const preferredArea = areas.value.find((area) => area.id === routeAreaId) ?? areas.value[0];

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
    const routeBuildId = route.query.buildId ? Number(route.query.buildId) : undefined;
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

function discardDraftsOnLocationChange() {
  if (pendingAllocationDrafts.value.length === 0) return;
  message.warning(`已清空 ${pendingAllocationDrafts.value.length} 条未保存的排房草稿（切换了区域/楼栋）`);
  clearPendingDrafts();
}

async function handleAreaChange(value: unknown) {
  const areaId = Number(value);
  if (!Number.isFinite(areaId)) return;
  discardDraftsOnLocationChange();
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
  discardDraftsOnLocationChange();
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
  loading.value = true;
  try {
    await fetchCalendarEvents();
    await nextTick();
    scrollCalendarToFocusDate();
  } finally {
    loading.value = false;
  }
}

async function changeMonth(offset: number) {
  await handleMonthChange(currentDate.value.add(offset, 'month'));
}

async function goToCurrentMonth() {
  if (currentDate.value.isSame(areaCurrentMonth.value, 'month')) {
    scrollCalendarToFocusDate();
    return;
  }
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

async function handleEventDrop({ event, newResource, revert }: any) {
  if (!canManageSchedule.value) {
    revertCalendarChange(revert);
    return;
  }

  const pendingDraft = event.extendedProps?.pendingDraft as PendingAllocationDraft | undefined;
  if (pendingDraft) {
    const resourceProps = newResource?.extendedProps;
    const sameBedTarget = newResource ? undefined : findRoomAndBedById(pendingDraft.bedId);
    const room =
      (resourceProps?.room as DormApi.RoomAllocationRoom | undefined) ?? sameBedTarget?.room;
    const bed = (resourceProps?.bed as DormApi.RoomAllocationBed | undefined) ?? sameBedTarget?.bed;
    const startDate = dayjs(event.start).format('YYYY-MM-DD');
    const endDate = dayjs(event.end).format('YYYY-MM-DD');
    if ((newResource && resourceProps?.kind !== 'bed') || !room || !bed) {
      message.warning('草稿只能放在具体床位上');
      revertCalendarChange(revert);
      return;
    }
    if (!isDraftPlacementAllowed(room, bed, startDate, endDate)) {
      message.warning('该床位当前不可用或日期无效');
      revertCalendarChange(revert);
      return;
    }
    if (hasDraftConflict(pendingDraft.guest.id, bed, startDate, endDate)) {
      message.warning('该床位在此时间段已有安排，草稿将以冲突状态显示，请调整或确认后再保存');
    }
    replacePendingDraft({ ...pendingDraft, bedId: bed.id, endDate, roomId: room.id, startDate });
    return;
  }

  const order = event.extendedProps?.subOrder as DormApi.DormSubOrder | undefined;
  if (!order) {
    revertCalendarChange(revert);
    return;
  }
  if (order.status !== 1) {
    let warning = '该住宿人尚未完成首次排房';
    if ((order.status ?? 0) >= 3) warning = '该订单已结算或已分摊，不能再拖动调房';
    else if (order.status === 2) warning = '该订单已取消，排房记录仅供查看';
    message.warning(warning);
    revertCalendarChange(revert);
    return;
  }

  const resourceProps = newResource?.extendedProps;
  const sameBedTarget = newResource ? undefined : findRoomAndBedById(order.bedId);
  const targetBed =
    (resourceProps?.bed as DormApi.RoomAllocationBed | undefined) ?? sameBedTarget?.bed;
  const targetRoom =
    (resourceProps?.room as DormApi.RoomAllocationRoom | undefined) ?? sameBedTarget?.room;
  if ((newResource && resourceProps?.kind !== 'bed') || !targetBed || !targetRoom) {
    message.warning('只能将住宿人拖动到具体床位');
    revertCalendarChange(revert);
    return;
  }
  if (targetBed.id === order.bedId) {
    const newStart = dayjs(event.start).format('YYYY-MM-DD');
    const newEnd = dayjs(event.end).format('YYYY-MM-DD');
    const currentStart = dayjs(order.startTime).format('YYYY-MM-DD');
    const currentEnd = dayjs(order.endTime).format('YYYY-MM-DD');
    if (newStart === currentStart && newEnd === currentEnd) {
      revertCalendarChange(revert);
      return;
    }
    openDragPeriodChange(order, newStart, newEnd, () => revertCalendarChange(revert));
    return;
  }
  if (targetRoom.status !== 0 || targetBed.status !== 0) {
    message.warning(targetRoom.status === 0 ? '目标床位已停用' : '目标房间已停用');
    revertCalendarChange(revert);
    return;
  }
  // 调房只改变生效日之后使用的床位，退宿日期不变，因此生效日必须落在
  // [入住日, 退宿日) 之间；拖拽落点的日期即为期望的调房生效日（而不是拖拽前的原日期）。
  const transferEffectiveDate = dayjs(event.start).format('YYYY-MM-DD');
  const transferEnd = dayjs(order.endTime).format('YYYY-MM-DD');
  if (
    dayjs(transferEffectiveDate).isBefore(dayjs(order.startTime), 'day') ||
    !dayjs(transferEffectiveDate).isBefore(dayjs(transferEnd), 'day')
  ) {
    message.warning('调房生效日期需在该住客的入住日与退宿日之间，请重新拖拽或改用详情中的调房功能');
    revertCalendarChange(revert);
    return;
  }
  const transferConflicts = getBedAssignmentConflicts(
    targetBed,
    transferEffectiveDate,
    transferEnd,
    order.id
  );
  if (transferConflicts.length > 0) {
    const names = transferConflicts.map((item) => item.guestName || '未命名住宿人').join('、');
    message.warning(
      `「${targetRoom.roomAlias || targetRoom.roomCode} / ${targetBed.bedCode}」在该住宿期内已被 ${names} 占用，请更换床位或调整住宿期后再调房`
    );
    revertCalendarChange(revert);
    return;
  }

  const confirmed = await confirmScheduleChange(
    '确认调房？',
    `${order.userName || '该住客'}将自 ${transferEffectiveDate} 起调整至「${
      targetRoom.roomAlias || targetRoom.roomCode
    } / ${targetBed.bedCode}」，退宿日期不变，原床位历史会保留。`
  );

  if (!confirmed) {
    revertCalendarChange(revert);
    return;
  }

  try {
    await transferDormBed({
      effectiveDate: transferEffectiveDate,
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
    revertCalendarChange(revert);
    await fetchCalendarEvents();
  }
}

async function handleEventResize({ event, revert }: any) {
  if (!canManageSchedule.value) {
    revertCalendarChange(revert);
    return;
  }

  const pendingDraft = event.extendedProps?.pendingDraft as PendingAllocationDraft | undefined;
  if (pendingDraft) {
    const room = allocationWorkbench.value?.rooms.find((item) => item.id === pendingDraft.roomId);
    const bed = room?.beds.find((item) => item.id === pendingDraft.bedId);
    const startDate = dayjs(event.start).format('YYYY-MM-DD');
    const endDate = dayjs(event.end).format('YYYY-MM-DD');
    if (!room || !bed || !isDraftPlacementAllowed(room, bed, startDate, endDate)) {
      message.warning('调整后的日期无效或床位不可用');
      revertCalendarChange(revert);
      return;
    }
    if (hasDraftConflict(pendingDraft.guest.id, bed, startDate, endDate)) {
      message.warning('该床位在调整后的时间段已有安排，草稿将以冲突状态显示');
    }
    replacePendingDraft({ ...pendingDraft, endDate, startDate });
    return;
  }

  const order = event.extendedProps?.subOrder as DormApi.DormSubOrder | undefined;
  if (!order) {
    revertCalendarChange(revert);
    return;
  }
  if (order.status !== 1) {
    message.warning('该订单当前状态不支持调整日期');
    revertCalendarChange(revert);
    return;
  }

  const newStart = dayjs(event.start).format('YYYY-MM-DD');
  const newEnd = dayjs(event.end).format('YYYY-MM-DD');
  const currentStart = dayjs(order.startTime).format('YYYY-MM-DD');
  const currentEnd = dayjs(order.endTime).format('YYYY-MM-DD');
  if (newStart === currentStart && newEnd === currentEnd) {
    revertCalendarChange(revert);
    return;
  }
  if (newStart !== currentStart) {
    // 日历未开启从起始边拉伸（eventResizableFromStart），理论上拉伸只会改变退宿日期；
    // 万一触发了起始日变化，退回到“同床位改期”弹窗兜底，而不是套用只改 endDate 的接口。
    openDragPeriodChange(order, newStart, newEnd, () => revertCalendarChange(revert));
    return;
  }
  openPeriodChangeDialog(order, newEnd, () => revertCalendarChange(revert));
}

function handleSlotSelect({ date, resource, start }: any) {
  if (!canViewPendingOrders.value || !resource?.id || resource.extendedProps?.kind !== 'bed') {
    return;
  }
  const room = resource.extendedProps?.room as DormApi.RoomAllocationRoom | undefined;
  const bed = resource.extendedProps?.bed as DormApi.RoomAllocationBed | undefined;
  if (room?.status !== 0 || bed?.status !== 0) {
    message.warning(room?.status === 0 ? '该床位当前已停用' : '该房间当前已停用');
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

async function openPendingGuestAllocation(guest: DormApi.PendingAllocationGuest) {
  await allocationDrawerRef.value?.openAllocation(guest, {
    bedId: allocationPresetBedId.value,
    roomId: allocationPresetRoomId.value,
    startDate: allocationPresetStartDate.value,
  });
}

// 一键加入日历：按审批住宿期在启用房间中挑选第一个无冲突床位（优先匹配偏好房型），
// 找不到空闲床位时不创建草稿，交由用户手动拖拽。
function findAvailableBedForGuest(guest: DormApi.PendingAllocationGuest) {
  const period = getApprovedGuestPeriod(guest);
  if (!period.start || !period.end) return undefined;
  const rooms = (allocationWorkbench.value?.rooms ?? [])
    .filter((room) => room.status === 0)
    .toSorted((a, b) => {
      const aMatch = guest.requestedRoomType && a.roomType === guest.requestedRoomType ? 0 : 1;
      const bMatch = guest.requestedRoomType && b.roomType === guest.requestedRoomType ? 0 : 1;
      return aMatch - bMatch;
    });
  for (const room of rooms) {
    const bed = room.beds.find(
      (item) => item.status === 0 && !hasDraftConflict(guest.id, item, period.start!, period.end!)
    );
    if (bed) return { bedId: bed.id, roomId: room.id };
  }
  return undefined;
}

function quickAddGuestToCalendar(guest: DormApi.PendingAllocationGuest) {
  if (getPendingDraft(guest.id)) {
    message.info('该住宿人已加入日历草稿');
    return true;
  }
  const target = findAvailableBedForGuest(guest);
  if (!target) {
    message.warning(`未找到 ${guest.userName || '该住宿人'} 的空闲床位，请手动拖拽安排`);
    return false;
  }
  const created = createPendingDraft(guest, target, { rejectOnConflict: true });
  if (created) void focusPendingGuestMonth(guest);
  return created;
}

async function quickAddAllPendingGuests() {
  const guests = visiblePendingGuests.value.filter((guest) => !getPendingDraft(guest.id));
  if (guests.length === 0) {
    message.info('没有待加入日历的住宿人');
    return;
  }
  let addedCount = 0;
  const failedNames: string[] = [];
  for (const guest of guests) {
    const target = findAvailableBedForGuest(guest);
    if (target && createPendingDraft(guest, target, { rejectOnConflict: true, silent: true })) {
      addedCount += 1;
    } else {
      failedNames.push(guest.userName || '未命名住宿人');
    }
  }
  if (addedCount > 0) message.success(`已一键加入 ${addedCount} 位住宿人至日历草稿`);
  if (failedNames.length > 0) {
    message.warning(`以下住宿人未找到空闲床位，请手动拖拽：${failedNames.join('、')}`);
  }
}

function startPendingGuestDrag(guest: DormApi.PendingAllocationGuest, event: DragEvent) {
  event.dataTransfer?.setData('application/x-dorm-guest-id', String(guest.id));
  event.dataTransfer?.setData('text/plain', String(guest.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  handleCandidateDragStart(guest);
}

function getApprovedGuestPeriod(guest: DormApi.PendingAllocationGuest) {
  return {
    end: guest.approvedEndDate || guest.plannedEndDate,
    start: guest.approvedStartDate || guest.plannedStartDate,
  };
}

// 硬性规则：房间/床位停用或日期无效时拒绝落位，不允许拖入。
function isDraftPlacementAllowed(
  room: DormApi.RoomAllocationRoom,
  bed: DormApi.RoomAllocationBed,
  startDate: string,
  endDate: string
) {
  return room.status === 0 && bed.status === 0 && dayjs(startDate).isBefore(dayjs(endDate), 'day');
}

// 软性冲突：目标床位已有入住安排或与其他草稿重叠，允许落位但需要在日历上以危险色叠加提示。
function getDraftConflicts(
  guestId: number,
  bed: DormApi.RoomAllocationBed,
  startDate: string,
  endDate: string
) {
  const overlaps = (start: string, end: string) =>
    dayjs(start).isBefore(dayjs(endDate)) && dayjs(end).isAfter(dayjs(startDate));
  return {
    assignmentConflicts: bed.assignments.filter((assignment) =>
      overlaps(assignment.startDate, assignment.endDate)
    ),
    draftConflicts: pendingAllocationDrafts.value.filter(
      (draft) =>
        draft.guest.id !== guestId && draft.bedId === bed.id && overlaps(draft.startDate, draft.endDate)
    ),
  };
}

function hasDraftConflict(
  guestId: number,
  bed: DormApi.RoomAllocationBed,
  startDate: string,
  endDate: string
) {
  const { assignmentConflicts, draftConflicts } = getDraftConflicts(guestId, bed, startDate, endDate);
  return assignmentConflicts.length > 0 || draftConflicts.length > 0;
}

function getBedForDraft(draft: PendingAllocationDraft) {
  const room = allocationWorkbench.value?.rooms.find((item) => item.id === draft.roomId);
  return room?.beds.find((item) => item.id === draft.bedId);
}

// event-calendar 只在拖拽跨床位时才提供 newResource；仅调整日期（同床位）时为 undefined，
// 此时用事件当前所在床位作为目标床位，而不是误判为“未放在具体床位上”。
function findRoomAndBedById(bedId?: number) {
  if (bedId === undefined) return undefined;
  const room = allocationWorkbench.value?.rooms.find((item) =>
    item.beds.some((bed) => bed.id === bedId)
  );
  const bed = room?.beds.find((item) => item.id === bedId);
  return room && bed ? { bed, room } : undefined;
}

// 已排房记录（调房 / 同床位改期）在提交前的前端冲突校验：目标床位在目标时间段内是否
// 已有其他住宿人（排除自己当前的记录），避免拖拽产生的调整请求造成双人占用同一床位。
function getBedAssignmentConflicts(
  bed: DormApi.RoomAllocationBed,
  startDate: string,
  endDate: string,
  excludeGuestId?: number
) {
  const overlaps = (start: string, end: string) =>
    dayjs(start).isBefore(dayjs(endDate)) && dayjs(end).isAfter(dayjs(startDate));
  return bed.assignments.filter(
    (assignment) => assignment.guestId !== excludeGuestId && overlaps(assignment.startDate, assignment.endDate)
  );
}

function isDraftConflicted(draft: PendingAllocationDraft) {
  const bed = getBedForDraft(draft);
  if (!bed) return false;
  return hasDraftConflict(draft.guest.id, bed, draft.startDate, draft.endDate);
}

// 冲突层级：0 = 无冲突（保持默认样式和位置）；>=1 = 第几层叠放，用于错开显示，
// 避免多个互相冲突的草稿完全重叠、无法单独点击。层级按加入草稿的先后顺序（数组下标）计算，
// 已有床位安排永远算作最底层（层级 0 的位置），不参与错开。
function getDraftConflictDepth(draft: PendingAllocationDraft) {
  const bed = getBedForDraft(draft);
  if (!bed) return 0;
  const { assignmentConflicts, draftConflicts } = getDraftConflicts(
    draft.guest.id,
    bed,
    draft.startDate,
    draft.endDate
  );
  if (assignmentConflicts.length === 0 && draftConflicts.length === 0) return 0;

  const group = [draft, ...draftConflicts].toSorted(
    (a, b) => pendingAllocationDrafts.value.indexOf(a) - pendingAllocationDrafts.value.indexOf(b)
  );
  const rank = Math.max(
    0,
    group.findIndex((item) => item.guest.id === draft.guest.id)
  );
  return rank + (assignmentConflicts.length > 0 ? 1 : 0);
}

const DRAFT_CONFLICT_LAYER_STYLES = [
  { marginTop: 10, size: 40 },
  { marginTop: 20, size: 28 },
  { marginTop: 28, size: 20 },
] as const;

function getDraftConflictStyles(depth: number) {
  if (depth <= 0) return [];
  const layer = DRAFT_CONFLICT_LAYER_STYLES[Math.min(depth, DRAFT_CONFLICT_LAYER_STYLES.length) - 1]!;
  return [
    `z-index:${8 + depth}`,
    `margin-top:${layer.marginTop}px`,
    `height:${layer.size}px`,
    `min-height:${layer.size}px`,
    `block-size:${layer.size}px`,
  ];
}

function replacePendingDraft(draft: PendingAllocationDraft) {
  const exists = pendingAllocationDrafts.value.some((item) => item.guest.id === draft.guest.id);
  pendingAllocationDrafts.value = exists
    ? pendingAllocationDrafts.value.map((item) => (item.guest.id === draft.guest.id ? draft : item))
    : [...pendingAllocationDrafts.value, draft];
}

function removePendingDraft(guestId: number) {
  pendingAllocationDrafts.value = pendingAllocationDrafts.value.filter(
    (draft) => draft.guest.id !== guestId
  );
  delete draftReasons.value[guestId];
}

function getPendingDraft(guestId: number) {
  return pendingAllocationDrafts.value.find((draft) => draft.guest.id === guestId);
}

function getPendingDraftTarget(draft: PendingAllocationDraft) {
  const room = allocationWorkbench.value?.rooms.find((item) => item.id === draft.roomId);
  const bed = room?.beds.find((item) => item.id === draft.bedId);
  return `${room?.roomAlias || room?.roomCode || '房间'} / ${bed?.bedCode || '床位'}`;
}

function clearPendingDrafts() {
  pendingAllocationDrafts.value = [];
  draftReasons.value = {};
}

function isDraftPeriodChanged(draft: PendingAllocationDraft) {
  const approved = getApprovedGuestPeriod(draft.guest);
  return draft.startDate !== approved.start || draft.endDate !== approved.end;
}

function createPendingDraft(
  guest: DormApi.PendingAllocationGuest,
  target: Pick<PendingGuestDropPreview, 'bedId' | 'roomId'>,
  options: { rejectOnConflict?: boolean; silent?: boolean } = {}
) {
  const room = allocationWorkbench.value?.rooms.find((item) => item.id === target.roomId);
  const bed = room?.beds.find((item) => item.id === target.bedId);
  const approvedPeriod = getApprovedGuestPeriod(guest);
  if (!room || !bed || !approvedPeriod.start || !approvedPeriod.end) {
    message.warning('目标床位或审批住宿日期已变化，请重新拖拽');
    return false;
  }
  if (!isDraftPlacementAllowed(room, bed, approvedPeriod.start, approvedPeriod.end)) {
    message.warning('该床位当前不可用或审批住宿日期无效');
    return false;
  }
  const conflicted = hasDraftConflict(guest.id, bed, approvedPeriod.start, approvedPeriod.end);
  if (conflicted && options.rejectOnConflict) {
    message.warning('该床位在审批住宿时间内已被占用');
    return false;
  }
  replacePendingDraft({
    bedId: bed.id,
    endDate: approvedPeriod.end,
    guest,
    roomId: room.id,
    startDate: approvedPeriod.start,
  });
  if (!options.silent) {
    message.success(
      conflicted
        ? '已加入草稿，但目标床位在该时段已有安排，请调整后再保存'
        : '已加入待保存排房草稿，可继续拖动或拉伸日期后统一保存'
    );
  }
  return true;
}

function getBedTargetAtPoint(x: number, y: number) {
  const point = schedulerRef.value?.resourceAtPoint(x, y) as CalendarPointInfo | undefined;
  const resourceProps = point?.resource?.extendedProps;
  const room = resourceProps?.room as DormApi.RoomAllocationRoom | undefined;
  const bed = resourceProps?.bed as DormApi.RoomAllocationBed | undefined;
  if (resourceProps?.kind !== 'bed' || !room || !bed) return;
  return { bedId: bed.id, roomId: room.id };
}

function openDraftSave() {
  if (pendingAllocationDrafts.value.length === 0) return;
  if (hasBlockingConflicts.value) {
    const names = conflictedDrafts.value
      .map((draft) => draft.guest.userName || '未命名住宿人')
      .join('、');
    message.warning(`以下住宿人的草稿与已有安排冲突，请先调整床位或日期再保存：${names}`);
    return;
  }
  if (pendingAllocationDrafts.value.some(isDraftPeriodChanged)) {
    draftReasonDialogOpen.value = true;
    return;
  }
  void submitPendingDrafts();
}

async function submitPendingDrafts() {
  if (hasBlockingConflicts.value) {
    message.warning('存在冲突床位的草稿，请先解决冲突再保存');
    return;
  }
  const changedWithoutReason = pendingAllocationDrafts.value.find(
    (draft) => isDraftPeriodChanged(draft) && !draftReasons.value[draft.guest.id]?.trim()
  );
  if (changedWithoutReason) {
    message.warning(`请填写 ${changedWithoutReason.guest.userName || '该住宿人'} 的日期调整原因`);
    return;
  }
  savingDrafts.value = true;
  try {
    await allocateDormBeds({
      allocations: pendingAllocationDrafts.value.map((draft) => ({
        bedId: draft.bedId,
        endDate: draft.endDate,
        guestId: draft.guest.id,
        operationNo: `BATCH-ROOM-${draft.guest.id}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        reason: isDraftPeriodChanged(draft)
          ? draftReasons.value[draft.guest.id]?.trim()
          : undefined,
        roomId: draft.roomId,
        startDate: draft.startDate,
        version: draft.guest.version,
      })),
    });
    message.success(`已保存 ${pendingAllocationDrafts.value.length} 条排房`);
    draftReasonDialogOpen.value = false;
    clearPendingDrafts();
    await loadBuildingData();
  } finally {
    savingDrafts.value = false;
  }
}

async function focusPendingGuestMonth(guest: DormApi.PendingAllocationGuest) {
  const period = getApprovedGuestPeriod(guest);
  if (!period.start || !period.end || !dayjs(period.start).isValid()) return;
  const targetMonth = dayjs(period.start).startOf('month');
  if (targetMonth.isSame(currentDate.value, 'month')) return;

  currentDate.value = targetMonth;
  try {
    await fetchCalendarEvents();
  } catch {
    // 请求异常由调用层提示；本地占位不受影响，可重新尝试拖拽。
  } finally {
    await nextTick();
    schedulerRef.value?.scrollToDayOffset(0);
  }
}

function updatePendingGuestDropPreview(point: CalendarPointInfo | null) {
  const resourceProps = point?.resource?.extendedProps;
  const room = resourceProps?.room as DormApi.RoomAllocationRoom | undefined;
  const bed = resourceProps?.bed as DormApi.RoomAllocationBed | undefined;
  updatePendingGuestDropPreviewByTarget(room, bed);
}

function updatePendingGuestDropPreviewByTarget(
  room?: DormApi.RoomAllocationRoom,
  bed?: DormApi.RoomAllocationBed
) {
  const guest = draggingGuest.value;
  const period = guest ? getApprovedGuestPeriod(guest) : undefined;
  if (!room || !bed || !period?.start || !period.end) {
    pendingGuestDropPreview.value = undefined;
    return;
  }

  const isOccupied = bed.assignments.some(
    (assignment) =>
      dayjs(assignment.startDate).isBefore(dayjs(period.end)) &&
      dayjs(assignment.endDate).isAfter(dayjs(period.start))
  );
  pendingGuestDropPreview.value = {
    bedId: bed.id,
    end: period.end,
    isAvailable: room.status === 0 && bed.status === 0 && !isOccupied,
    roomId: room.id,
    roomName: `${room.roomAlias || room.roomCode || '未命名房间'} / ${bed.bedCode}`,
    start: period.start,
  };
}

function handleCandidateDragOver({
  target,
}: {
  originalEvent: DragEvent;
  target?: SchedulerPointInfo;
}) {
  if (!canViewPendingOrders.value) return;
  const resourceProps = (target?.resource as CalendarResource | undefined)?.extendedProps;
  if (resourceProps?.kind !== 'bed' || !resourceProps.room || !resourceProps.bed) {
    updatePendingGuestDropPreview(null);
    return;
  }
  updatePendingGuestDropPreviewByTarget(
    resourceProps.room as DormApi.RoomAllocationRoom,
    resourceProps.bed
  );
}

function handleCandidateDragStart(guest: DormApi.PendingAllocationGuest) {
  pendingGuestDropPreview.value = undefined;
  draggingGuest.value = guest;
}

function handleCandidateDragEnd(event?: DragEvent) {
  const guest = draggingGuest.value;
  const preview = pendingGuestDropPreview.value;
  draggingGuest.value = undefined;
  pendingGuestDropPreview.value = undefined;
  // 部分浏览器不会向重型日历组件派发 drop；使用最终鼠标坐标反查床位。
  const target =
    preview?.isAvailable && preview
      ? preview
      : event
      ? getBedTargetAtPoint(event.clientX, event.clientY)
      : undefined;
  if (guest && target && createPendingDraft(guest, target)) {
    void focusPendingGuestMonth(guest);
  }
}

async function handleCandidateDrop({
  originalEvent,
  target,
}: {
  originalEvent: DragEvent;
  target?: SchedulerPointInfo;
}) {
  if (!canViewPendingOrders.value) return;
  const guestId = Number(
    originalEvent.dataTransfer?.getData('application/x-dorm-guest-id') ||
      originalEvent.dataTransfer?.getData('text/plain')
  );
  const guest =
    draggingGuest.value ||
    allocationWorkbench.value?.pendingGuests.find((item) => item.id === guestId);
  const resourceProps = (target?.resource as CalendarResource | undefined)?.extendedProps;
  const room = resourceProps?.room as DormApi.RoomAllocationRoom | undefined;
  const bed = resourceProps?.bed as DormApi.RoomAllocationBed | undefined;
  const bedTarget =
    resourceProps?.kind === 'bed' && room && bed
      ? { bedId: bed.id, roomId: room.id }
      : undefined;
  const dropTarget = bedTarget || pendingGuestDropPreview.value;
  if (!guest || !dropTarget) {
    message.warning('请将待分配人员放到具体床位和日期上');
    return;
  }
  if (createPendingDraft(guest, dropTarget)) {
    draggingGuest.value = undefined;
    pendingGuestDropPreview.value = undefined;
    void focusPendingGuestMonth(guest);
  }
}

async function handleAllocationSuccess() {
  await loadBuildingData();
}

async function handleEventClick({ event }: any) {
  const order = event.extendedProps?.subOrder as DormApi.DormSubOrder | undefined;
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
  if (!selectedBuildId.value || !selectedOrder.value?.endTime || !transferDate.value) {
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
  transferDate.value = dayjs(selectedOrder.value.startTime).format('YYYY-MM-DD');
  transferRoomId.value = undefined;
  transferBedId.value = undefined;
  transferReason.value = '';
  transferOpen.value = true;
  await loadTransferAvailability();
}

// 拉伸事件时（拖拽日历条右边缘调整退宿日期）复用同一个“延期 / 提前退宿”弹窗，
// 因为默认未开启 eventResizableFromStart，拉伸只会改变 endTime，与该弹窗的语义完全一致。
function openPeriodChangeDialog(
  order?: DormApi.DormSubOrder,
  presetEndDate?: string,
  revert?: () => void
) {
  const target = order ?? selectedOrder.value;
  if (!target) return;
  selectedOrder.value = target;
  periodChangeEndDate.value = presetEndDate || target.plannedEndTime || target.endTime || '';
  periodChangeReason.value = '';
  periodChangeRevert = revert;
  periodChangeOpen.value = true;
}

function cancelPeriodChangeDialog() {
  periodChangeRevert?.();
  periodChangeRevert = undefined;
}

function disablePeriodChangeEndDate(value: Dayjs) {
  const start = selectedOrder.value?.plannedStartTime || selectedOrder.value?.startTime;
  return !start || !value.isAfter(dayjs(start), 'day');
}

function handlePeriodChangeEndDate(value: SingleDatePickerValue) {
  periodChangeEndDate.value = getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
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
    periodChangeRevert = undefined;
    detailOpen.value = false;
    await fetchCalendarEvents();
  } catch {
    cancelPeriodChangeDialog();
  } finally {
    periodChangeSubmitting.value = false;
  }
}

// 已排房记录在同一床位内拖动/拉伸日期：不再直接拒绝，弹窗确认新日期区间与调整原因后再保存，
// 取消时把日历上的乐观位移还原（revert 由拖拽/拉伸回调传入）。
function openDragPeriodChange(
  order: DormApi.DormSubOrder,
  startDate: string,
  endDate: string,
  revert?: () => void
) {
  dragPeriodChangeOrder.value = order;
  dragPeriodChangeStart.value = startDate;
  dragPeriodChangeEnd.value = endDate;
  dragPeriodChangeReason.value = '';
  dragPeriodChangeRevert = revert;
  dragPeriodChangeOpen.value = true;
}

function cancelDragPeriodChange() {
  dragPeriodChangeOpen.value = false;
  dragPeriodChangeRevert?.();
  dragPeriodChangeRevert = undefined;
}

function handleDragPeriodChangeStart(value: SingleDatePickerValue) {
  dragPeriodChangeStart.value = getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
}

function handleDragPeriodChangeEnd(value: SingleDatePickerValue) {
  dragPeriodChangeEnd.value = getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
}

async function submitDragPeriodChange() {
  const order = dragPeriodChangeOrder.value;
  if (order && dragPeriodChangeConflicts.value.length > 0) {
    message.warning('新的住宿期与该床位上其他住宿人的安排冲突，请调整日期');
    return;
  }
  if (!order || !canSubmitDragPeriodChange.value) {
    message.warning('请填写有效的日期区间和调整原因');
    return;
  }
  dragPeriodChangeSubmitting.value = true;
  try {
    // 日历拖拽只能对已排房住宿人的“同床位”条目触发（见 handleEventDrop/handleEventResize
    // 里的 order.status !== 1 校验），adjust-period 接口专用于未排房住宿人，
    // 已排房住宿人的同床位日期修正必须走 correction（管理员纠错）接口，否则后端会以
    // “住宿人已排房”拒绝请求。
    await correctRoomAllocationPeriod({
      endDate: dragPeriodChangeEnd.value,
      guestId: order.id,
      operationNo: `PERIOD-CORRECTION-${order.id}-${Date.now()}`,
      reason: dragPeriodChangeReason.value.trim(),
      startDate: dragPeriodChangeStart.value,
      version: order.guestVersion,
    });
    message.success('住宿期已调整');
    dragPeriodChangeOpen.value = false;
    dragPeriodChangeRevert = undefined;
    await fetchCalendarEvents();
  } catch {
    dragPeriodChangeRevert?.();
    dragPeriodChangeRevert = undefined;
  } finally {
    dragPeriodChangeSubmitting.value = false;
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
  transferDate.value = getSingleDatePickerValue(value)?.format('YYYY-MM-DD') ?? '';
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

onMounted(async () => {
  syncCompactLayout();
  schedulerResizeObserver = new ResizeObserver(([entry]) => {
    syncCompactLayout(entry?.contentRect.width);
  });
  if (schedulerPageRef.value) {
    schedulerResizeObserver.observe(schedulerPageRef.value);
  }
  await loadInitialData();
  await nextTick();
  scrollCalendarToFocusDate();
});

onBeforeUnmount(() => {
  schedulerResizeObserver?.disconnect();
  schedulerResizeObserver = null;
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
          <Tag :color="getStatusMeta(selectedOrder.status).color" class="ml-auto">
            {{ getStatusMeta(selectedOrder.status).label }}
          </Tag>
        </div>

        <div class="schedule-detail__actions" aria-label="排房操作">
          <Button
            v-if="canManageSchedule && selectedOrder.status === 1"
            class="schedule-detail__action"
            @click="openPeriodChangeDialog()"
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
          <Button type="primary" class="schedule-detail__action" @click="openOrderDetail">
            <IconifyIcon icon="lucide:arrow-up-right" />
            查看订单
          </Button>
        </div>

        <div class="schedule-detail__period">
          <div>
            <span>入住</span>
            <strong>{{ dayjs(selectedOrder.startTime).format('YYYY-MM-DD') }}</strong>
            <small>{{ formatWeekday(selectedOrder.startTime) }}</small>
          </div>
          <div class="schedule-detail__period-line">
            <span>{{ getOrderDays(selectedOrder) }} 晚</span>
          </div>
          <div class="text-right">
            <span>退宿</span>
            <strong>{{ dayjs(selectedOrder.endTime).format('YYYY-MM-DD') }}</strong>
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
                  <strong>{{ getOperationTypeLabel(history.operationType) }}</strong>
                  <Tag :color="history.recordStatus === 0 ? 'green' : 'default'">
                    {{ history.recordStatus === 0 ? '有效' : '已作废' }}
                  </Tag>
                </div>
                <div class="text-muted-foreground mt-1 text-xs">
                  {{ history.roomName || '未知房间' }} / {{ history.bedCode || '未知床位' }} ·
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
            拖动整段排房可更换床位；拖动或拉伸日期区间可在原床位内调整住宿期，
            松手后会弹窗确认原因再保存。
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
      @cancel="cancelPeriodChangeDialog"
    >
      <div v-if="selectedOrder" class="space-y-5">
        <div class="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
          <strong>{{ selectedOrder.userName || '未填写住客' }}</strong>
          <div class="text-muted-foreground mt-1 text-xs">
            当前住宿期
            {{
              dayjs(selectedOrder.plannedStartTime || selectedOrder.startTime).format('YYYY-MM-DD')
            }}
            至
            {{ dayjs(selectedOrder.plannedEndTime || selectedOrder.endTime).format('YYYY-MM-DD') }}
          </div>
        </div>

        <div>
          <div class="mb-1 text-sm font-medium">新退宿日期</div>
          <DatePicker
            :value="periodChangeEndDate ? dayjs(periodChangeEndDate) : undefined"
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

        <div class="text-muted-foreground rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30">
          延期会继续占用当前最后床位并检查时间冲突；提前退宿会释放退宿日之后的床位。
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="dragPeriodChangeOpen"
      title="确认调整住宿日期"
      width="560px"
      ok-text="确认调整"
      cancel-text="取消"
      :confirm-loading="dragPeriodChangeSubmitting"
      :ok-button-props="{ disabled: !canSubmitDragPeriodChange }"
      @ok="submitDragPeriodChange"
      @cancel="cancelDragPeriodChange"
    >
      <div v-if="dragPeriodChangeOrder" class="space-y-5">
        <div class="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
          <strong>{{ dragPeriodChangeOrder.userName || '未填写住客' }}</strong>
          <div class="text-muted-foreground mt-1 text-xs">
            原住宿期
            {{ dayjs(dragPeriodChangeOrder.startTime).format('YYYY-MM-DD') }}
            至
            {{ dayjs(dragPeriodChangeOrder.endTime).format('YYYY-MM-DD') }}
            ，床位不变
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <div class="mb-1 text-sm font-medium">新入住日期</div>
            <DatePicker
              :value="dragPeriodChangeStart ? dayjs(dragPeriodChangeStart) : undefined"
              class="w-full"
              :allow-clear="false"
              @change="handleDragPeriodChangeStart"
            />
          </div>
          <div>
            <div class="mb-1 text-sm font-medium">新退宿日期</div>
            <DatePicker
              :value="dragPeriodChangeEnd ? dayjs(dragPeriodChangeEnd) : undefined"
              class="w-full"
              :allow-clear="false"
              @change="handleDragPeriodChangeEnd"
            />
          </div>
        </div>

        <div>
          <div class="mb-1 text-sm font-medium">调整原因</div>
          <TextArea
            v-model:value="dragPeriodChangeReason"
            :rows="3"
            :maxlength="255"
            placeholder="请填写日期调整原因"
            show-count
          />
        </div>

        <div
          v-if="dragPeriodChangeConflicts.length > 0"
          class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          新的住宿期与该床位上的
          {{
            dragPeriodChangeConflicts
              .map((item) => item.guestName || '未命名住宿人')
              .join('、')
          }}
          冲突，请调整日期后再保存。
        </div>
        <div v-else class="text-muted-foreground rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30">
          床位保持不变，仅调整入住/退宿日期；取消将撤销刚才在日历上的拖动。
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
          <div class="rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
            <strong>{{ selectedOrder.userName || '未填写住客' }}</strong>
            <div class="text-muted-foreground mt-1 text-xs">
              当前 {{ getOrderRoom(selectedOrder)?.roomAlias || '未知房间' }}， 住宿期
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

          <div class="text-muted-foreground rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30">
            生效日前保留原床位；从生效日开始切换到目标床位，历史记录不会覆盖。
          </div>
        </div>
      </Spin>
    </Modal>

    <Modal
      v-model:open="draftReasonDialogOpen"
      title="填写日期调整原因"
      ok-text="提交"
      cancel-text="继续调整"
      :confirm-loading="savingDrafts"
      @ok="submitPendingDrafts"
    >
      <div class="grid gap-4">
        <template v-for="draft in pendingAllocationDrafts" :key="draft.guest.id">
          <div v-if="isDraftPeriodChanged(draft)">
            <div class="mb-1 flex items-center justify-between gap-3 text-sm font-medium">
              <span>{{ draft.guest.userName || '未填写住客' }}</span>
              <span class="text-destructive text-xs">
                {{ draft.startDate }} 至 {{ draft.endDate }}
              </span>
            </div>
            <TextArea
              v-model:value="draftReasons[draft.guest.id]"
              :maxlength="255"
              :rows="2"
              placeholder="请填写偏离审批住宿日期的原因"
            />
          </div>
        </template>
      </div>
    </Modal>

    <div ref="schedulerPageRef" class="scheduler-page">
      <Card class="scheduler-hero shrink-0" :body-style="{ padding: '16px 20px' }">
        <div class="scheduler-hero__main">
          <div class="flex min-w-0 items-center gap-3">
            <Image.PreviewGroup v-if="currentArea?.images?.length">
              <div class="scheduler-hero__photo">
                <Image :alt="`${currentArea.areaName}区域照片`" :src="currentArea.images[0]" />
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
                <h2 class="text-foreground m-0 text-xl font-semibold">排房管理</h2>
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
              aria-label="选择住宿区域"
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
              aria-label="选择宿舍楼栋"
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

      <section class="scheduler-overview shrink-0" aria-label="当前楼栋概览">
        <div v-for="stat in statCards" :key="stat.label" class="scheduler-overview__item">
          <div class="scheduler-overview__icon">
            <IconifyIcon :icon="stat.icon" :size="18" />
          </div>
          <div>
            <div class="scheduler-overview__label">{{ stat.label }}</div>
            <div class="scheduler-overview__value">
              <strong>{{ stat.value }}</strong>
              <span>{{ stat.suffix }}</span>
            </div>
          </div>
          <span class="scheduler-overview__note">{{ stat.note }}</span>
        </div>
      </section>

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
              <Button
                type="text"
                class="month-arrow"
                aria-label="查看上一个月"
                @click="changeMonth(-1)"
              >
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
              <Button
                type="text"
                class="month-arrow"
                aria-label="查看下一个月"
                @click="changeMonth(1)"
              >
                <IconifyIcon icon="lucide:chevron-right" :size="18" />
              </Button>
            </Tooltip>
            <Button class="today-button" @click="goToCurrentMonth">今天</Button>
          </div>

          <div class="scheduler-filters">
            <Input
              v-model:value="roomKeyword"
              allow-clear
              class="room-search"
              placeholder="搜索房间 / 编号"
            >
              <template #prefix>
                <IconifyIcon icon="lucide:search" class="text-muted-foreground" />
              </template>
            </Input>
            <Select
              v-model:value="selectedFloorId"
              aria-label="筛选楼层"
              allow-clear
              class="filter-select"
              placeholder="全部楼层"
              :options="floorOptions"
            />
            <Select
              v-model:value="selectedStatus"
              aria-label="筛选排房状态"
              allow-clear
              class="filter-select"
              placeholder="全部状态"
              :options="statusOptions"
            />
            <template v-if="pendingDraftCount">
              <Button @click="clearPendingDrafts">清空草稿</Button>
              <Tooltip v-if="hasBlockingConflicts" title="存在冲突床位的草稿，请先调整后再保存">
                <Button danger :loading="savingDrafts" @click="openDraftSave">
                  <IconifyIcon icon="lucide:triangle-alert" :size="14" />
                  {{ conflictedDrafts.length }} 条冲突，无法保存
                </Button>
              </Tooltip>
              <Button v-else type="primary" :loading="savingDrafts" @click="openDraftSave">
                保存排房 ({{ pendingDraftCount }})
              </Button>
            </template>
            <Tooltip title="刷新排房数据">
              <Button
                class="scheduler-refresh-button"
                :loading="refreshing"
                aria-label="刷新排房数据"
                @click="refreshCalendarEvents"
              >
                <IconifyIcon icon="lucide:refresh-cw" :size="16" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div class="scheduler-legend">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span v-for="meta in calendarLegend" :key="meta.status" class="scheduler-legend__item">
              <i :style="{ backgroundColor: meta.color }"></i>
              {{ meta.label }}
            </span>
            <span v-if="pendingDraftCount" class="scheduler-legend__item">
              <i class="scheduler-legend__draft-dot"></i>
              草稿待保存
            </span>
          </div>
          <div class="scheduler-hint">
            <IconifyIcon icon="lucide:mouse-pointer-2" :size="14" />
            <template v-if="canManageSchedule">
              首次排房先拖入草稿；可拖动或拉伸虚线卡片调整床位和日期，最后统一保存
            </template>
            <template v-else>当前为只读模式，可点击排房卡片查看详情</template>
          </div>
        </div>

        <div class="scheduler-workbench">
          <div class="scheduler-calendar-wrap" :class="{ 'is-candidate-dragging': draggingGuest }">
            <Spin :classes="{ root: 'scheduler-spin' }" :spinning="loading">
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
              <ResourceTimelineScheduler
                ref="schedulerRef"
                :style="{ '--past-days': pastDaysInWindow }"
                :resources="calendarResources"
                :events="calendarEvents"
                :date="calendarViewDate"
                :duration-days="calendarDurationDays"
                :highlighted-dates="[areaToday]"
                :editable="canManageSchedule"
                :hidden="!selectedBuildId"
                :event-dragging="isCalendarEventDragging"
                :external-dragging="Boolean(draggingGuest)"
                :resource-label-content="renderResourceLabel"
                :event-content="renderEventContent"
                :day-header-format="formatCalendarDayHeader"
                @event-drag-start="handleEventDragStart"
                @event-drag-stop="handleEventDragStop"
                @event-drop="handleEventDrop"
                @event-resize="handleEventResize"
                @date-click="handleSlotSelect"
                @event-click="handleEventClick"
                @external-dragover="handleCandidateDragOver"
                @external-drop="handleCandidateDrop"
              >
                <template #drag-overlay>
                  <div v-if="draggingGuest" class="scheduler-drop-guide">
                    <span class="scheduler-drop-guide__icon">
                      <IconifyIcon icon="lucide:mouse-pointer-click" :size="17" />
                    </span>
                    <span>
                      正在安排 <strong>{{ draggingGuest.userName }}</strong>
                      <template v-if="pendingGuestDropPreview">
                        · {{ pendingGuestDropPreview.start }} 至 {{ pendingGuestDropPreview.end }} ·
                        {{ pendingGuestDropPreview.roomName }}
                      </template>
                      <template v-else>· 放到具体床位与入住日期</template>
                    </span>
                  </div>
                </template>
              </ResourceTimelineScheduler>
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
              <Tooltip :title="pendingPanelCollapsed ? '展开待分配面板' : '收起待分配面板'">
                <Button
                  type="text"
                  class="pending-panel__toggle"
                  :aria-label="pendingPanelCollapsed ? '展开待分配面板' : '收起待分配面板'"
                  @click="openPendingOrders"
                >
                  <IconifyIcon
                    :icon="
                      pendingPanelCollapsed ? 'lucide:panel-right-open' : 'lucide:panel-right-close'
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
                    <IconifyIcon icon="lucide:search" class="text-muted-foreground" />
                  </template>
                </Input>
              </div>

              <Button
                v-if="canManageSchedule && unassignedPendingGuestCount > 0"
                class="pending-panel__quick-add-all"
                size="small"
                @click="quickAddAllPendingGuests"
              >
                <IconifyIcon icon="lucide:zap" :size="14" />
                一键全部加入日历 ({{ unassignedPendingGuestCount }})
              </Button>

              <div class="pending-panel__body">
                <Empty
                  v-if="visiblePendingGuests.length === 0"
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                  :description="
                    pendingDraftCount
                      ? '待分配人员已加入草稿，可在日历中继续调整'
                      : '暂无待分配住宿人'
                  "
                  class="pending-panel__empty"
                />
                <template v-else>
                  <article
                    v-for="guest in visiblePendingGuests"
                    :key="guest.id"
                    draggable="true"
                    class="pending-guest"
                    :class="{ 'pending-guest--drafted': getPendingDraft(guest.id) }"
                    @dragstart="startPendingGuestDrag(guest, $event)"
                    @dragend="handleCandidateDragEnd($event)"
                  >
                    <div class="pending-guest__main">
                      <span class="pending-guest__avatar">
                        {{ (guest.userName || '住').slice(0, 1).toUpperCase() }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="pending-guest__name">
                          <strong>{{ guest.userName }}</strong>
                          <span>{{ getRequestedRoomTypeLabel(guest.requestedRoomType) }}</span>
                          <Tag
                            v-if="getPendingDraft(guest.id)"
                            color="blue"
                            class="pending-guest__badge"
                          >
                            <IconifyIcon icon="lucide:check" :size="11" />
                            已加入日历
                          </Tag>
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
                      <span>{{ guest.plannedStartDate }} 至 {{ guest.plannedEndDate }}</span>
                    </div>
                    <div class="pending-guest__footer">
                      <template v-if="getPendingDraft(guest.id)">
                        <span
                          class="pending-guest__draft-status"
                          :class="{
                            'pending-guest__draft-status--conflict': isDraftConflicted(
                              getPendingDraft(guest.id)!
                            ),
                          }"
                        >
                          {{ isDraftConflicted(getPendingDraft(guest.id)!) ? '⚠ 冲突：' : '草稿：' }}
                          {{ getPendingDraftTarget(getPendingDraft(guest.id)!) }}
                        </span>
                        <Button type="link" size="small" @click="removePendingDraft(guest.id)">
                          撤销草稿
                        </Button>
                      </template>
                      <template v-else>
                        <span v-if="guest.requestGroupNo">组 {{ guest.requestGroupNo }}</span>
                        <span v-else>拖到床位和日期即可安排</span>
                        <span class="pending-guest__quick-actions">
                          <Button type="link" size="small" @click="quickAddGuestToCalendar(guest)">
                            一键加入日历
                          </Button>
                          <Button type="link" size="small" @click="openPendingGuestAllocation(guest)">
                            直接安排
                          </Button>
                        </span>
                      </template>
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
  container-name: scheduler;
  container-type: inline-size;
}

.scheduler-hero {
  overflow: hidden;
  border-color: hsl(var(--border) / 70%);
  background: radial-gradient(circle at 0 0, hsl(var(--primary) / 8%), transparent 32%),
    hsl(var(--card));
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

.scheduler-hero__selectors {
  padding: 5px;
  background: hsl(var(--background) / 68%);
  border: 1px solid hsl(var(--border) / 72%);
  border-radius: 10px;
}

.scheduler-hero__selectors :deep(.ant-select-selector) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
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

.scheduler-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 72%);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
}

.scheduler-overview__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.scheduler-overview__item + .scheduler-overview__item {
  border-left: 1px solid hsl(var(--border) / 72%);
}

.scheduler-overview__icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 9px;
}

.scheduler-overview__label,
.scheduler-overview__note,
.scheduler-overview__value span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.scheduler-overview__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
}

.scheduler-overview__value strong {
  color: hsl(var(--foreground));
  font-size: 20px;
  line-height: 1.1;
}

.scheduler-overview__note {
  margin-left: auto;
  white-space: nowrap;
}

.scheduler-board {
  overflow: hidden;
  border-color: hsl(var(--border) / 75%);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(15 23 42 / 4%);
}

.scheduler-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
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
  padding: 9px 16px;
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

.scheduler-legend__draft-dot {
  background: repeating-linear-gradient(-45deg, #2563eb, #2563eb 3px, #dbeafe 3px, #dbeafe 6px);
  border: 1px dashed #2563eb;
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

.scheduler-pending-button,
.scheduler-refresh-button {
  position: relative;
  flex: none;
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
  transition: width 180ms ease, min-width 180ms ease;
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
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
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

.pending-guest__draft-status {
  color: #1d4ed8;
  font-weight: 600;
}

.pending-guest__draft-status--conflict {
  color: #dc2626;
}

.pending-guest--drafted {
  background: hsl(var(--muted) / 45%);
  border-style: dashed;
  opacity: 0.72;
}

.pending-guest--drafted:hover {
  opacity: 1;
}

.pending-guest__badge {
  display: inline-flex !important;
  align-items: center;
  gap: 2px;
  font-size: 10px !important;
  line-height: 16px !important;
}

.pending-guest__quick-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.pending-panel__quick-add-all {
  flex: none;
  margin: 0 10px 8px;
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

@container scheduler (max-width: 1120px) {
  .scheduler-toolbar {
    gap: 10px;
  }

  .scheduler-overview__item {
    padding: 10px 12px;
  }

  .scheduler-overview__note,
  .scheduler-pending-button__label {
    display: none;
  }

  .room-search {
    width: 160px;
  }

  .filter-select {
    width: 104px;
  }

  .scheduler-filters {
    flex: 1 1 470px;
    flex-wrap: nowrap;
  }

  .scheduler-pending-button {
    width: 38px;
    padding-inline: 0;
  }

  .scheduler-pending-count {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    color: white;
    line-height: 17px;
    background: hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--card));
  }
}

@container scheduler (max-width: 720px) {
  .scheduler-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .scheduler-filters {
    width: 100%;
    flex: 0 1 auto;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .scheduler-hint {
    margin-left: 0;
  }
}

@container scheduler (max-width: 620px) {
  .scheduler-legend {
    align-items: flex-start;
    flex-direction: column;
  }
}

@container scheduler (max-width: 760px) {
  .scheduler-hero__main {
    align-items: flex-start;
    flex-direction: column;
  }

  .scheduler-hero__selectors {
    width: 100%;
    flex-wrap: wrap;
  }

  .scheduler-hero__selectors .location-select {
    min-width: 180px;
    flex: 1;
  }

  .scheduler-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scheduler-overview__item:nth-child(odd) {
    border-left: 0;
  }

  .scheduler-overview__item:nth-child(n + 3) {
    border-top: 1px solid hsl(var(--border) / 72%);
  }
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

  .scheduler-overview {
    grid-template-columns: repeat(4, minmax(112px, 1fr));
  }

  .scheduler-overview__item {
    padding: 10px 12px;
  }

  .scheduler-overview__note {
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

  .scheduler-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scheduler-overview__item:nth-child(odd) {
    border-left: 0;
  }

  .scheduler-overview__item:nth-child(n + 3) {
    border-top: 1px solid hsl(var(--border) / 72%);
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
  .scheduler-overview {
    grid-template-columns: 1fr;
  }

  .scheduler-overview__item + .scheduler-overview__item {
    border-top: 1px solid hsl(var(--border) / 72%);
    border-left: 0;
  }
}
</style>
