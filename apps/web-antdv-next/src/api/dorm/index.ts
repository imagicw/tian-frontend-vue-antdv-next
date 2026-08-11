import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace DormApi {
  export interface DormArea {
    id?: number;
    regionName?: string;
    areaName: string;
    position?: string;
    timeZone?: string;
    settleCurrencyCode?: string;
    attention?: string;
    images?: string[];
    status?: number;
    createTime?: string;
  }

  export interface DormBuilding {
    id?: number;
    areaId: number;
    buildAdmin?: number[];
    buildNo?: string;
    buildName: string;
    address?: string;
    buildStorey?: number;
    attention?: string;
    status?: number;
    createTime?: string;
  }

  export interface DormRoom {
    id?: number;
    storeyId?: number;
    roomCode?: string;
    roomAlias: string;
    roomType: number; // 1: 单人间, 2: 多人间
    capacity: number;
    settleAmount?: number;
    settleCurrencyCode?: string;
    status?: number; // 0: 空房, 1: 未满, 2: 满房
    checkInNum?: number;
  }

  export interface DormStorey {
    id?: number;
    buildId: number;
    floor: number;
    createTime?: string;
  }

  export interface DormRoomInfo extends DormRoom {
    checkInStatus?: number;
  }

  export interface DormStoreyInfo extends DormStorey {
    roomBaseInfo?: DormRoomInfo[];
  }

  export interface DormBuildingInfo extends DormBuilding {
    storeyBaseInfo?: DormStoreyInfo[];
  }

  export interface CheckInPerson {
    email?: string;
    feeAllocationDepts?: Array<{
      deptId: number;
      deptName: string;
    }>;
    name: string;
  }

  export interface CheckInInfo {
    checkInPersons: CheckInPerson[];
    remark?: string;
    roomType?: number;
  }

  export interface DormOrderSnapshot {
    additionalRequire?: Record<string, any>;
    areaName?: string;
    buildId?: number;
    buildName?: string;
    checkInInfo?: CheckInInfo[];
    images?: string[];
    serveDays?: number;
    serveStartTime?: string;
    serveEndTime?: string;
  }

  export interface DormApply {
    additionalRequire?: Record<string, any>;
    areaTimezone?: string;
    buildId?: number;
    buildInfo?: string;
    buildName?: string;
    checkInInfo?: CheckInInfo[];
    createTime?: number | string;
    day?: number;
    endTime?: string;
    id?: number;
    orderSerial?: string;
    processInstanceId?: string;
    reason?: string;
    startTime?: string;
    status: number; // BPM 状态：1 审批中，2 通过，3 拒绝，4 取消
    userId?: number;
    userName?: string;
  }

  export interface DormSubOrder {
    assignmentId?: number;
    bedId?: number;
    guestVersion?: number;
    id: number;
    orderSerial: string;
    subOrderSerial: string;
    userId: number;
    userName?: string;
    roomId: number;
    roomSnapshot?: DormRoom;
    status: number; // 0: 待入住, 1: 已入住, 2: 已退宿
    startTime?: string;
    endTime?: string;
    plannedStartTime?: string;
    plannedEndTime?: string;
    days?: number;
    remark?: string;
    adjustReason?: string;
    operationType?: string;
    version?: number;
  }

  export interface DormOrder {
    id?: number;
    orderSerial?: string;
    userId?: number;
    userName?: string;
    status: number; // 0: 待分配, 1: 已预订, 2: 已取消, 3: 已结算, 4: 已分摊
    areaTimezone?: string;
    orderFee?: number;
    dormOrderSnapshot?: DormOrderSnapshot;
    dormOrderFeeItemRespVO?: DormOrderFeeItemRespVO;
    reason?: string;
    settleCurrencyCode?: string;
    serveEndTime?: string;
    serveStartTime?: string;
    createTime?: number | string;
  }

  export interface AllocateCheckInInfo {
    areaTimezone: string;
    endTime: string;
    names: string[];
    remark?: string;
    roomId: number;
    startTime: string;
    status: 1 | 2;
  }

  export interface AllocateRoomData {
    allocateCheckInInfo: AllocateCheckInInfo[];
    orderSerial: string;
  }

  export interface RoomAllocationAssignment {
    bedId: number;
    changeReason?: string;
    endDate: string;
    guestId: number;
    guestName?: string;
    guestStatus?: number;
    guestVersion?: number;
    id: number;
    operationType: 'INITIAL' | 'TRANSFER' | string;
    orderStatus?: number;
    orderSerial: string;
    remark?: string;
    roomId: number;
    startDate: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }

  export interface RoomAllocationBed {
    assignments: RoomAllocationAssignment[];
    bedCode: string;
    id: number;
    status: number;
  }

  export interface RoomAllocationHistory {
    bedCode?: string;
    bedId: number;
    changeReason?: string;
    createTime?: string;
    creator?: string;
    endDate: string;
    id: number;
    operationNo: string;
    operationType: string;
    previousAssignmentId?: number;
    recordStatus: number;
    roomId: number;
    roomName?: string;
    startDate: string;
  }

  export interface RoomAllocationRoom {
    beds: RoomAllocationBed[];
    capacity: number;
    floor?: number;
    id: number;
    roomAlias?: string;
    roomCode?: string;
    roomType?: number;
    status: number;
  }

  export interface PendingAllocationGuest {
    adjustReason?: string;
    approvedEndDate?: string;
    approvedStartDate?: string;
    id: number;
    orderSerial: string;
    plannedEndDate: string;
    plannedStartDate: string;
    remark?: string;
    requestGroupNo?: number;
    requestedRoomType?: number;
    userName: string;
    version?: number;
  }

  export interface RoomAllocationWorkbench {
    areaTimezone: string;
    buildId: number;
    buildName: string;
    endDate: string;
    pendingGuests: PendingAllocationGuest[];
    rooms: RoomAllocationRoom[];
    startDate: string;
  }

  export interface RoomAllocationAllocateData {
    bedId?: number;
    endDate: string;
    guestId: number;
    operationNo: string;
    reason?: string;
    roomId: number;
    startDate: string;
    version?: number;
  }

  export interface RoomAllocationTransferData {
    effectiveDate: string;
    guestId: number;
    operationNo: string;
    reason: string;
    targetBedId?: number;
    targetRoomId: number;
    version?: number;
  }

  export interface FeeItem {
    itemName: string;
    userName?: string;
    settleCurrencyCode?: string;
    unitPrice?: number;
    quantity?: number;
    totalPrice?: number;
    remark?: string;
    createTime?: number | string;
  }

  export interface SubOrderFeeItem {
    subOrderSerial: string;
    feeItemList: FeeItem[];
  }

  export interface DormOrderFeeItemRespVO {
    orderSerial?: string;
    orderFeeItemDTOList?: SubOrderFeeItem[];
  }

  export interface SubOrderSettleInfo {
    subOrderSerial: string;
    userName?: string;
    feeItems: FeeItem[];
  }

  export interface SettleOrderData {
    orderSerial: string;
    subOrderSettleInfo: SubOrderSettleInfo[];
  }

  export interface DeptAllocation {
    deptId: number;
    deptName?: string;
    allocationRatio?: number;
    allocatedAmount?: number;
    remark?: string;
    settleCurrencyCode?: string;
  }

  export interface DormFeeAllocation {
    id?: number;
    allocationOrderNo?: string;
    orderCount?: number;
    deptCount?: number;
    settlementYear?: number;
    settlementMonth?: number;
    allocationType?: number; // 1: 按比例, 2: 按金额
    totalAmount?: number;
    settleCurrencyCode?: string;
    remark?: string;
    status?: number; // 0: 有效, 1: 已撤销
    deptAllocations?: DeptAllocation[];
    orders?: DormOrder[];
    creator?: string;
    createTime?: string;
  }

  export interface DormFeeAllocateOrders {
    orderSerialList: string[];
    allocationType: number;
    settlementYear: number;
    settlementMonth?: number;
    remark?: string;
    deptAllocations: DeptAllocation[];
  }
}

const BASE = '/dorm';

// ─── Area ───────────────────────────────────────────────────────────────────
export const getAreaPage = (params: PageParam & Record<string, any>) =>
  requestClient.get<PageResult<DormApi.DormArea>>(`${BASE}/area/page`, {
    params,
  });

export const getAreaSimpleList = () =>
  requestClient.get<DormApi.DormArea[]>(`${BASE}/area/simple-list`);

export const getAreaInfo = (id: number) =>
  requestClient.get<DormApi.DormArea>(`${BASE}/area/get`, { params: { id } });

export const createArea = (data: DormApi.DormArea) =>
  requestClient.post(`${BASE}/area/create`, data);

export const updateArea = (data: DormApi.DormArea) =>
  requestClient.put(`${BASE}/area/update`, data);

export const deleteArea = (id: number) =>
  requestClient.delete(`${BASE}/area/delete`, { params: { id } });

// ─── Building ───────────────────────────────────────────────────────────────
export const getBuildSimpleList = (areaId: number) =>
  requestClient.get<DormApi.DormBuilding[]>(`${BASE}/build/simple-list`, {
    params: { areaId },
  });

export const getBuildInfo = (id: number) =>
  requestClient.get<DormApi.DormBuildingInfo>(`${BASE}/build/query`, {
    params: { id },
  });

export const createBuild = (data: DormApi.DormBuilding) =>
  requestClient.post(`${BASE}/build/create`, data);

export const updateBuild = (data: DormApi.DormBuilding) =>
  requestClient.put(`${BASE}/build/update`, data);

export const deleteBuild = (id: number) =>
  requestClient.delete(`${BASE}/build/delete`, { params: { id } });

// ─── Storey ─────────────────────────────────────────────────────────────────
export const createStorey = (data: DormApi.DormStorey) =>
  requestClient.post(`${BASE}/storey/create`, data);

export const deleteStorey = (id: number) =>
  requestClient.delete(`${BASE}/storey/delete`, { params: { id } });

// ─── Room ───────────────────────────────────────────────────────────────────
export const createRoom = (data: Partial<DormApi.DormRoom>) =>
  requestClient.post(`${BASE}/room/create`, data);

export const updateRoom = (data: Partial<DormApi.DormRoom>) =>
  requestClient.put(`${BASE}/room/update`, data);

export const deleteRoom = (id: number) =>
  requestClient.delete(`${BASE}/room/delete`, { params: { id } });

export const getRoomAvailable = (data: {
  buildId: number;
  endTime: string;
  startTime: string;
}) =>
  requestClient.post<DormApi.DormRoom[]>(
    `${BASE}/room/get-room-available`,
    data,
  );

export const getRoomCalendar = (params: {
  buildId: number;
  startTime: string[];
}) =>
  requestClient.get<DormApi.DormSubOrder[]>(`${BASE}/room/calendar-room`, {
    params,
  });

export const getRoomOrderInfo = (orderSerial: string) =>
  requestClient.get<{
    dormOrderRespVO: DormApi.DormOrder;
    orderDetailRespVOList: DormApi.DormSubOrder[];
  }>(`${BASE}/room/get-room-order-info`, { params: { orderSerial } });

export const allocateDormRooms = (data: DormApi.AllocateRoomData) =>
  requestClient.post(`${BASE}/room/allocate-rooms`, data);

export const cancelDormOrder = (data: {
  orderDetailId?: number;
  orderSerial: string;
}) => requestClient.post(`${BASE}/room/cancel-order`, null, { params: data });

export const changeDormRoom = (data: any) =>
  requestClient.post(`${BASE}/room/change-room`, data);

export const changeDormRoomDate = (data: any) =>
  requestClient.post(`${BASE}/room/change-room-serve-time`, data);

export const getRoomAllocationWorkbench = (params: {
  buildId: number;
  endDate: string;
  startDate: string;
}) =>
  requestClient.get<DormApi.RoomAllocationWorkbench>(
    `${BASE}/room-allocation/workbench`,
    {
      params,
    },
  );

export const getRoomAllocationHistory = (guestId: number) =>
  requestClient.get<DormApi.RoomAllocationHistory[]>(
    `${BASE}/room-allocation/history`,
    {
      params: { guestId },
    },
  );

export const allocateDormBed = (data: DormApi.RoomAllocationAllocateData) =>
  requestClient.post(`${BASE}/room-allocation/allocate`, data);

export const adjustPendingGuestPeriod = (data: {
  endDate: string;
  guestId: number;
  operationNo: string;
  reason: string;
  startDate: string;
  version?: number;
}) => requestClient.post(`${BASE}/room-allocation/adjust-period`, data);

export const changeDormStayPeriod = (data: {
  endDate: string;
  guestId: number;
  operationNo: string;
  reason: string;
  version?: number;
}) => requestClient.post(`${BASE}/room-allocation/change-period`, data);

export const transferDormBed = (data: DormApi.RoomAllocationTransferData) =>
  requestClient.post(`${BASE}/room-allocation/transfer`, data);

// ─── Apply ──────────────────────────────────────────────────────────────────
export const getApplyPage = (params: PageParam & Record<string, any>) =>
  requestClient.get<PageResult<DormApi.DormApply>>(`${BASE}/apply/page`, {
    params,
  });

// ─── Order ──────────────────────────────────────────────────────────────────
export const getOrderPage = (params: PageParam & Record<string, any>) =>
  requestClient.get<PageResult<DormApi.DormOrder>>(`${BASE}/order/page`, {
    params,
  });

export const getMyOrderPage = (params: PageParam & Record<string, any>) =>
  requestClient.get<PageResult<DormApi.DormOrder>>(`${BASE}/order/my/page`, {
    params,
  });

export const settleDormOrder = (data: DormApi.SettleOrderData) =>
  requestClient.post(`${BASE}/room/settle-order`, data);

// ─── Fee Allocation ──────────────────────────────────────────────────────────
export const getAllocationPage = (params: PageParam & Record<string, any>) =>
  requestClient.get<PageResult<DormApi.DormFeeAllocation>>(
    `${BASE}/dept-fee-allocation/page`,
    {
      params,
    },
  );

export const getAllocationDetail = (feeAllocationOrderNo: string) =>
  requestClient.get<DormApi.DormFeeAllocation>(
    `${BASE}/dept-fee-allocation/get/${feeAllocationOrderNo}`,
  );

export const createAllocation = (data: DormApi.DormFeeAllocateOrders) =>
  requestClient.post(`${BASE}/dept-fee-allocation/allocate-by-orders`, data);

export const revokeAllocation = (allocationOrderNo: string) =>
  requestClient.post(`${BASE}/dept-fee-allocation/revoke/${allocationOrderNo}`);
