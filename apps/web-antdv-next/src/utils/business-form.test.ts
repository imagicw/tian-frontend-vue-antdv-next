import { describe, expect, it } from 'vitest';

import {
  businessFormViewOptions,
  resolveBusinessFormViewPath,
} from './business-form';

describe('resolveBusinessFormViewPath', () => {
  it('保留标准 Vue 组件路径', () => {
    expect(resolveBusinessFormViewPath('/bpm/oa/leave/detail.vue')).toBe(
      '/bpm/oa/leave/detail.vue',
    );
  });

  it('兼容旧住宿申请适配器配置', () => {
    expect(resolveBusinessFormViewPath('/bpm/dorm/detail@dormFormFields')).toBe(
      '/dorm/apply/modules/process-detail.vue',
    );
  });

  it('提供住宿申请标准查看组件选项', () => {
    expect(businessFormViewOptions).toContainEqual({
      label: '住宿申请详情',
      value: '/dorm/apply/modules/process-detail.vue',
    });
  });
});
