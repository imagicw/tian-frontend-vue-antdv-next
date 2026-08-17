import { requestClient } from '#/api/request';

export namespace ShipmentApi {
  // ---- Client Profile ----
  export interface ClientProfile {
    id: number;
    clientCode: string;
    clientName: string;
    allowMultiLocation: boolean;
    leadTimeDomestic: number;
    leadTimeOverseas: number;
    allowedPorts?: string;
    allowedContainerTypes?: string;
    consolidationDeliveryDays?: number;
    remark?: string;
    enabled: boolean;
  }

  export interface ClientProfilePageParams {
    pageNo: number;
    pageSize: number;
    clientCode?: string;
    clientName?: string;
    enabled?: boolean;
  }

  // ---- Shipping Number ----
  export interface ShippingNo {
    id: number;
    shippingNo: string;
    costAllocation?: number;
    relatedRefNo?: string;
    createTime?: string;
  }

  export interface ShippingNoPageParams {
    pageNo: number;
    pageSize: number;
    shippingNo?: string;
    relatedRefNo?: string;
  }

  // ---- Product Factory ----
  export interface ProductFactory {
    id: number;
    factoryCode: string;
    factoryNameCn: string;
    factoryNameEn?: string;
    factoryAddress?: string;
    region?: string;
    country?: string;
    location: 'DOMESTIC' | 'OVERSEAS';
    isActive: boolean;
  }

  export interface ProductFactoryPageParams {
    pageNo: number;
    pageSize: number;
    factoryCode?: string;
    factoryName?: string;
    region?: string;
    country?: string;
    location?: string;
    isActive?: boolean;
  }

  // ---- Container Config ----
  export interface ContainerConfig {
    id: number;
    clientCode: string;
    freightForwarder: string;
    productionCountry: string;
    containerType: string;
    minVolume: number;
    maxVolume: number;
    sortOrder?: number;
    enabled: boolean;
  }

  export interface ContainerConfigPageParams {
    pageNo: number;
    pageSize: number;
    clientCode?: string;
    containerType?: string;
  }

  // ---- Packing List ----
  export interface ShipmentAttachment {
    id: number;
    fileId: number;
    type: string;
    sort: number;
    remark?: string;
    url: string;
    name: string;
    size?: number;
    suffix?: string;
    createTime?: string;
  }

  export interface ShipmentPackingList {
    id: number;
    attachments?: ShipmentAttachment[];
    projectNo?: string;
    styleNo?: string;
    shippingCountry?: string;
    sizeGroup?: string;
    sizeDesc?: string;
    productionLocation?: 'DOMESTIC' | 'OVERSEAS';
    productNameCn?: string;
    productNameEn?: string;
    brand?: string;
    isThirdParty?: boolean;
    supplierRef?: string;
    remark?: string;
    createTime?: string;
  }

  export interface ShipmentPackingListPageParams {
    pageNo: number;
    pageSize: number;
    styleNo?: string;
    projectNo?: string;
    brand?: string;
    shippingCountry?: string;
  }

  // ---- Shipment Order ----
  export interface ShipmentOrder {
    id: number;
    odId?: string;
    poNo?: string;
    packId?: string;
    skuCode?: string;
    clientCode?: string;
    color?: string;
    composition?: string;
    unitPrice?: number;
    currency?: string;
    ratioStr?: string;
    sizeDesc?: string;
    deliveryDate?: string;
    totalQty?: number;
    destinationCountry?: string;
    piecesPerPack?: number;
    packsPerCarton?: number;
    cartonNoFrom?: number;
    cartonNoTo?: number;
    qty?: number;
    cartonLength?: number;
    cartonWidth?: number;
    cartonHeight?: number;
    shippingNumberId?: number;
    shippingNo?: string;
    poCountry?: string;
    pkPriority?: string;
    collectionUnitPrice?: number;
    shortShipmentQty?: number;
    productionFactoryId?: number;
    loadingFactoryId?: number;
    grossWeight?: number;
    netWeight?: number;
    cartonUnit?: string;
    totalVolume?: number;
    warehouseDeliveryDate?: string;
    isAirFreight?: boolean;
    airFreightPayer?: string;
    shippingMode?: number;
    remark?: string;
    productionLocation?: 'DOMESTIC' | 'OVERSEAS';
    isFinalConfirmed?: boolean;
    isDraft?: boolean;
    draftVersion?: number;
    status?: string;
    statusName?: string;
    packingListId?: number;
    createTime?: string;
    productionFactoryName?: string;
    loadingFactoryName?: string;
    productionLocationName?: string;
  }

  export interface ShipmentOrderPageParams {
    pageNo: number;
    pageSize: number;
    poNo?: string;
    clientCode?: string;
    shippingNumberId?: number;
    packingListId?: number;
    isFinalConfirmed?: boolean;
    deliveryDateStart?: string;
    deliveryDateEnd?: string;
    isDraft?: boolean;
    status?: string;
  }

  // ---- Booking ----
  export interface ShipmentContainerCargo {
    id: number;
    containerId: number;
    orderId: number;
    poNo?: string;
    cartonNoFrom?: number;
    cartonNoTo?: number;
    loadedCartons?: number;
    loadedQty?: number;
    loadedGrossWeight?: number;
    loadedNetWeight?: number;
    loadedVolume?: number;
    remark?: string;
    createTime?: string;
  }

  export interface ShipmentContainer {
    id: number;
    bookingId: number;
    containerType: string;
    sealNo?: string;
    loadingDate?: string;
    loadingRoute?: string;
    containerSeq?: number;
    totalVolume?: number;
    totalCartons?: number;
    totalQty?: number;
    totalGrossWeight?: number;
    totalNetWeight?: number;
    volumeUtilization?: number;
    cargos?: ShipmentContainerCargo[];
    createTime?: string;
  }

  export interface ShipmentBooking {
    id: number;
    bookingNo?: string;
    bookingType: number;
    bookingTypeName?: string;
    status: string;
    statusName?: string;
    clientCode?: string;
    clientName?: string;
    freightForwarder?: string;
    productionCountry?: string;
    applicantId?: number;
    applicant?: string;
    bookerId?: number;
    booker?: string;
    blNo?: string;
    ensDate?: string;
    vesselDate?: string;
    closingDate?: string;
    isFinalData?: boolean;
    rejectReason?: string;
    cancelReason?: string;
    version?: number;
    ccUserIds?: string;
    remarks?: string;
    createTime?: string;
    orders?: ShipmentOrder[];
    containers?: ShipmentContainer[];
    orderIds?: number[];
  }

  export interface ShipmentBookingPageParams {
    pageNo: number;
    pageSize: number;
    bookingNo?: string;
    bookingType?: number;
    status?: string;
    clientCode?: string;
    applicant?: string;
    createTimeStart?: string;
    createTimeEnd?: string;
  }

  export interface ShipmentBookingSaveParams {
    id?: number;
    bookingNo?: string;
    bookingType: number;
    clientCode: string;
    freightForwarder: string;
    productionCountry: string;
    blNo?: string;
    ensDate?: string;
    vesselDate?: string;
    closingDate?: string;
    isFinalData?: boolean;
    ccUserIds?: string;
    remarks?: string;
    orderIds: number[];
  }

  // ---- Cost Allocation ----
  export interface ShipmentCostAllocationDetail {
    id: number;
    allocationId: number;
    shippingNo?: string;
    poNo?: string;
    packId?: string;
    volume?: number;
    volumeRatio?: number;
    allocatedAmount?: number;
    createTime?: string;
  }

  export interface ShipmentCostAllocation {
    id: number;
    batchNo?: string;
    docNo?: string;
    totalAmount?: number;
    customsFeePerNo?: number;
    currency?: string;
    status?: string;
    statusName?: string;
    operator?: string;
    createTime?: string;
    details?: ShipmentCostAllocationDetail[];
    shippingNos?: string[];
  }

  export interface ShipmentCostAllocationPageParams {
    pageNo: number;
    pageSize: number;
    batchNo?: string;
    docNo?: string;
    status?: string;
    createTimeStart?: string;
    createTimeEnd?: string;
  }

  export interface ShipmentCostAllocationSaveParams {
    id?: number;
    docNo?: string;
    totalAmount: number;
    customsFeePerNo?: number;
    currency?: string;
    shippingNos: string[];
  }

  // ---- Operation Log ----
  export interface ShipmentOperationLog {
    id: number;
    businessType?: string;
    businessId?: number;
    operator?: string;
    operateDesc?: string;
    operateTime?: string;
    createTime?: string;
  }

  export interface ShipmentOperationLogPageParams {
    pageNo: number;
    pageSize: number;
    businessType?: string;
    businessId?: number;
    operator?: string;
  }

  // ---- Consolidation ----
  export interface ShipmentPlanOrder {
    orderId: number;
    poNo?: string;
    styleNo?: string;
    color?: string;
    qty?: number;
    allocatedQty?: number;
    unallocatedQty?: number;
    deliveryDate?: string;
    volume?: number;
    loadingFactoryName?: string;
  }

  export interface ConsolidationPlan {
    planId: string;
    departurePort?: string;
    containerType?: string;
    totalVolume?: number;
    minVolume?: number;
    maxVolume?: number;
    volumeUtilRate?: number;
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
    deliverySpanDays?: number;
    maxAllowedDays?: number;
    shippingNo?: string;
    orders?: ShipmentPlanOrder[];
  }

  export interface ConsolidationSuggestParams {
    clientCode: string;
    bookingType: number;
    containerType: string;
    freightForwarder: string;
    productionCountry: string;
    departurePort?: string;
    orderIds: number[];
    maxAllowedDays?: number;
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
  }

  export interface ConsolidationSuggestResult {
    totalOrders: number;
    matchedOrders: number;
    unmatchedOrders: number;
    plans: ConsolidationPlan[];
    unmatchedOrderList: ShipmentPlanOrder[];
  }

  export interface ConsolidationConfirmPlanItem {
    planId: string;
    departurePort?: string;
    containerType?: string;
    orderIds: number[];
    remarks?: string;
  }

  export interface ConsolidationConfirmParams {
    clientCode: string;
    bookingType: number;
    plans: ConsolidationConfirmPlanItem[];
  }
}

const BASE = '/container';

// ---- Client Profile ----
export function getClientProfilePage(
  params: ShipmentApi.ClientProfilePageParams,
) {
  return requestClient.get(`${BASE}/client-profile/page`, { params });
}
export function getClientProfileSimpleList() {
  return requestClient.get<ShipmentApi.ClientProfile[]>(
    `${BASE}/client-profile/list-enabled`,
  );
}
export function getClientProfileByCode(clientCode: string) {
  return requestClient.get<ShipmentApi.ClientProfile>(
    `${BASE}/client-profile/get-by-code`,
    { params: { clientCode } },
  );
}
export function createClientProfile(data: Partial<ShipmentApi.ClientProfile>) {
  return requestClient.post(`${BASE}/client-profile/create`, data);
}
export function updateClientProfile(
  data: Partial<ShipmentApi.ClientProfile> & { id: number },
) {
  return requestClient.put(`${BASE}/client-profile/update`, data);
}
export function deleteClientProfile(id: number) {
  return requestClient.delete(`${BASE}/client-profile/delete`, {
    params: { id },
  });
}

// ---- Shipping Number ----
export function getShippingNoPage(params: ShipmentApi.ShippingNoPageParams) {
  return requestClient.get(`${BASE}/shipping-number/page`, { params });
}
export function createShippingNo(data: Partial<ShipmentApi.ShippingNo>) {
  return requestClient.post(`${BASE}/shipping-number/create`, data);
}
export function updateShippingNo(
  data: Partial<ShipmentApi.ShippingNo> & { id: number },
) {
  return requestClient.put(`${BASE}/shipping-number/update`, data);
}
export function deleteShippingNo(id: number) {
  return requestClient.delete(`${BASE}/shipping-number/delete`, {
    params: { id },
  });
}

// ---- Product Factory ----
export function getFactoryPage(params: ShipmentApi.ProductFactoryPageParams) {
  return requestClient.get(`${BASE}/factory/page`, { params });
}
export function getFactorySimpleList() {
  return requestClient.get<ShipmentApi.ProductFactory[]>(
    `${BASE}/factory/list-active`,
  );
}
export function createFactory(data: Partial<ShipmentApi.ProductFactory>) {
  return requestClient.post(`${BASE}/factory/create`, data);
}
export function updateFactory(
  data: Partial<ShipmentApi.ProductFactory> & { id: number },
) {
  return requestClient.put(`${BASE}/factory/update`, data);
}
export function deleteFactory(id: number) {
  return requestClient.delete(`${BASE}/factory/delete`, { params: { id } });
}

// ---- Container Config ----
export function getContainerConfigPage(
  params: ShipmentApi.ContainerConfigPageParams,
) {
  return requestClient.get(`${BASE}/container-config/page`, { params });
}
export function getContainerConfigsByClientCode(clientCode: string) {
  return requestClient.get(`${BASE}/container-config/list-by-client-code`, {
    params: { clientCode },
  });
}
export function createContainerConfig(
  data: Partial<ShipmentApi.ContainerConfig>,
) {
  return requestClient.post(`${BASE}/container-config/create`, data);
}
export function updateContainerConfig(
  data: Partial<ShipmentApi.ContainerConfig> & { id: number },
) {
  return requestClient.put(`${BASE}/container-config/update`, data);
}
export function deleteContainerConfig(id: number) {
  return requestClient.delete(`${BASE}/container-config/delete`, {
    params: { id },
  });
}

// ---- Packing List ----
export function getPackingListPage(
  params: ShipmentApi.ShipmentPackingListPageParams,
) {
  return requestClient.get(`${BASE}/packing-list/page`, { params });
}
export function getPackingList(id: number) {
  return requestClient.get<ShipmentApi.ShipmentPackingList>(
    `${BASE}/packing-list/get`,
    { params: { id } },
  );
}
export function createPackingList(
  data: Partial<ShipmentApi.ShipmentPackingList>,
) {
  return requestClient.post(`${BASE}/packing-list/create`, data);
}
export function updatePackingList(
  data: Partial<ShipmentApi.ShipmentPackingList> & { id: number },
) {
  return requestClient.put(`${BASE}/packing-list/update`, data);
}
export function deletePackingList(id: number) {
  return requestClient.delete(`${BASE}/packing-list/delete`, {
    params: { id },
  });
}
export function exportPackingList(id: number) {
  return requestClient.get(`${BASE}/packing-list/export`, {
    params: { id },
    responseType: 'blob',
  });
}

// ---- Shipment Order ----
export function getOrderPage(params: ShipmentApi.ShipmentOrderPageParams) {
  return requestClient.get(`${BASE}/order/page`, { params });
}
export function getOrder(id: number) {
  return requestClient.get<ShipmentApi.ShipmentOrder>(`${BASE}/order/get`, {
    params: { id },
  });
}
export function getNotBookedOrderPage(params: {
  clientCode?: string;
  deliveryDateEnd?: string;
  deliveryDateStart?: string;
  pageNo: number;
  pageSize: number;
  poNo?: string;
  shippingNo?: string;
}) {
  return requestClient.get(`${BASE}/order/list-not-booked`, { params });
}
export function createOrder(data: Partial<ShipmentApi.ShipmentOrder>) {
  return requestClient.post(`${BASE}/order/create`, data);
}
export function updateOrder(
  data: Partial<ShipmentApi.ShipmentOrder> & { id: number },
) {
  return requestClient.put(`${BASE}/order/update`, data);
}
export function deleteOrder(id: number) {
  return requestClient.delete(`${BASE}/order/delete`, { params: { id } });
}
export function publishOrderDraftBatch(ids: number[]) {
  return requestClient.put(`${BASE}/order/publish-draft-batch`, ids);
}
export function confirmOrderFinalBatch(ids: number[]) {
  return requestClient.put(`${BASE}/order/confirm-final-batch`, ids);
}

// ---- Booking ----
export function getBookingPage(params: ShipmentApi.ShipmentBookingPageParams) {
  return requestClient.get(`${BASE}/booking/page`, { params });
}
export function getBookingDetail(id: number) {
  return requestClient.get<ShipmentApi.ShipmentBooking>(
    `${BASE}/booking/get-detail`,
    { params: { id } },
  );
}
export function createBooking(data: ShipmentApi.ShipmentBookingSaveParams) {
  return requestClient.post(`${BASE}/booking/create`, data);
}
export function updateBooking(
  data: ShipmentApi.ShipmentBookingSaveParams & { id: number },
) {
  return requestClient.put(`${BASE}/booking/update`, data);
}
export function deleteBooking(id: number) {
  return requestClient.delete(`${BASE}/booking/delete`, { params: { id } });
}
export function submitBooking(id: number, remarks?: string) {
  return requestClient.post(`${BASE}/booking/submit`, { id, remarks });
}
export function confirmBooking(
  id: number,
  params?: { blNo?: string; closingDate?: string; remarks?: string },
) {
  return requestClient.post(`${BASE}/booking/confirm`, { id, ...params });
}
export function rejectBooking(id: number, rejectReason: string) {
  return requestClient.post(`${BASE}/booking/reject`, { id, rejectReason });
}
export function cancelBooking(id: number, cancelReason: string) {
  return requestClient.post(`${BASE}/booking/cancel`, { id, cancelReason });
}
export function shipBooking(id: number, remarks?: string) {
  return requestClient.post(`${BASE}/booking/ship`, { id, remarks });
}

// ---- Split (Container) ----
export function getContainersByBooking(bookingId: number) {
  return requestClient.get<ShipmentApi.ShipmentContainer[]>(
    `${BASE}/split/list-by-booking`,
    { params: { bookingId } },
  );
}
export function getUnallocatedCargoPool(bookingId: number) {
  return requestClient.get<ShipmentApi.ShipmentPlanOrder[]>(
    `${BASE}/split/unallocated-pool`,
    { params: { bookingId } },
  );
}
export function createContainer(data: {
  bookingId: number;
  containerType: string;
  loadingDate?: string;
  loadingRoute?: string;
  sealNo?: string;
}) {
  return requestClient.post(`${BASE}/split/create`, data);
}
export function updateContainer(data: {
  containerType?: string;
  id: number;
  loadingDate?: string;
  loadingRoute?: string;
  sealNo?: string;
}) {
  return requestClient.put(`${BASE}/split/update`, data);
}
export function deleteContainer(id: number) {
  return requestClient.delete(`${BASE}/split/delete`, { params: { id } });
}

// ---- Cost Allocation ----
export function getCostAllocationPage(
  params: ShipmentApi.ShipmentCostAllocationPageParams,
) {
  return requestClient.get(`${BASE}/cost-allocation/page`, { params });
}
export function getCostAllocationDetail(id: number) {
  return requestClient.get<ShipmentApi.ShipmentCostAllocation>(
    `${BASE}/cost-allocation/get-detail`,
    { params: { id } },
  );
}
export function calculateCostAllocation(data: {
  customsFeePerNo?: number;
  shippingNos: string[];
  totalAmount: number;
}) {
  return requestClient.post<ShipmentApi.ShipmentCostAllocationDetail[]>(
    `${BASE}/cost-allocation/calculate`,
    data,
  );
}
export function saveCostAllocation(
  data: ShipmentApi.ShipmentCostAllocationSaveParams,
) {
  return requestClient.post(`${BASE}/cost-allocation/save`, data);
}
export function revokeCostAllocation(id: number) {
  return requestClient.post(`${BASE}/cost-allocation/revoke`, null, {
    params: { id },
  });
}

// ---- Operation Log ----
export function getOperationLogPage(
  params: ShipmentApi.ShipmentOperationLogPageParams,
) {
  return requestClient.get(`${BASE}/operation-log/page`, { params });
}

// ---- Consolidation ----
export function suggestConsolidation(
  data: ShipmentApi.ConsolidationSuggestParams,
) {
  return requestClient.post<ShipmentApi.ConsolidationSuggestResult>(
    `${BASE}/consolidation/suggest`,
    data,
  );
}
export function confirmConsolidation(
  data: ShipmentApi.ConsolidationConfirmParams,
) {
  return requestClient.post(`${BASE}/consolidation/confirm`, data);
}
