import { describe, expect, it } from 'vitest';

import { formatApplyDateTime } from './data';

describe('formatApplyDateTime', () => {
  it('formats the millisecond timestamp returned for createTime', () => {
    expect(formatApplyDateTime(1_785_387_193_000)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });
});
