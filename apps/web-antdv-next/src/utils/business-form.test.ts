import { describe, expect, it } from 'vitest';

import {
  businessFormViewOptions,
  formatBpmSummary,
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

describe('formatBpmSummary', () => {
  it('将已注册 CUSTOM 表单的摘要 key 转换为中文标签', () => {
    expect(
      formatBpmSummary(
        [{ key: 'roomInfo', value: 'A101' }],
        '/dorm/apply/modules/process-detail.vue',
      ),
    ).toBe('房间信息 : A101');
  });

  it('未在字典中登记的 key 原样透传', () => {
    expect(
      formatBpmSummary(
        [{ key: 'unknownField', value: 'foo' }],
        '/dorm/apply/modules/process-detail.vue',
      ),
    ).toBe('unknownField : foo');
  });

  it('nORMAL 表单（无 formCustomViewPath）的 key 本身就是标题，原样透传', () => {
    expect(formatBpmSummary([{ key: '请假类型', value: '年假' }])).toBe(
      '请假类型 : 年假',
    );
  });

  it('多条摘要以换行拼接', () => {
    expect(
      formatBpmSummary(
        [
          { key: 'roomInfo', value: 'A101' },
          { key: 'checkInDate', value: '2026-08-20' },
        ],
        '/dorm/apply/modules/process-detail.vue',
      ),
    ).toBe('房间信息 : A101\n入住时间 : 2026-08-20');
  });

  it('空摘要返回占位符', () => {
    expect(formatBpmSummary(undefined)).toBe('-');
    expect(formatBpmSummary([])).toBe('-');
  });
});
