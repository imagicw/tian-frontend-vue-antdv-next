import { formatDate } from '@vben/utils';

export const APPLY_STATUS_MAP: Record<number, { color: string; text: string }> =
  {
    [-1]: { color: 'default', text: '未开始' },
    0: { color: 'default', text: '待审批' },
    1: { color: 'processing', text: '审批中' },
    2: { color: 'success', text: '审批通过' },
    3: { color: 'error', text: '审批不通过' },
    4: { color: 'default', text: '已取消' },
    5: { color: 'warning', text: '已退回' },
    7: { color: 'cyan', text: '审批通过中' },
  };

export const APPLY_STATUS_OPTIONS = [1, 2, 3, 4].map((value) => ({
  label: APPLY_STATUS_MAP[value]?.text ?? String(value),
  value,
}));

export function formatApplyDateTime(value?: number | string) {
  if (value === undefined || value === null || value === '') return '-';
  return formatDate(value, 'YYYY-MM-DD HH:mm') || '-';
}
