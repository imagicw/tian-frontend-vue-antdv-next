---
status: accepted
---

# 通知推送 WebSocket 用 Web Locks 去重连接，但不做跨标签页鉴权同步

同一用户开多个标签页时，`notice-push` store 此前会在每个标签页各建一条独立 WS 连接：不仅连接数
冗余，管理员推送一条公告时，用户会在每个标签页各收到一次重复提示。

决定用 **Web Locks API**（`navigator.locks.request('notice-push-ws', ...)`）做选主：持有锁的
标签页负责真正的 WS 连接（含 [[0001-notice-push-reconnect-driven-by-auth-state|重连/断连策略]]），
其余标签页只通过 `BroadcastChannel` 接收转发的消息、不建连接。选择 Web Locks 而非手写"心跳 +
抢占标记"，是因为浏览器保证锁在标签页关闭/崩溃时原子释放，不需要自己处理心跳超时探测和并发选主的
竞态；也没有选 `SharedWorker`，因为它需要额外的构建产物、且 Safari 历史上支持不稳定。

**明确不做的事**：`accessStore.loginExpired` 未持久化、`accessToken` 的刷新是被动触发于发出请求
的那个标签页，两者都不会跨标签页实时同步（`pinia-plugin-persistedstate` 不监听 `storage` 事件）。
这意味着如果被选为主的标签页恰好不是触发 token 刷新/过期的那个标签页，它会带着过期 token 继续按
[[0001-notice-push-reconnect-driven-by-auth-state|ADR 0001]] 里的退避曲线重试（最坏每 30 秒一次），
而不会像单标签页场景那样能及时感知 `loginExpired` 并停止重连。

要彻底堵上这个口子，需要把 token 刷新/过期事件也通过 `BroadcastChannel` 广播，但那需要同时改动
`api/request.ts`（全局请求拦截器）和 `store/auth.ts`（全局登录态），这两个文件被应用里所有功能
共用，为了一个非关键通知功能的次要体验问题去动它们，风险和收益不成比例。而且即使不做同步，最坏
情况也只是"每 30 秒空转重试一次"，不是 ADR 0001 要解决的那种每秒钟的重连风暴——已经有兜底，不是
灾难性问题。所以这次刻意留下这个已知限制，等真的有人反馈"多标签页偶尔收不到推送"再评估要不要做
跨标签页鉴权同步。
