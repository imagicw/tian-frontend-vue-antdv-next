import type { Dayjs } from 'dayjs';

/** antdv-next 单日期选择器在类型层面同时覆盖单值和范围值。 */
export type SingleDatePickerValue = Dayjs | Dayjs[] | null;

/** 将日期选择器的联合值收口为业务页面使用的单个日期。 */
export function getSingleDatePickerValue(
  value: SingleDatePickerValue,
): Dayjs | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
