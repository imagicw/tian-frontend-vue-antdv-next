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
      { key: 'applicantName', label: '申请人' },
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
