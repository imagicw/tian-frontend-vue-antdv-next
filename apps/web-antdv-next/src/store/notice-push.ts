import { h } from 'vue';
import { buildVueDompurifyHTMLDirective } from 'vue-dompurify-html';

import { useAccessStore } from '@vben/stores';

import { useWebSocket } from '@vueuse/core';
import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import { buildAdminWebSocketUrl } from '#/utils';

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
  let close: (() => void) | undefined;

  function connect() {
    if (close) {
      return;
    }
    const accessStore = useAccessStore();
    const accessToken = accessStore.accessToken as string;
    if (!accessToken) {
      return;
    }
    const { close: closeConnection } = useWebSocket(
      buildAdminWebSocketUrl(accessToken),
      {
        autoReconnect: true,
        heartbeat: true,
        onMessage: (_ws, event) => handleNoticePushMessage(event.data),
      },
    );
    close = closeConnection;
  }

  function disconnect() {
    close?.();
    close = undefined;
  }

  return {
    connect,
    disconnect,
  };
});
