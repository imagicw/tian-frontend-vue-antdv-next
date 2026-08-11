import { requestClient } from '#/api/request';

export namespace MpLocationConfigApi {
  /** MP 定位消息所需的位置服务配置 */
  export interface LocationConfig {
    tencentLbsKey?: string;
  }
}

/** 获取 MP 定位消息所需的腾讯位置服务密钥 */
export function getLocationConfig() {
  return requestClient.get<MpLocationConfigApi.LocationConfig>(
    '/trade/config/get',
  );
}
