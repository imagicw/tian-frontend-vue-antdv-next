import type { BpmTaskApi } from '#/api/bpm/task';

import { ref } from 'vue';

import { getTaskTodoPage } from '#/api/bpm/task';

export interface TodoTaskListParams {
  category?: string;
  createTime?: [string, string];
  name?: string;
}

const PAGE_SIZE = 10;

/**
 * 待办任务列表的数据获取与分页状态管理，独立于页面渲染，可单独进行单元测试。
 */
export function useTodoTaskList() {
  const list = ref<BpmTaskApi.Task[]>([]);
  const loading = ref(false);
  const hasMore = ref(false);
  const errorState = ref<unknown>();
  const total = ref(0);

  let currentParams: TodoTaskListParams = {};
  let loadedPages = 0;

  function setError(error: unknown) {
    errorState.value = error;
  }

  async function fetchPage(pageNo: number, params: TodoTaskListParams) {
    return await getTaskTodoPage({
      pageNo,
      pageSize: PAGE_SIZE,
      ...params,
    });
  }

  /** 加载第一页数据，用于初始加载，或搜索/筛选条件变化后重新查询 */
  async function loadFirstPage(params: TodoTaskListParams = {}) {
    currentParams = params;
    loading.value = true;
    errorState.value = undefined;
    try {
      const data = await fetchPage(1, currentParams);
      loadedPages = 1;
      list.value = data.list ?? [];
      total.value = data.total ?? 0;
      hasMore.value = loadedPages * PAGE_SIZE < total.value;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /** 加载下一页并追加到列表末尾（"加载更多"） */
  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    loading.value = true;
    errorState.value = undefined;
    const nextPage = loadedPages + 1;
    try {
      const data = await fetchPage(nextPage, currentParams);
      loadedPages = nextPage;
      list.value = [...list.value, ...(data.list ?? [])];
      total.value = data.total ?? total.value;
      hasMore.value = loadedPages * PAGE_SIZE < total.value;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 乐观地从列表中移除一个任务（审批提交成功后立即调用）。
   * 返回一个 rollback 函数：审批提交失败时调用可将任务恢复到原位置。
   */
  function removeTaskOptimistic(taskId: string) {
    const index = list.value.findIndex((task) => task.id === taskId);
    if (index === -1) {
      return () => {};
    }
    const removedTask = list.value[index]!;
    list.value = [
      ...list.value.slice(0, index),
      ...list.value.slice(index + 1),
    ];
    total.value = Math.max(0, total.value - 1);

    let rolledBack = false;
    return function rollback() {
      if (rolledBack) return;
      rolledBack = true;
      const insertAt = Math.min(index, list.value.length);
      list.value = [
        ...list.value.slice(0, insertAt),
        removedTask,
        ...list.value.slice(insertAt),
      ];
      total.value += 1;
    };
  }

  return {
    list,
    loading,
    hasMore,
    error: errorState,
    total,
    loadFirstPage,
    loadMore,
    removeTaskOptimistic,
  };
}
