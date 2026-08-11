import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace SystemSocialClientApi {
  /** 社交客户端信息 */
  export interface SocialClient {
    id?: number;
    name: string;
    socialType: number;
    userType: number;
    clientId: string;
    clientSecret: string;
    agentId?: string;
    publicKey?: string;
    status: number;
    createTime?: Date;
  }
}

/** 查询社交客户端列表 */
export function getSocialClientPage(params: PageParam) {
  return requestClient.get<PageResult<SystemSocialClientApi.SocialClient>>(
    '/system/third-party-client/page',
    { params },
  );
}

/** 查询社交客户端详情 */
export function getSocialClient(id: number) {
  return requestClient.get<SystemSocialClientApi.SocialClient>(
    `/system/third-party-client/get?id=${id}`,
  );
}

/** 新增社交客户端 */
export function createSocialClient(data: SystemSocialClientApi.SocialClient) {
  return requestClient.post('/system/third-party-client/create', data);
}

/** 修改社交客户端 */
export function updateSocialClient(data: SystemSocialClientApi.SocialClient) {
  return requestClient.put('/system/third-party-client/update', data);
}

/** 删除社交客户端 */
export function deleteSocialClient(id: number) {
  return requestClient.delete(`/system/third-party-client/delete?id=${id}`);
}

/** 批量删除社交客户端 */
export function deleteSocialClientList(ids: number[]) {
  return requestClient.delete(
    `/system/third-party-client/delete-list?ids=${ids.join(',')}`,
  );
}
