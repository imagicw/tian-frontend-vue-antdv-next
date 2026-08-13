import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTaskTodoPageMock = vi.fn();

vi.mock('#/api/bpm/task', () => ({
  getTaskTodoPage: (...args: unknown[]) => getTaskTodoPageMock(...args),
}));

const { useTodoTaskList } = await import('./useTodoTaskList');

function makeTask(id: string) {
  return { id } as any;
}

describe('useTodoTaskList', () => {
  beforeEach(() => {
    getTaskTodoPageMock.mockReset();
  });

  it('首次加载返回正确的 list/hasMore', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1'), makeTask('2')],
      total: 25,
    });

    const { list, hasMore, loadFirstPage } = useTodoTaskList();
    await loadFirstPage();

    expect(list.value.map((task) => task.id)).toEqual(['1', '2']);
    expect(hasMore.value).toBe(true);
    expect(getTaskTodoPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 10 }),
    );
  });

  it('加载更多正确追加数据并更新 hasMore', async () => {
    getTaskTodoPageMock
      .mockResolvedValueOnce({ list: [makeTask('1')], total: 15 })
      .mockResolvedValueOnce({ list: [makeTask('2')], total: 15 });

    const { list, hasMore, loadFirstPage, loadMore } = useTodoTaskList();
    await loadFirstPage();
    expect(hasMore.value).toBe(true);

    await loadMore();

    expect(list.value.map((task) => task.id)).toEqual(['1', '2']);
    expect(hasMore.value).toBe(false);
    expect(getTaskTodoPageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2, pageSize: 10 }),
    );
  });

  it('加载更多时无更多数据或正在加载则不重复请求', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1')],
      total: 1,
    });

    const { hasMore, loadFirstPage, loadMore } = useTodoTaskList();
    await loadFirstPage();
    expect(hasMore.value).toBe(false);

    await loadMore();

    expect(getTaskTodoPageMock).toHaveBeenCalledTimes(1);
  });

  it('审批成功后列表中对应项被移除（乐观更新）', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1'), makeTask('2')],
      total: 2,
    });

    const { list, total, loadFirstPage, removeTaskOptimistic } =
      useTodoTaskList();
    await loadFirstPage();

    removeTaskOptimistic('1');

    expect(list.value.map((task) => task.id)).toEqual(['2']);
    expect(total.value).toBe(1);
  });

  it('审批失败后调用 rollback 可将任务恢复到原位置', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1'), makeTask('2'), makeTask('3')],
      total: 3,
    });

    const { list, total, loadFirstPage, removeTaskOptimistic } =
      useTodoTaskList();
    await loadFirstPage();

    const { rollback } = removeTaskOptimistic('2');
    expect(list.value.map((task) => task.id)).toEqual(['1', '3']);

    rollback();

    expect(list.value.map((task) => task.id)).toEqual(['1', '2', '3']);
    expect(total.value).toBe(3);
  });

  it('移除中间任务后 nextTaskId 指向原索引位置上的新任务（原本的下一条）', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1'), makeTask('2'), makeTask('3')],
      total: 3,
    });

    const { loadFirstPage, removeTaskOptimistic } = useTodoTaskList();
    await loadFirstPage();

    const { nextTaskId } = removeTaskOptimistic('2');

    expect(nextTaskId).toBe('3');
  });

  it('移除最后一条任务后 nextTaskId 回退到新的最后一条', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1'), makeTask('2'), makeTask('3')],
      total: 3,
    });

    const { loadFirstPage, removeTaskOptimistic } = useTodoTaskList();
    await loadFirstPage();

    const { nextTaskId } = removeTaskOptimistic('3');

    expect(nextTaskId).toBe('2');
  });

  it('移除唯一一条任务后 nextTaskId 为 undefined', async () => {
    getTaskTodoPageMock.mockResolvedValueOnce({
      list: [makeTask('1')],
      total: 1,
    });

    const { loadFirstPage, removeTaskOptimistic } = useTodoTaskList();
    await loadFirstPage();

    const { nextTaskId } = removeTaskOptimistic('1');

    expect(nextTaskId).toBeUndefined();
  });

  it('拉取列表失败时暴露错误状态供 UI 使用，并保持 loading 收尾', async () => {
    const failure = new Error('network error');
    getTaskTodoPageMock.mockRejectedValueOnce(failure);

    const { error, loading, loadFirstPage } = useTodoTaskList();

    await expect(loadFirstPage()).rejects.toThrow('network error');

    expect(error.value).toBe(failure);
    expect(loading.value).toBe(false);
  });
});
