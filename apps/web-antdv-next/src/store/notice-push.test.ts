import type { VNode } from 'vue';

import { nextTick, reactive } from 'vue';

import { notification } from 'antdv-next';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleNoticePushMessage, useNoticePushStore } from './notice-push';

vi.mock('antdv-next', () => ({
  notification: {
    info: vi.fn(),
  },
}));

/**
 * `accessStore` 的最小可写 mock：只暴露这次改动实际用到的两个字段。
 * 必须是 `reactive()`，因为 store 内部用 `watch()` 监听这两个字段——普通对象的属性赋值
 * 不会被 Vue 的依赖追踪捕获到，watch 回调永远不会在 immediate 首次执行之后再触发。
 */
const accessStoreMock = reactive({
  accessToken: null as null | string,
  loginExpired: false,
});

vi.mock('@vben/stores', () => ({
  useAccessStore: () => accessStoreMock,
}));

/** `useWebSocket` 的 mock：记录每次调用，close 是可断言的 spy */
const useWebSocketMock = vi.fn((_url: string, _options?: unknown) => ({
  close: vi.fn(),
}));

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  // 用闭包间接引用，而不是直接把 useWebSocketMock 赋给 useWebSocket：vi.mock 的工厂函数会被
  // 提升到文件最顶部先执行，此时 useWebSocketMock 这个 const 还没初始化，直接引用会触发 TDZ
  // 报错；闭包只在真正调用时（测试运行阶段，useWebSocketMock 早已初始化）才读取这个引用。
  useWebSocket: (url: string, options?: unknown) =>
    useWebSocketMock(url, options),
}));

/**
 * jsdom/happy-dom 环境不提供 `BroadcastChannel`、也没有真正实现 `navigator.locks`。
 * 这里手写最小 fake：`locks.request` 同步调用回调（相当于"锁立刻被授予"），足够验证
 * "connect() 之后，`loginExpired`/`accessToken` 变化触发 openWebSocket/closeWebSocket"
 * 这条业务逻辑，不需要模拟真实的排队/跨标签页时序。
 */
class FakeBroadcastChannel {
  addEventListener = vi.fn();
  close = vi.fn();
  postMessage = vi.fn();
}

vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
vi.stubGlobal('navigator', {
  ...navigator,
  locks: {
    request: (
      _name: string,
      _options: { signal: AbortSignal },
      callback: () => Promise<void>,
    ) => callback().catch(() => {}),
  },
});

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

describe('useNoticePushStore', () => {
  // `accessStoreMock` 是模块级单例，不会随 `setActivePinia(createPinia())` 重建；
  // 上一个测试里 connect() 注册的 watch() 如果不主动 disconnect()，会作为孤儿 effect
  // 继续监听同一个 mock 对象，污染下一个测试的调用计数。afterEach 里统一清理。
  let store: ReturnType<typeof useNoticePushStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    accessStoreMock.accessToken = null;
    accessStoreMock.loginExpired = false;
    store = useNoticePushStore();
  });

  afterEach(() => {
    store.disconnect();
  });

  it('connect() 时已有有效 token，立刻建立连接', async () => {
    accessStoreMock.accessToken = 'token-a';

    store.connect();
    await nextTick();

    expect(useWebSocketMock).toHaveBeenCalledTimes(1);
  });

  it('connect() 时还没有 token，先不建立连接；拿到 token 后自动连接', async () => {
    store.connect();
    await nextTick();

    expect(useWebSocketMock).not.toHaveBeenCalled();

    accessStoreMock.accessToken = 'token-a';
    await nextTick();

    expect(useWebSocketMock).toHaveBeenCalledTimes(1);
  });

  it('loginExpired 变 true 时主动断开，不用旧 token 继续重连', async () => {
    accessStoreMock.accessToken = 'token-a';
    store.connect();
    await nextTick();

    const { close } = useWebSocketMock.mock.results[0]!.value as {
      close: ReturnType<typeof vi.fn>;
    };
    expect(close).not.toHaveBeenCalled();

    accessStoreMock.loginExpired = true;
    await nextTick();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('重新登录（loginExpired 恢复 false 且有新 token）后自动重新连接', async () => {
    accessStoreMock.accessToken = 'token-a';
    store.connect();
    await nextTick();
    accessStoreMock.loginExpired = true;
    await nextTick();

    expect(useWebSocketMock).toHaveBeenCalledTimes(1);

    accessStoreMock.accessToken = 'token-b';
    accessStoreMock.loginExpired = false;
    await nextTick();

    expect(useWebSocketMock).toHaveBeenCalledTimes(2);
    expect(useWebSocketMock.mock.calls[1]![0]).toContain('token-b');
  });

  it('disconnect() 后不再响应 loginExpired 变化', async () => {
    accessStoreMock.accessToken = 'token-a';
    store.connect();
    await nextTick();
    const { close } = useWebSocketMock.mock.results[0]!.value as {
      close: ReturnType<typeof vi.fn>;
    };

    store.disconnect();
    expect(close).toHaveBeenCalledTimes(1);

    accessStoreMock.loginExpired = true;
    await nextTick();
    // disconnect() 之后已经停止监听，不应该再触发任何一次新的关闭调用
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('connect() 重复调用是幂等的', async () => {
    accessStoreMock.accessToken = 'token-a';
    store.connect();
    store.connect();
    await nextTick();

    expect(useWebSocketMock).toHaveBeenCalledTimes(1);
  });
});
