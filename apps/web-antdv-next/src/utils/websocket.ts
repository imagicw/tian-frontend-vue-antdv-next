/**
 * 拼接管理端 `/infra/ws` 的连接地址
 *
 * 用 accessToken 鉴权：后端 `TokenAuthenticationFilter` 只按
 * `OAuth2TokenApi.checkAccessToken` 校验 token，只认 accessToken，
 * refreshToken 传进去查不到记录，握手会直接返回 401 账号未登录。
 *
 * 用 `new URL()` 正经解析出 http/https 再换成 ws/wss，而不是对整个 URL 字符串做
 * `.replace('http', 'ws')`——后者只是因为 "http"/"https" 恰好都以 "http" 开头才凑巧算对，
 * `VITE_BASE_URL` 一旦是空字符串或相对路径（同源反向代理部署）就会拼出一个没有协议头的地址，
 * 传给 `new WebSocket()` 直接抛异常。传入 `window.location.origin` 作为 base，让相对路径的
 * 场景退化为跟当前页面同协议。
 */
export function buildAdminWebSocketUrl(accessToken: string): string {
  const url = new URL(
    `${import.meta.env.VITE_BASE_URL}/infra/ws`,
    window.location.origin,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', accessToken);
  return url.toString();
}
