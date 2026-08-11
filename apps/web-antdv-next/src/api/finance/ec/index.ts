import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace FinanceEcApi {
  export interface ECSkuMapping {
    id?: number;
    platform: string;
    originalSku: string;
    gtSku: string;
    productName?: string;
    creator?: string;
    updater?: string;
    createTime?: string;
    updateTime?: string;
  }

  export interface ECInventory {
    id: number;
    platform: string;
    gtSku: string;
    customsNo: string;
    shipmentNo: string;
    unitCost: number;
    initialQuantity: number;
    remainingQuantity: number;
    batchStatus: string;
    version: number;
    creator?: string;
    updater?: string;
    createTime?: string;
    updateTime?: string;
  }

  export interface ECInventoryLog {
    id: number;
    batchId: number;
    gtSku: string;
    shipmentNo: string;
    changeQty: number;
    currentRemaining: number;
    operationType: string;
    relatedOrderNo: string;
    relatedTaskId: number;
    remark: string;
    creator?: string;
    updater?: string;
    createTime?: string;
    updateTime?: string;
  }

  export interface ECOrderTask {
    id: number;
    taskNo: string;
    platform: string;
    fileName: string;
    billingYear: number;
    billingPeriod: string;
    taskStatus:
      | 'PROCESSED'
      | 'ROLLED_BACK'
      | 'WAIT_DEDUCT_CONFIRM'
      | 'WAITING_PREVIEW';
    totalRecords: number;
    errorMsg: string;
    processedTime: string;
    creator?: string;
    updater?: string;
    createTime?: string;
    updateTime?: string;
  }

  export interface ECOrder {
    id: number;
    taskId: number;
    sku: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    originalSalesAmount: number;
    usdSalesAmount: number;
    commissionFee: number;
    lastMileFee: number;
    refundAmount: number;
    refundUsd: number;
    refundCommission: number;
    returnQtyResalable: number;
    returnQtyNonResalable: number;
    unitCost: number;
    totalCost: number;
    customsNo: string;
    isOversold: boolean;
  }

  export interface Rate {
    date: string;
    base: string;
    rates: Record<string, number>;
  }
}

// ===== SKU 映射 =====

export function getSkuMappingPage(params: PageParam) {
  return requestClient.get<PageResult<FinanceEcApi.ECSkuMapping>>(
    '/finance/crossborder/sku-mapping/page',
    { params },
  );
}

export function createSkuMapping(data: FinanceEcApi.ECSkuMapping) {
  return requestClient.post('/finance/crossborder/sku-mapping/create', data);
}

export function updateSkuMapping(data: FinanceEcApi.ECSkuMapping) {
  return requestClient.put('/finance/crossborder/sku-mapping/update', data);
}

export function deleteSkuMapping(id: number) {
  return requestClient.delete(
    `/finance/crossborder/sku-mapping/delete?id=${id}`,
  );
}

export function importSkuMappings(file: File) {
  return requestClient.upload('/finance/crossborder/sku-mapping/import', {
    file,
  });
}

export function exportSkuMappings(params: any) {
  return requestClient.download('/finance/crossborder/sku-mapping/export', {
    params,
  });
}

// ===== 库存管理 =====

export function getInventoryPage(params: PageParam) {
  return requestClient.get<PageResult<FinanceEcApi.ECInventory>>(
    '/finance/crossborder/inventory/page',
    { params },
  );
}

export function deleteInventory(batchId: number) {
  return requestClient.delete(
    `/finance/crossborder/inventory/delete?batchId=${batchId}`,
  );
}

export function batchDeleteInventory(batchIds: number[]) {
  return requestClient.delete(
    `/finance/crossborder/inventory/batch-delete?batchIds=${batchIds.join(',')}`,
  );
}

export function importInventory(file: File) {
  return requestClient.upload('/finance/crossborder/inventory/import', {
    file,
  });
}

export function manualFixInventory(data: {
  batchId: number;
  newQuantity: number;
  reason: string;
}) {
  return requestClient.post('/finance/crossborder/inventory/manual-fix', data);
}

export function getInventoryLogPage(params: any) {
  return requestClient.get<PageResult<FinanceEcApi.ECInventoryLog>>(
    '/finance/crossborder/inventory/log/page',
    { params },
  );
}

// ===== 订单导入 =====

export function getOrderTaskPage(params: PageParam) {
  return requestClient.get<PageResult<FinanceEcApi.ECOrderTask>>(
    '/finance/crossborder/order-import/task/page',
    { params },
  );
}

export function deleteOrderTask(taskId: number) {
  return requestClient.delete(
    `/finance/crossborder/order-import/delete?taskId=${taskId}`,
  );
}

export function uploadOrderFile(data: {
  billingPeriod: string;
  billingYear: number;
  file: File;
  platform: string;
}) {
  const { file, ...rest } = data;
  return requestClient.upload<number>(
    '/finance/crossborder/order-import/upload',
    { file, ...rest },
  );
}

export function confirmOrderTask(taskId: number) {
  return requestClient.post(
    `/finance/crossborder/order-import/confirm?taskId=${taskId}`,
    {},
  );
}

export function rollbackOrderTask(taskId: number) {
  return requestClient.post(
    `/finance/crossborder/order-import/rollback?taskId=${taskId}`,
    {},
  );
}

// ===== 报表 =====

export function previewEcReport(data: {
  exchangeRate: number;
  pageNo?: number;
  pageSize?: number;
  taskId: number;
}) {
  return requestClient.post<PageResult<FinanceEcApi.ECOrder>>(
    '/finance/crossborder/report/preview',
    data,
  );
}

export function exportEcReportExcel(data: {
  exchangeRate: number;
  taskId: number;
}) {
  return requestClient.post<Blob>(
    '/finance/crossborder/report/export-excel',
    data,
    { responseType: 'blob' } as any,
  );
}

export function getLatestExchangeRate(params: {
  base: string;
  symbols: string;
}) {
  return requestClient.get<FinanceEcApi.Rate>(
    '/finance/crossborder/report/exchange-rate/latest',
    { params },
  );
}
