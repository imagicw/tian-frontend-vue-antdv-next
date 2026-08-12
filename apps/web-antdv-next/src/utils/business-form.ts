export interface BusinessFormViewOption {
  label: string;
  value: string;
}

interface BusinessFormRegistration extends BusinessFormViewOption {
  legacyAdapterKeys?: string[];
}

const businessFormRegistrations: BusinessFormRegistration[] = [
  {
    label: '住宿申请详情',
    legacyAdapterKeys: ['dormFormFields'],
    value: '/dorm/apply/modules/process-detail.vue',
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
