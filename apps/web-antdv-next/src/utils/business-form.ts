export interface BusinessFormViewOption {
  label: string;
  value: string;
}

/** 业务表单摘要字段：可在 BPM 摘要设置面板中勾选、展示在待办卡片上 */
export interface BusinessFormSummaryField {
  key: string;
  label: string;
}

interface BusinessFormRegistration extends BusinessFormViewOption {
  legacyAdapterKeys?: string[];
  summaryFields?: BusinessFormSummaryField[];
}

const businessFormRegistrations: BusinessFormRegistration[] = [
  {
    label: '住宿申请详情',
    legacyAdapterKeys: ['dormFormFields'],
    value: '/dorm/apply/modules/process-detail.vue',
    summaryFields: [
      { key: 'roomInfo', label: '房间信息' },
      { key: 'checkInDate', label: '入住时间' },
    ],
  },
];

export const businessFormViewOptions: BusinessFormViewOption[] =
  businessFormRegistrations.map(({ label, value }) => ({ label, value }));

/** 将旧版“路径@数据适配器”配置转换成 Vue 只读详情组件路径。 */
export function resolveBusinessFormViewPath(configuredPath?: string) {
  const value = configuredPath?.trim();
  if (!value) return '';

  const [componentPath = '', legacyAdapterKey] = value.split('@');
  if (legacyAdapterKey) {
    const registration = businessFormRegistrations.find((item) =>
      item.legacyAdapterKeys?.includes(legacyAdapterKey),
    );
    if (registration) return registration.value;
  }
  return componentPath.trim();
}

/** 按 formCustomViewPath 查找该自定义业务表单声明的摘要候选字段，未注册时返回空数组 */
export function getBusinessFormSummaryFields(
  formCustomViewPath?: string,
): BusinessFormSummaryField[] {
  if (!formCustomViewPath) return [];

  const registration = businessFormRegistrations.find(
    (item) => item.value === formCustomViewPath,
  );
  return registration?.summaryFields ?? [];
}

export interface BpmSummaryItem {
  key: string;
  value: string;
}

/**
 * 将流程实例摘要的 key 解析为展示用标签。
 * NORMAL 表单的 key 后端已下发为字段标题，直接展示；CUSTOM 表单的 key 是原始变量名，
 * 需要按 formCustomViewPath 查字典转换为中文标签，字典未登记时原样透传。
 */
export function mapBpmSummaryItems(
  summary: BpmSummaryItem[] | undefined,
  formCustomViewPath?: string,
): { key: string; label: string; value: string }[] {
  if (!summary || summary.length === 0) return [];

  const fields = getBusinessFormSummaryFields(formCustomViewPath);
  const labelByKey = new Map(fields.map((field) => [field.key, field.label]));

  return summary.map((item) => ({
    key: item.key,
    label: labelByKey.get(item.key) ?? item.key,
    value: item.value,
  }));
}

/** 格式化流程实例摘要为拼接文本，供已办任务/我的流程等表格 formatter 共用。 */
export function formatBpmSummary(
  summary: BpmSummaryItem[] | undefined,
  formCustomViewPath?: string,
): string {
  const items = mapBpmSummaryItems(summary, formCustomViewPath);
  if (items.length === 0) return '-';

  return items.map((item) => `${item.label} : ${item.value}`).join('\n');
}
