/**
 * 拼接管理端 `/infra/ws` 的连接地址
 *
 * 用 refreshToken 而不是 accessToken 鉴权：WebSocket 连接期间无法方便地刷新访问令牌。
 */
export function buildAdminWebSocketUrl(refreshToken: string): string {
  return `${`${import.meta.env.VITE_BASE_URL}/infra/ws`.replace('http', 'ws')}?token=${refreshToken}`;
}
