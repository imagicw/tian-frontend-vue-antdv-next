import { notification } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleNoticePushMessage } from './notice-push';

vi.mock('antdv-next', () => ({
  notification: {
    info: vi.fn(),
  },
}));

describe('handleNoticePushMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('弹出手动关闭的提示，且内容来自 notice-push 帧', () => {
    const frame = JSON.stringify({
      content: JSON.stringify({
        content: '今晚 22:00 系统维护',
        title: '系统维护通知',
      }),
      type: 'notice-push',
    });

    handleNoticePushMessage(frame);

    expect(notification.info).toHaveBeenCalledTimes(1);
    expect(notification.info).toHaveBeenCalledWith({
      description: '今晚 22:00 系统维护',
      duration: 0,
      title: '系统维护通知',
    });
  });

  it('忽略非 notice-push 类型的帧', () => {
    const frame = JSON.stringify({
      content: JSON.stringify({ text: 'hello' }),
      type: 'demo-message-receive',
    });

    handleNoticePushMessage(frame);

    expect(notification.info).not.toHaveBeenCalled();
  });

  it('忽略心跳应答 pong', () => {
    handleNoticePushMessage('pong');

    expect(notification.info).not.toHaveBeenCalled();
  });

  it('忽略无法解析的消息，不抛出异常', () => {
    expect(() => handleNoticePushMessage('not json')).not.toThrow();
    expect(notification.info).not.toHaveBeenCalled();
  });
});
