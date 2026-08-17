import { useAccessStore } from '@vben/stores';

import { useWebSocket } from '@vueuse/core';
import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import { buildAdminWebSocketUrl } from '#/utils';

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
    description: content.content,
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
