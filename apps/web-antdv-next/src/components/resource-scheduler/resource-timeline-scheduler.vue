<script lang="ts" setup>
/**
 * Generic resource-timeline scheduler UI layer built on @event-calendar.
 *
 * Owns: EventCalendar lifecycle, resource/event option sync, layout mechanics
 * (row-height sync, spanning group cells, sidebar scroll shadow, day-width sync,
 * wheel forwarding, external-drag auto-scroll). Does NOT know about any domain
 * (rooms/beds/guests/...) — resource/event `extendedProps` are opaque, and cell
 * content is fully owned by the caller via `resourceLabelContent` / `eventContent`.
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import EventCalendar from '@event-calendar/core';
import Interaction from '@event-calendar/interaction';
import ResourceTimeline from '@event-calendar/resource-timeline';

import '@event-calendar/core/index.css';

export interface SchedulerResource {
  id: string;
  title: string;
  extendedProps?: Record<string, any>;
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  textColor?: string;
  classNames?: string[];
  editable?: boolean;
  startEditable?: boolean;
  durationEditable?: boolean;
  extendedProps?: Record<string, any>;
  styles?: string[];
}

export interface SchedulerPointInfo {
  resource?: SchedulerResource;
  date?: Date;
}

const props = withDefaults(
  defineProps<{
    date: Date;
    dayHeaderFormat?: (date: Date) => string;
    durationDays: number;
    editable?: boolean;
    eventContent: (info: { event: SchedulerEvent }) => { domNodes: Node[] };
    eventDragging?: boolean;
    events: SchedulerEvent[];
    externalDragging?: boolean;
    firstDay?: number;
    hidden?: boolean;
    highlightedDates?: string[];
    locale?: string;
    resourceLabelContent: (info: { resource: SchedulerResource }) => {
      domNodes: Node[];
    };
    resources: SchedulerResource[];
    rowHeight?: number;
    slotWidth?: number;
  }>(),
  {
    dayHeaderFormat: () => (date: Date) => `${date.getDate()}`,
    editable: true,
    eventDragging: false,
    externalDragging: false,
    firstDay: 1,
    highlightedDates: () => [],
    locale: 'zh-CN',
    rowHeight: 52,
    slotWidth: 48,
  },
);
const emit = defineEmits<{
  dateClick: [payload: any];
  eventClick: [payload: any];
  eventDragStart: [];
  eventDragStop: [];
  eventDrop: [payload: any];
  eventResize: [payload: any];
  externalDragover: [
    payload: { originalEvent: DragEvent; target?: SchedulerPointInfo },
  ];
  externalDrop: [
    payload: { originalEvent: DragEvent; target?: SchedulerPointInfo },
  ];
}>();

const DRAG_SCROLL_EDGE = 64;
const DRAG_SCROLL_STEP = 18;

const wrapRef = ref<HTMLElement | null>(null);
const calendarRef = ref<HTMLElement | null>(null);
const isSidebarElevated = ref(false);
const calendarInstance = shallowRef<
  | (EventCalendar & {
      dateFromPoint?: (x: number, y: number) => null | SchedulerPointInfo;
    })
  | null
>(null);

let resizeObserver: null | ResizeObserver = null;
let rowsResizeObserver: null | ResizeObserver = null;
let layoutFrame: null | number = null;

function getScrollElement() {
  return calendarRef.value?.querySelector<HTMLElement>('.ec-body') ?? null;
}

function getDayWidth() {
  return (
    calendarRef.value
      ?.querySelector<HTMLElement>('.ec-body .ec-days .ec-day')
      ?.getBoundingClientRect().width || props.slotWidth
  );
}

function syncDayWidth() {
  if (!calendarRef.value) return;
  calendarRef.value.style.setProperty(
    '--scheduler-day-width',
    `${getDayWidth()}px`,
  );
}

// Row sizing reads a small DOM contract from the caller's `resourceLabelContent` output:
// a row marked `.calendar-timeline-row--floor`-eligible via a `.calendar-floor-row`
// descendant gets the floor row height; a first-of-span row carries the CSS var
// `--room-row-span` on a `.calendar-resource-row--first` element containing a
// `.calendar-room-cell--primary` cell, which is stretched to cover its sibling rows.
// This mirrors the original dorm scheduler's layout contract verbatim (kept unrenamed
// to avoid decoupling the JS side from the CSS that still ships with each consumer).
function syncResourceRowHeights() {
  const rows = [
    ...(calendarRef.value?.querySelectorAll<HTMLElement>(
      '.ec-sidebar .ec-resource',
    ) ?? []),
  ];
  const timelineRows = [
    ...(calendarRef.value?.querySelectorAll<HTMLElement>('.ec-body .ec-days') ??
      []),
  ];
  rows.forEach((row, rowIndex) => {
    const timelineRow = timelineRows[rowIndex];
    if (!timelineRow) return;
    const isFloorRow = Boolean(row.querySelector('.calendar-floor-row'));
    timelineRow.classList.toggle('calendar-timeline-row--floor', isFloorRow);
    const isDisabledRow = Boolean(
      row.querySelector('.calendar-bed-slot--disabled'),
    );
    timelineRow.classList.toggle(
      'calendar-timeline-row--disabled',
      isDisabledRow,
    );
    for (const el of [timelineRow, row]) {
      el.style.setProperty('flex-basis', `${props.rowHeight}px`, 'important');
      el.style.setProperty('min-height', `${props.rowHeight}px`, 'important');
      el.style.setProperty('max-height', `${props.rowHeight}px`, 'important');
    }
    const timelineHeight = timelineRow.getBoundingClientRect().height;
    row.style.setProperty('max-height', `${timelineHeight}px`, 'important');
  });
  rows.forEach((row, rowIndex) => {
    const resourceRow = row.querySelector<HTMLElement>(
      '.calendar-resource-row--first',
    );
    const roomCell = resourceRow?.querySelector<HTMLElement>(
      '.calendar-room-cell--primary',
    );
    if (!resourceRow || !roomCell) return;
    const rowSpan = Math.max(
      1,
      Number(resourceRow.style.getPropertyValue('--room-row-span')) || 1,
    );
    const roomHeight = rows
      .slice(rowIndex, rowIndex + rowSpan)
      .reduce((height, currentRow) => {
        return height + currentRow.getBoundingClientRect().height;
      }, 0);
    roomCell.style.height = `${roomHeight}px`;
  });
  syncDayWidth();
  syncScrollRanges();
}

function syncSidebarScrollShadow() {
  const scrollElement = getScrollElement();
  isSidebarElevated.value = Boolean(
    scrollElement && scrollElement.scrollLeft > 0.5,
  );
}

function handleCalendarScroll() {
  syncSidebarScrollShadow();
}

function syncScrollRanges() {
  const scrollElement = getScrollElement();
  const sidebarContent = calendarRef.value?.querySelector<HTMLElement>(
    '.ec-sidebar .ec-content',
  );
  if (!scrollElement || !sidebarContent || !calendarRef.value) return;
  const currentSpacer =
    Number.parseFloat(
      getComputedStyle(calendarRef.value).getPropertyValue(
        '--scheduler-sidebar-scroll-spacer',
      ),
    ) || 0;
  const timelineRange = scrollElement.scrollHeight - scrollElement.clientHeight;
  const sidebarRange =
    sidebarContent.scrollHeight - sidebarContent.clientHeight;
  const nextSpacer = Math.max(0, currentSpacer + timelineRange - sidebarRange);
  if (Math.abs(nextSpacer - currentSpacer) > 0.5) {
    calendarRef.value.style.setProperty(
      '--scheduler-sidebar-scroll-spacer',
      `${nextSpacer}px`,
    );
  }
  syncSidebarScrollShadow();
}

function observeRows() {
  rowsResizeObserver?.disconnect();
  rowsResizeObserver = new ResizeObserver(syncResourceRowHeights);
  const rows =
    calendarRef.value?.querySelectorAll<HTMLElement>(
      '.ec-sidebar .ec-resource',
    ) ?? [];
  rows.forEach((row) => rowsResizeObserver?.observe(row));
  syncResourceRowHeights();
}

function scheduleLayoutSync() {
  if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      observeRows();
    });
  });
}

function handleInteractionLayoutChange() {
  // event-calendar rebuilds resource label DOM nodes on drag/resize; re-observe
  // and re-apply row/span heights afterwards.
  observeRows();
  scheduleLayoutSync();
}

function handleWheel(event: WheelEvent) {
  const target = event.target;
  if (
    !wrapRef.value ||
    !(target instanceof Node) ||
    !wrapRef.value.querySelector('.ec-sidebar')?.contains(target)
  ) {
    return;
  }
  const scrollElement = getScrollElement();
  if (!scrollElement) return;
  event.preventDefault();
  scrollElement.scrollBy({
    behavior: 'auto',
    left: event.deltaX,
    top: event.deltaY,
  });
}

function resourceAtPoint(x: number, y: number): SchedulerPointInfo | undefined {
  const instance = calendarInstance.value;
  if (!instance) return undefined;
  const point = instance.dateFromPoint?.(x, y);
  const resource =
    point?.resource ||
    (() => {
      const rows = [
        ...(calendarRef.value?.querySelectorAll<HTMLElement>(
          '.ec-sidebar .ec-resource',
        ) ?? []),
      ];
      const resourceIndex = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      });
      return resourceIndex === -1 ? undefined : props.resources[resourceIndex];
    })();
  if (!resource) return undefined;
  return { date: point?.date, resource };
}

function autoScrollNearEdge(event: DragEvent) {
  const scrollElement = getScrollElement();
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

function handleWrapperDragOver(event: DragEvent) {
  const target = resourceAtPoint(event.clientX, event.clientY);
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = target ? 'copy' : 'none';
  emit('externalDragover', { originalEvent: event, target });
  if (target) autoScrollNearEdge(event);
}

function handleWrapperDrop(event: DragEvent) {
  const target = resourceAtPoint(event.clientX, event.clientY);
  emit('externalDrop', { originalEvent: event, target });
}

function scrollToDayOffset(days: number) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollElement = getScrollElement();
      if (!scrollElement) return;
      syncDayWidth();
      scrollElement.scrollLeft = Math.max(0, days * getDayWidth());
    });
  });
}

function revertChange(revert?: () => void) {
  revert?.();
  void nextTick().then(() => handleInteractionLayoutChange());
}

function updateCalendarOptions() {
  const instance = calendarInstance.value;
  if (!instance) return;
  instance.setOption('resources', props.resources);
  instance.setOption('events', props.events);
  instance.setOption('highlightedDates', props.highlightedDates);
  scheduleLayoutSync();
}

function initCalendar() {
  if (!calendarRef.value) return;
  calendarInstance.value = new EventCalendar({
    target: calendarRef.value,
    props: {
      plugins: [ResourceTimeline, Interaction],
      options: {
        view: 'resourceTimelineMonth',
        date: props.date,
        duration: { days: props.durationDays },
        firstDay: props.firstDay,
        locale: props.locale,
        resources: props.resources,
        events: props.events,
        headerToolbar: { start: '', center: '', end: '' },
        dayHeaderFormat: props.dayHeaderFormat,
        height: 'auto',
        highlightedDates: props.highlightedDates,
        slotDuration: { days: 1 },
        slotWidth: props.slotWidth,
        slotHeight: props.rowHeight,
        editable: props.editable,
        selectable: false,
        eventContent: props.eventContent,
        resourceLabelContent: props.resourceLabelContent,
        eventDragStart: () => {
          handleInteractionLayoutChange();
          emit('eventDragStart');
        },
        eventDragStop: () => {
          handleInteractionLayoutChange();
          emit('eventDragStop');
        },
        eventDrop: (payload: any) => emit('eventDrop', payload),
        eventResizeStart: handleInteractionLayoutChange,
        eventResizeStop: handleInteractionLayoutChange,
        eventResize: (payload: any) => emit('eventResize', payload),
        dateClick: (payload: any) => emit('dateClick', payload),
        eventClick: (payload: any) => emit('eventClick', payload),
        nowIndicator: true,
      },
    },
  } as any);
  scheduleLayoutSync();
}

watch(
  () => [props.resources, props.events, props.highlightedDates],
  updateCalendarOptions,
);

watch(
  () => [props.date, props.durationDays],
  () => {
    const instance = calendarInstance.value;
    if (!instance) return;
    instance.setOption('date', props.date);
    instance.setOption('duration', { days: props.durationDays });
    updateCalendarOptions();
  },
);

defineExpose({
  getScrollElement,
  resourceAtPoint,
  revertChange,
  scrollToDayOffset,
});

onMounted(async () => {
  await nextTick();
  initCalendar();
  calendarRef.value?.addEventListener('scroll', handleCalendarScroll, true);
  resizeObserver = new ResizeObserver(scheduleLayoutSync);
  if (wrapRef.value) resizeObserver.observe(wrapRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  rowsResizeObserver?.disconnect();
  rowsResizeObserver = null;
  if (layoutFrame !== null) {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
  }
  calendarRef.value?.removeEventListener('scroll', handleCalendarScroll, true);
  calendarInstance.value?.destroy();
  calendarInstance.value = null;
});

const wrapClasses = computed(() => ({
  'is-external-dragging': props.externalDragging,
}));
</script>

<template>
  <div
    ref="wrapRef"
    class="ec-scheduler-wrap"
    :class="wrapClasses"
    @dragenter.prevent
    @dragover.prevent="handleWrapperDragOver"
    @drop.prevent="handleWrapperDrop"
  >
    <slot name="drag-overlay"></slot>
    <div
      ref="calendarRef"
      class="ec-scheduler"
      :class="{
        'ec-scheduler--event-dragging': eventDragging || externalDragging,
        'ec-scheduler--hidden': hidden,
        'ec-scheduler--sidebar-elevated': isSidebarElevated,
      }"
      @wheel="handleWheel"
    ></div>
  </div>
</template>

<style scoped>
.ec-scheduler-wrap {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.ec-scheduler {
  --scheduler-room-width: 208px;
  --scheduler-row-height: 52px;
  --scheduler-floor-row-height: 52px;
  --scheduler-sidebar-scroll-spacer: 0px;
  --scheduler-sidebar-width: 324px;
  --scheduler-slot-width: 48px;
  --scheduler-day-width: 48px;
  --ec-accent-color: hsl(var(--primary) / 35%);
  --ec-bg-color: hsl(var(--card));
  --ec-border-color: hsl(var(--border) / 58%);
  --ec-highlight-color: hsl(var(--primary) / 10%);
  --ec-text-color: hsl(var(--foreground));
  --ec-today-bg-color: hsl(var(--primary) / 8%);

  height: 100%;
  padding: 0;
}

.ec-scheduler--hidden {
  visibility: hidden;
}

.ec-scheduler :deep(.ec) {
  max-height: 100%;
  font-family: inherit;
  font-size: 12px;
  color: hsl(var(--foreground));
}

.ec-scheduler :deep(.ec-toolbar) {
  display: none;
}

.ec-scheduler :deep(.ec-main) {
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border: 0;
}

.ec-scheduler :deep(.ec-sidebar) {
  position: relative;
  z-index: 4;
  width: var(--scheduler-sidebar-width);
  min-width: var(--scheduler-sidebar-width);
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border-inline-end: 1px solid hsl(var(--border) / 80%);
  isolation: isolate;
  transition: box-shadow 160ms ease;
}

/* 仅在右侧时间轴滚动到固定列下方时显出分层阴影。 */
.ec-scheduler :deep(.ec-container > .ec-sidebar::after) {
  position: absolute;
  top: 0;
  right: -10px;
  bottom: 0;
  z-index: 1;
  width: 10px;
  pointer-events: none;
  content: '';
  background: linear-gradient(to right, rgb(15 23 42 / 14%), transparent);
  opacity: 0;
  transition: opacity 160ms ease;
}

.ec-scheduler.ec-scheduler--sidebar-elevated :deep(.ec-sidebar) {
  box-shadow: 8px 0 18px -11px hsl(var(--foreground) / 34%);
}

.ec-scheduler.ec-scheduler--sidebar-elevated
  :deep(.ec-container > .ec-sidebar::after) {
  opacity: 1;
}

.ec-scheduler :deep(.ec-sidebar .ec-content::after) {
  flex: 0 0 var(--scheduler-sidebar-scroll-spacer);
  width: 1px;
  content: '';
}

.ec-scheduler :deep(.ec-header .ec-sidebar) {
  position: sticky;
  left: 0;
  z-index: 5;
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
  box-shadow: none;
  isolation: isolate;
}

.ec-scheduler :deep(.ec-header .ec-sidebar::after) {
  position: absolute;
  top: 50%;
  left: 18px;
  z-index: 1;
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--foreground) / 82%);
  content: '房间信息';
  transform: translateY(-50%);
}

.ec-scheduler :deep(.ec-header .ec-sidebar::before) {
  position: absolute;
  top: 50%;
  left: calc(var(--scheduler-room-width) + 18px);
  z-index: 1;
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--foreground) / 82%);
  content: '床位';
  transform: translateY(-50%);
}

.ec-scheduler :deep(.ec-header) {
  z-index: 7;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 30%);
  box-shadow: 0 2px 8px rgb(15 23 42 / 4%);
}

.ec-scheduler :deep(.ec-day-head) {
  min-height: 48px;
  padding-top: 8px;
  font-size: 12px;
  font-weight: 550;
  text-align: center;
}

.ec-scheduler :deep(.ec-day-head time) {
  display: block;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  color: hsl(var(--muted-foreground));
  white-space: pre-line;
}

.ec-scheduler :deep(.ec-day-head.ec-sat),
.ec-scheduler :deep(.ec-day-head.ec-sun) {
  background: hsl(var(--muted) / 34%);
}

.ec-scheduler :deep(.ec-day-head.ec-today) {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  box-shadow: inset 0 -2px 0 hsl(var(--primary) / 65%);
}

.ec-scheduler :deep(.ec-day-head.ec-today time) {
  font-weight: 700;
  color: hsl(var(--primary));
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
  font-size: 11px;
  font-weight: 650;
  color: hsl(var(--foreground) / 75%);
  letter-spacing: 0.04em;
  background: hsl(var(--muted) / 42%);
}

.ec-scheduler :deep(.ec-timeline .ec-sidebar .ec-resource) {
  position: relative;
  align-items: center;
  padding: 0;
  overflow: visible;
  font-size: 12px;
  text-align: left;
  background: hsl(var(--card));
  border-block-end: 0;
}

.ec-scheduler :deep(.ec-timeline .ec-sidebar .ec-resource),
.ec-scheduler :deep(.ec-timeline .ec-body .ec-days) {
  box-sizing: border-box;
  flex: 0 0 var(--scheduler-row-height) !important;
  min-height: var(--scheduler-row-height);
  max-height: var(--scheduler-row-height);
}

.ec-scheduler
  :deep(.ec-timeline .ec-sidebar .ec-resource:has(.calendar-floor-row)),
.ec-scheduler
  :deep(.ec-timeline .ec-body .ec-days.calendar-timeline-row--floor) {
  flex: 0 0 var(--scheduler-floor-row-height) !important;
  min-height: var(--scheduler-floor-row-height);
  max-height: var(--scheduler-floor-row-height);
}

.ec-scheduler :deep(.ec-timeline .ec-sidebar .ec-resource:last-child),
.ec-scheduler :deep(.ec-timeline .ec-body .ec-days:last-child) {
  flex-grow: 0 !important;
}

/* 时间轴与资源列的滚动内容均以这条线收尾，避免末行底边缺失。 */
.ec-scheduler :deep(.ec-timeline .ec-sidebar .ec-content),
.ec-scheduler :deep(.ec-timeline .ec-body .ec-content) {
  box-shadow: inset 0 -1px 0 hsl(var(--border) / 90%);
}

.ec-scheduler :deep(.ec-timeline .ec-sidebar .ec-resource > span) {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
  padding-top: 0;
}

.ec-scheduler :deep(.calendar-resource-row) {
  position: relative;
  display: grid;
  grid-template-columns: var(--scheduler-room-width) minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 100%;
  background: hsl(var(--card));
}

.ec-scheduler :deep(.calendar-resource-row--even) {
  background: color-mix(in srgb, hsl(var(--muted)) 16%, hsl(var(--card)));
}

/* 首床位行承载跨行房间单元格，始终覆盖后续床位行的房间列。 */
.ec-scheduler
  :deep(.ec-sidebar .ec-resource:has(.calendar-resource-row--first)) {
  z-index: 1;
}

.ec-scheduler :deep(.calendar-room-cell) {
  position: relative;
  display: flex;
  flex-direction: column;
  grid-column: 1;
  justify-content: center;
  min-width: 0;
  height: 100%;
  padding: 7px 12px 7px 14px;
  background: color-mix(in srgb, hsl(var(--muted)) 25%, hsl(var(--card)));
  border-right: 1px solid hsl(var(--border) / 65%);
  border-bottom: 1px solid hsl(var(--border) / 36%);
}

.ec-scheduler :deep(.calendar-room-cell--primary) {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  width: var(--scheduler-room-width);

  /* 资源列表重建时立即保持跨床位高度，避免等待布局同步而闪现为单行。 */
  height: calc(var(--scheduler-row-height) * var(--room-row-span));
  border-bottom-color: hsl(var(--border) / 90%);
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
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.ec-scheduler :deep(.calendar-room-cell__top strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 650;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-room-cell__meta) {
  margin-top: 4px;
  font-size: 10px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
}

.ec-scheduler :deep(.calendar-bed-slot) {
  display: flex;
  grid-column: 2;
  gap: 8px;
  align-items: center;
  height: 100%;
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

/* 停用房间/床位的右侧时间轴通道用斜纹提示不能排房；左侧标签和楼层行沿用
   原有纯色底，不额外置灰。斜纹透明度调高，避免遮住时间轴上的事件条。 */
.ec-scheduler :deep(.ec-body .calendar-timeline-row--disabled) {
  cursor: not-allowed;
  background: repeating-linear-gradient(
    -45deg,
    rgb(203 213 225 / 50%),
    rgb(203 213 225 / 50%) 6px,
    rgb(241 245 249 / 50%) 6px,
    rgb(241 245 249 / 50%) 12px
  ) !important;
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

.ec-scheduler :deep(.ec-body .calendar-timeline-row--floor) {
  background: repeating-linear-gradient(
    -45deg,
    rgb(203 213 225 / 50%),
    rgb(203 213 225 / 50%) 6px,
    rgb(241 245 249 / 50%) 6px,
    rgb(241 245 249 / 50%) 12px
  );
}

.ec-scheduler--event-dragging :deep(.calendar-floor-toggle) {
  pointer-events: none;
  cursor: not-allowed;
}

.ec-scheduler :deep(.calendar-floor-toggle) {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.ec-scheduler :deep(.calendar-floor-toggle__chevron) {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 0;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 7px;
}

.ec-scheduler :deep(.calendar-floor-toggle__chevron),
.ec-scheduler :deep(.calendar-bed-slot__icon) {
  align-self: center;
}

/* Iconify 的 SVG 在床位徽标中会保留基线偏移，显式上移至徽标几何中心。 */
.ec-scheduler :deep(.calendar-floor-toggle__chevron > *),
.ec-scheduler :deep(.calendar-bed-slot__icon > *) {
  display: block;
  width: 14px;
  height: 14px;
  margin: 0;
  vertical-align: 0;
  transform: translateY(-4px);
}

.ec-scheduler :deep(.calendar-floor-toggle strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-floor-toggle__meta) {
  margin-left: auto;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-bed-slot__info) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
  min-width: 0;
}

.ec-scheduler :deep(.calendar-bed-slot__info strong) {
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  color: hsl(var(--foreground));
}

.ec-scheduler :deep(.calendar-bed-slot__info span) {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 10px;
  line-height: 1;
}

.ec-scheduler :deep(.calendar-bed-slot__info span::before) {
  width: 5px;
  height: 5px;
  content: '';
  background: #10b981;
  border-radius: 50%;
}

.ec-scheduler :deep(.calendar-bed-slot__info .is-disabled::before) {
  background: #94a3b8;
}

.ec-scheduler :deep(.calendar-bed-slot__icon) {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  line-height: 0;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 14%);
  border-radius: 8px;
}

.ec-scheduler :deep(.ec-body) {
  position: relative;
}

.ec-scheduler :deep(.ec-body::after) {
  display: none;
}

/* 历史日期遮罩属于完整滚动内容，而不是仅覆盖当前可视窗口。 */
.ec-scheduler :deep(.ec-body .ec-content::after) {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  width: calc(var(--past-days) * var(--scheduler-day-width));
  pointer-events: none;
  content: '';
  background: rgb(148 163 184 / 7%);
  box-shadow: inset -1px 0 0 rgb(100 116 139 / 14%);
}

.ec-scheduler :deep(.ec-event) {
  --calendar-event-status-color: #64748b;

  top: calc((var(--scheduler-row-height) - 40px) / 2 - 1px);
  block-size: 40px;
  min-height: 40px;
  overflow: hidden;
  cursor: pointer;
  border-color: color-mix(
    in srgb,
    var(--calendar-event-status-color) 32%,
    hsl(var(--border))
  );
  border-style: solid;
  border-width: 1px 1px 1px 4px;
  border-left-color: var(--calendar-event-status-color);
  border-radius: 8px;
  box-shadow: 0 2px 5px rgb(15 23 42 / 10%);
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
  --calendar-event-status-color: #059669;
}

.ec-scheduler :deep(.calendar-event--status-4) {
  --calendar-event-status-color: #7c3aed;
}

.ec-scheduler :deep(.ec-event:hover) {
  z-index: 5;
  box-shadow: 0 3px 9px rgb(15 23 42 / 16%);
  filter: saturate(1.08);
}

.ec-scheduler :deep(.calendar-event--drop-preview) {
  z-index: 6;
  pointer-events: none;
  cursor: copy;
  border-style: dashed;
  border-width: 2px;
  box-shadow: none;
  opacity: 0.96;
}

.ec-scheduler :deep(.calendar-event--drop-preview-available) {
  --calendar-event-status-color: #2563eb;

  background: repeating-linear-gradient(
    -45deg,
    #dbeafe,
    #dbeafe 7px,
    #eff6ff 7px,
    #eff6ff 14px
  ) !important;
  border-color: #2563eb;
}

.ec-scheduler :deep(.calendar-event--drop-preview-unavailable) {
  --calendar-event-status-color: #dc2626;

  background: repeating-linear-gradient(
    -45deg,
    #fee2e2,
    #fee2e2 7px,
    #fff1f2 7px,
    #fff1f2 14px
  ) !important;
  border-color: #dc2626;
}

.ec-scheduler :deep(.calendar-event--pending-draft) {
  --calendar-event-status-color: #2563eb;

  z-index: 5;
  cursor: move;
  background: repeating-linear-gradient(
    -45deg,
    #dbeafe,
    #dbeafe 7px,
    #eff6ff 7px,
    #eff6ff 14px
  ) !important;
  border: 2px dashed #2563eb;
  box-shadow: none;
}

/*
 * 拖入的床位已有入住安排（或与其他草稿冲突）：草稿在更高层级、向下叠放在原安排/更早的
 * 草稿上方，原安排/更早的草稿保持原有位置和大小不变，露出上方一条边方便识别和点击。
 * 具体的层级偏移量（margin-top / height / z-index）按冲突层级动态计算，
 * 通过 event-calendar 的 event.styles 内联样式下发（见 getDraftConflictStyles），
 * 这里只负责冲突态的配色，不再写死位置，避免多个互相冲突的草稿样式完全相同。
 */
.ec-scheduler :deep(.calendar-event--pending-draft-conflict) {
  --calendar-event-status-color: #dc2626;

  background: repeating-linear-gradient(
    -45deg,
    #fecaca,
    #fecaca 7px,
    #fee2e2 7px,
    #fee2e2 14px
  ) !important;
  border: 2px dashed #dc2626;
  box-shadow: 0 4px 10px rgb(220 38 38 / 28%);
}

.ec-scheduler
  :deep(.calendar-event--pending-draft-conflict .calendar-draft-content) {
  padding-block: 2px;
  line-height: 1;
}

.ec-scheduler :deep(.calendar-event-content) {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 9px;
  line-height: 30px;
}

.ec-scheduler :deep(.calendar-event-content::before) {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 0;
  width: var(--history-ratio);
  pointer-events: none;
  content: '';
  background: rgb(248 250 252 / 48%);
}

.ec-scheduler :deep(.calendar-event-content > *) {
  position: relative;
  z-index: 1;
}

.ec-scheduler :deep(.calendar-event-badge) {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  font-size: 9px;
  line-height: 1;
  color: #fff;
  cursor: pointer;
  background: rgb(15 23 42 / 78%);
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 50%;
}

.ec-scheduler :deep(.calendar-event-content strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-event-content span) {
  flex: none;
  font-size: 10px;
  opacity: 0.75;
}

.ec-scheduler :deep(.calendar-drop-preview-content) {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 8px;
  line-height: 30px;
}

.ec-scheduler :deep(.calendar-drop-preview-content strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-drop-preview-content span) {
  flex: none;
  font-size: 10px;
  opacity: 0.84;
}

.ec-scheduler :deep(.calendar-draft-content) {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 8px;
  line-height: 30px;
}

.ec-scheduler :deep(.calendar-draft-content strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.ec-scheduler :deep(.calendar-draft-content span) {
  flex: none;
  font-size: 10px;
  opacity: 0.84;
}

.ec-scheduler :deep(.calendar-event--history) {
  opacity: 0.58;
  filter: saturate(0.55);
}

.ec-scheduler :deep(.calendar-event--locked) {
  cursor: not-allowed;
  filter: saturate(0.45);
}

.ec-scheduler :deep(.calendar-event--not-reallocatable) {
  cursor: not-allowed;
  outline: 1.5px dashed rgb(0 0 0 / 35%);
  outline-offset: -1.5px;
}

.ec-scheduler :deep(.calendar-event--guest-highlight) {
  z-index: 3;
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 25%);
}
</style>
