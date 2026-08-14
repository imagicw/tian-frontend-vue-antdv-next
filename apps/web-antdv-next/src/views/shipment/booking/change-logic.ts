import type { ShipmentApi } from '#/api/shipment';

/** 订舱状态：草稿、已驳回时可直接修改订舱基础信息（后端 BookingStatusEnum.canModify）。 */
const MODIFIABLE_BOOKING_STATUSES = new Set([0, 3]);

export function canModifyBooking(status: number | string | undefined): boolean {
  if (status === null || status === undefined) return false;
  return MODIFIABLE_BOOKING_STATUSES.has(Number(status));
}

/**
 * 判断当前用户是否为该 PO 的责任人（PO 创建人）。
 * 与后端 validateChangeOrderEditor 的核心判定一致：仅比较创建人，不做管理员/授权代理的前端猜测。
 */
export function isOrderOwner(
  currentUserId: number | string | undefined,
  order: Pick<ShipmentApi.ShipmentOrder, 'creator'>,
): boolean {
  if (!currentUserId || !order.creator) return false;
  return String(currentUserId) === order.creator;
}

export type RemoveOrderStrategy = 'change' | 'direct';

/**
 * 草稿/已驳回状态的订舱：移出立即生效（POST booking/order/remove）。
 * 已提交/已确认等其它状态：必须通过“待发布变更”协作草稿移出，发布后才生效。
 */
export function resolveRemoveOrderStrategy(
  bookingStatus: number | string | undefined,
): RemoveOrderStrategy {
  return canModifyBooking(bookingStatus) ? 'direct' : 'change';
}

/**
 * 该订舱状态下，移出/编辑 PO 是否存在任何可用路径（直接移出或走变更）。
 * 已取消、已出运等终态两条路径都不可用，不应展示操作入口（避免点了必然失败）。
 */
export function canActOnBookingOrders(
  bookingStatus: number | string | undefined,
): boolean {
  return canModifyBooking(bookingStatus) || canChangeBooking(bookingStatus);
}

/** 订舱状态：仅已提交、已确认可发起/协作变更（后端 validateBookingCanChange）。 */
const CHANGEABLE_BOOKING_STATUSES = new Set([1, 2]);

export function canChangeBooking(status: number | string | undefined): boolean {
  if (status === null || status === undefined) return false;
  return CHANGEABLE_BOOKING_STATUSES.has(Number(status));
}

/**
 * 发起变更：订舱申请人，或本订舱内任意一条 PO 的责任人（与后端 validateChangeInitiator 一致，
 * 管理员豁免不在前端判断，交由后端兜底）。
 */
export function canInitiateChange(
  currentUserId: number | string | undefined,
  booking: Pick<ShipmentApi.ShipmentBooking, 'applicantId' | 'orders'>,
): boolean {
  if (!currentUserId) return false;
  if (String(currentUserId) === String(booking.applicantId ?? '')) {
    return true;
  }
  return (booking.orders ?? []).some((order) =>
    isOrderOwner(currentUserId, order),
  );
}

/**
 * 撤回整份变更：发起人或订舱申请人（与后端 validateChangeCoordinator 一致）。
 */
export function canWithdrawChange(
  currentUserId: number | string | undefined,
  change: Pick<ShipmentApi.ShipmentBookingChange, 'initiatorId'>,
  booking: Pick<ShipmentApi.ShipmentBooking, 'applicantId'>,
): boolean {
  if (!currentUserId) return false;
  return (
    String(currentUserId) === String(change.initiatorId ?? '') ||
    String(currentUserId) === String(booking.applicantId ?? '')
  );
}

/**
 * 发布变更：仅订舱申请人（“创建人”），与撤回不同——发起人若不是订舱申请人无权发布
 * （与后端 validatePublishPermission 一致，它只比较 booking.applicantId）。
 */
export function canPublishChange(
  currentUserId: number | string | undefined,
  booking: Pick<ShipmentApi.ShipmentBooking, 'applicantId'>,
): boolean {
  if (!currentUserId) return false;
  return String(currentUserId) === String(booking.applicantId ?? '');
}

/** 撤回本人在变更草稿内对某条 PO 的改动：本人发起或被授权代办的责任人。 */
export function canWithdrawChangeOrder(
  currentUserId: number | string | undefined,
  changeOrder: Pick<
    ShipmentApi.ShipmentBookingChangeOrder,
    'delegatedForUserId' | 'ownerUserId'
  >,
): boolean {
  if (!currentUserId) return false;
  return (
    String(currentUserId) === String(changeOrder.ownerUserId ?? '') ||
    String(currentUserId) === String(changeOrder.delegatedForUserId ?? '')
  );
}
