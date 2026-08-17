import { h, watch } from 'vue';
import { buildVueDompurifyHTMLDirective } from 'vue-dompurify-html';

import { useAccessStore } from '@vben/stores';

import { useWebSocket } from '@vueuse/core';
import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import { buildAdminWebSocketUrl } from '#/utils';

/** 多标签页共享的 BroadcastChannel 名称：主标签页把收到的原始帧转发给其它标签页 */
const BROADCAST_CHANNEL_NAME = 'tian-system:notice-push';

/** 多标签页去重连接用的 Web Locks 锁名：持有这把锁的标签页才建立真正的 WS 连接 */
const LEADER_LOCK_NAME = 'tian-system:notice-push-ws-leader';

/** 断线重连的指数退避封顶：1s→2s→4s→…→30s，之后固定 30s 间隔，不设重试次数上限 */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * 公告内容来自富文本编辑器，渲染前必须走跟其他页面一致的 DOMPurify 消毒，防止 XSS。
 *
 * antdv-next 的 `notification.info({ description })` 走的是 config 直传路径（不是模板/slot
 * 渲染路径），description 只能是字符串或已构造好的 VNode——传函数不会被当渲染函数调用，会被
 * 当成子节点直接 toString() 成源码文本；withDirectives 也要求在渲染上下文里调用，WS 消息回调
 * 里没有这个上下文。所以这里不用 v-dompurify-html 指令，而是直接调用它内部同一份 DOMPurify
 * 消毒逻辑得到已消毒的 HTML 字符串，再用 h() 构造一个 innerHTML 已经设好的 VNode 传进去。
 */
const dompurifyDirective = buildVueDompurifyHTMLDirective();

function sanitizeHtml(html: string): string {
  const el = document.createElement('div');
  (dompurifyDirective.mounted as (el: HTMLElement, binding: unknown) => void)(
    el,
    { value: html },
  );
  return el.innerHTML;
}

interface NoticePushFrame {
  content: string;
  type: string;
}

interface NoticePushContent {
  content: string;
  title: string;
}

/** 通知公告 WebSocket 频道使用的消息类型，对应后端 NoticeServiceImpl.pushNotice 广播的 type */
const NOTICE_PUSH_TYPE = 'notice-push';

/** 导出供单元测试直接调用，不需要经过真实的 WebSocket 连接 */
export function handleNoticePushMessage(data: string) {
  if (data === 'pong') {
    return;
  }
  let frame: NoticePushFrame;
  try {
    frame = JSON.parse(data);
  } catch {
    return;
  }
  if (frame.type !== NOTICE_PUSH_TYPE) {
    return;
  }
  let content: NoticePushContent;
  try {
    content = JSON.parse(frame.content);
  } catch {
    return;
  }
  notification.info({
    description: h('div', { innerHTML: sanitizeHtml(content.content) }),
    duration: 0,
    title: content.title,
  });
}

export const useNoticePushStore = defineStore('notice-push', () => {
  const accessStore = useAccessStore();

  /** 是否已经调用过 connect()，用来让 connect()/disconnect() 幂等 */
  let started = false;
  let wsClose: (() => void) | undefined;
  let stopAuthWatch: (() => void) | undefined;
  let leaderLockController: AbortController | undefined;
  let broadcastChannel: BroadcastChannel | undefined;

  /** 当前 accessToken 是否处于"应该连接"的状态：没过期、且有 token */
  function shouldBeConnected() {
    return !accessStore.loginExpired && !!accessStore.accessToken;
  }

  /** 建立真正的 WS 连接。只应该在本标签页是主标签页时调用 */
  function openWebSocket() {
    if (wsClose) {
      return;
    }
    const accessToken = accessStore.accessToken as string;
    const { close } = useWebSocket(buildAdminWebSocketUrl(accessToken), {
      autoReconnect: {
        // 排除鉴权失效路径后剩下的纯瞬时故障：指数退避，不设重试次数上限
        delay: (retried: number) =>
          Math.min(1000 * 2 ** (retried - 1), MAX_RECONNECT_DELAY_MS),
      },
      heartbeat: {
        interval: 30_000,
        pongTimeout: 5000,
      },
      onMessage: (_ws, event) => {
        handleNoticePushMessage(event.data);
        // 转发给其它标签页；BroadcastChannel 不会把消息送回发送方自己，不会重复处理
        broadcastChannel?.postMessage(event.data);
      },
    });
    wsClose = close;
  }

  function closeWebSocket() {
    if (!wsClose) {
      return;
    }
    wsClose();
    wsClose = undefined;
  }

  /** 鉴权状态变化时，决定要不要建立/断开连接。只应该在本标签页是主标签页时调用 */
  function syncConnection() {
    if (shouldBeConnected()) {
      openWebSocket();
    } else if (wsClose) {
      console.warn(
        '[notice-push] 登录已过期或已登出，主动断开连接，不再用旧 token 重连',
      );
      closeWebSocket();
    }
  }

  /** 本标签页成为主标签页：开始响应鉴权状态、建立/维护 WS 连接 */
  function becomeLeader() {
    stopAuthWatch = watch(
      () => [accessStore.loginExpired, accessStore.accessToken] as const,
      syncConnection,
      { immediate: true },
    );
  }

  /** 本标签页不再是主标签页（让位或断开）：停止响应鉴权状态、关闭连接 */
  function stopLeading() {
    stopAuthWatch?.();
    stopAuthWatch = undefined;
    closeWebSocket();
  }

  function connect() {
    if (started) {
      return;
    }
    started = true;

    // 所有标签页都监听转发频道：主标签页收到真实消息后会转发过来
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.addEventListener('message', (event) =>
      handleNoticePushMessage(event.data as string),
    );

    if (!('locks' in navigator)) {
      // 不支持 Web Locks 的浏览器（理论上现代浏览器都支持）：退化成每个标签页各自连接
      console.warn(
        '[notice-push] 当前浏览器不支持 Web Locks，跳过多标签页去重',
      );
      becomeLeader();
      return;
    }

    leaderLockController = new AbortController();
    navigator.locks
      .request(
        LEADER_LOCK_NAME,
        { signal: leaderLockController.signal },
        () =>
          new Promise<void>((resolve) => {
            becomeLeader();
            // Web Locks 的持锁方式：回调返回的 Promise 不 resolve，锁就一直持有；
            // 直到 abort（本标签页关闭或调用 disconnect()）才 resolve，释放锁给下一个排队的标签页
            leaderLockController?.signal.addEventListener('abort', () => {
              stopLeading();
              resolve();
            });
          }),
      )
      .catch(() => {
        // AbortError：disconnect() 在拿到锁之前就被调用，直接忽略
      });
  }

  function disconnect() {
    if (!started) {
      return;
    }
    started = false;

    leaderLockController?.abort();
    leaderLockController = undefined;
    // 未支持 Web Locks 的退化路径没有走锁的 abort 回调，这里兜底清理
    stopLeading();

    broadcastChannel?.close();
    broadcastChannel = undefined;
  }

  return {
    connect,
    disconnect,
  };
});
