import type { VNode } from 'vue';

import { notification } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleNoticePushMessage } from './notice-push';

vi.mock('antdv-next', () => ({
  notification: {
    info: vi.fn(),
  },
}));

/**
 * description 是 h('div', { innerHTML: ... }) 构造出的、已经消毒好的 VNode（不是渲染函数——
 * antdv-next 的 notification.info() 走 config 直传路径，不会调用函数式 description，见
 * notice-push.ts 顶部注释），消毒后的 HTML 直接就在 props.innerHTML 上，不需要真的渲染上树。
 */
function descriptionHtml(description: unknown): string {
  return (description as VNode).props?.innerHTML as string;
}

describe('handleNoticePushMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('弹出手动关闭的提示，标题和内容来自 notice-push 帧', () => {
    const frame = JSON.stringify({
      content: JSON.stringify({
        content: '<b>紧急</b>：今晚 22:00 系统维护',
        title: '系统维护通知',
      }),
      type: 'notice-push',
    });

    handleNoticePushMessage(frame);

    expect(notification.info).toHaveBeenCalledTimes(1);
    const call = vi.mocked(notification.info).mock.calls[0]![0];
    expect(call.title).toBe('系统维护通知');
    expect(call.duration).toBe(0);
    // 公告内容来自富文本编辑器，走 v-dompurify-html 消毒渲染，不能原样转义成 &lt;b&gt; 字面文本；
    // 具体保留哪些标签是 DOMPurify（跟全站 v-dompurify-html 用法共用同一套逻辑）的职责，这里
    // 只断言没有被当成纯文本转义
    const html = descriptionHtml(call.description);
    expect(html).not.toContain('&lt;b&gt;');
    expect(html).toContain('今晚 22:00 系统维护');
  });

  it('富文本消毒会剥离危险标签', () => {
    const frame = JSON.stringify({
      content: JSON.stringify({
        content: '<img src=x onerror="alert(1)">正文',
        title: '标题',
      }),
      type: 'notice-push',
    });

    handleNoticePushMessage(frame);

    const call = vi.mocked(notification.info).mock.calls[0]![0];
    const html = descriptionHtml(call.description);
    expect(html).not.toContain('onerror');
    expect(html).toContain('正文');
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
