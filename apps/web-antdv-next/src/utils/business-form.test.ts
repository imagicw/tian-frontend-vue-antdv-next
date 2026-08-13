import { describe, expect, it } from 'vitest';

import {
  businessFormViewOptions,
  getBusinessFormSummaryFields,
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

describe('getBusinessFormSummaryFields', () => {
  it('按已注册的 formCustomViewPath 查找住宿申请摘要字段', () => {
    expect(
      getBusinessFormSummaryFields('/dorm/apply/modules/process-detail.vue'),
    ).toEqual(
      expect.arrayContaining([
        { key: 'applicantName', label: '申请人' },
        { key: 'roomInfo', label: '房间信息' },
        { key: 'checkInDate', label: '入住时间' },
      ]),
    );
  });

  it('按未注册的 formCustomViewPath 查找返回空数组', () => {
    expect(getBusinessFormSummaryFields('/unknown/path.vue')).toEqual([]);
  });

  it('未传入 formCustomViewPath 时返回空数组', () => {
    expect(getBusinessFormSummaryFields(undefined)).toEqual([]);
  });

  it('同一 formCustomViewPath 下摘要字段 key 唯一', () => {
    businessFormViewOptions.forEach(({ value }) => {
      const fields = getBusinessFormSummaryFields(value);
      const keys = fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
