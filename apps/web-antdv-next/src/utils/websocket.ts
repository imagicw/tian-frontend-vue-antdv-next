/**
 * 拼接管理端 `/infra/ws` 的连接地址
 *
 * 用 accessToken 鉴权：后端 `TokenAuthenticationFilter` 只按
 * `OAuth2TokenApi.checkAccessToken` 校验 token，只认 accessToken，
 * refreshToken 传进去查不到记录，握手会直接返回 401 账号未登录。
 */
export function buildAdminWebSocketUrl(accessToken: string): string {
  return `${`${import.meta.env.VITE_BASE_URL}/infra/ws`.replace('http', 'ws')}?token=${accessToken}`;
}
