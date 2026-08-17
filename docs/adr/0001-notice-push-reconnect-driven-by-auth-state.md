---
status: accepted
---

# 通知推送 WebSocket 的重连由鉴权状态驱动，而非 close 事件

`notice-push` store（`apps/web-antdv-next/src/store/notice-push.ts`）此前对 `useWebSocket`
裸传 `autoReconnect: true` / `heartbeat: true`，吃 vueuse 默认值：1s 心跳、1s pong 超时、固定
1s 重连间隔、无限重试。`accessToken` 过期后，连接一旦断开就会用同一个已作废的 token 无限重连、
每秒打一次后端；且 url 是 `connect()` 调用时的字符串快照、非响应式，即使之后重新登录成功也不会
自愈，必须刷新整页。

浏览器 `WebSocket` API 无法从 `close`/`error` 事件本身区分"握手时 401 鉴权失败"和"网络/服务端
不可达"——两者呈现为同样的 abnormal closure，所以无法靠"识别 close 原因"来做区分重连策略。

决定：把"是否应该保持连接"从 WS 自身的 close 事件里剥离出来，改为由 `accessStore.loginExpired` /
`accessToken` 驱动——`loginExpired` 变 `true` 时主动断开，不再用作废 token 空转重试；重新登录、
token 恢复有效后自动重新连接（url 改为基于 `accessToken` 的响应式来源）。排除鉴权失效这条路径后，
剩下的纯瞬时网络/服务端故障才走指数退避重连（1s→2s→4s→…封顶 30s，不设重试次数上限——这是低
优先级通知通道，服务端重启几分钟也应该安静地持续重试而不放弃）；心跳同时收紧为 30s 间隔 / 5s
pong 超时，避免正常网络抖动或后台标签页降频被误判为断线。全程对用户静默，不加连接状态 UI，只用
浏览器 console 日志辅助排查。

## Out of scope

后端 `WebSocketSessionManagerImpl`、多实例水平扩展（redis/rocketmq/kafka/rabbitmq sender 切换）、
多标签页连接去重、`infra/webSocket` 调试页的协议拼接 bug——均不在这次改动内，留作独立问题。
