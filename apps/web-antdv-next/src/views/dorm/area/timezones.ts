export const DORM_TIMEZONE_OPTIONS = [
  { label: '协调世界时 / UTC（UTC+0）', value: 'UTC' },
  {
    label: '美洲 / 洛杉矶（UTC-8/-7）',
    value: 'America/Los_Angeles',
  },
  { label: '美洲 / 丹佛（UTC-7/-6）', value: 'America/Denver' },
  { label: '美洲 / 芝加哥（UTC-6/-5）', value: 'America/Chicago' },
  { label: '美洲 / 纽约（UTC-5/-4）', value: 'America/New_York' },
  { label: '美洲 / 多伦多（UTC-5/-4）', value: 'America/Toronto' },
  { label: '美洲 / 圣保罗（UTC-3）', value: 'America/Sao_Paulo' },
  { label: '亚洲 / 迪拜（UTC+4）', value: 'Asia/Dubai' },
  { label: '亚洲 / 加尔各答·印度（UTC+5:30）', value: 'Asia/Kolkata' },
  { label: '亚洲 / 达卡·孟加拉国（UTC+6）', value: 'Asia/Dhaka' },
  { label: '亚洲 / 仰光（UTC+6:30）', value: 'Asia/Yangon' },
  { label: '亚洲 / 曼谷（UTC+7）', value: 'Asia/Bangkok' },
  { label: '亚洲 / 金边（UTC+7）', value: 'Asia/Phnom_Penh' },
  { label: '亚洲 / 胡志明市（UTC+7）', value: 'Asia/Ho_Chi_Minh' },
  { label: '亚洲 / 雅加达（UTC+7）', value: 'Asia/Jakarta' },
  { label: '亚洲 / 北京、上海（UTC+8）', value: 'Asia/Shanghai' },
  { label: '亚洲 / 香港（UTC+8）', value: 'Asia/Hong_Kong' },
  { label: '亚洲 / 新加坡（UTC+8）', value: 'Asia/Singapore' },
  { label: '亚洲 / 吉隆坡（UTC+8）', value: 'Asia/Kuala_Lumpur' },
  { label: '亚洲 / 马尼拉（UTC+8）', value: 'Asia/Manila' },
  { label: '亚洲 / 东京（UTC+9）', value: 'Asia/Tokyo' },
  { label: '亚洲 / 首尔（UTC+9）', value: 'Asia/Seoul' },
  { label: '欧洲 / 伦敦（UTC+0/+1）', value: 'Europe/London' },
  { label: '欧洲 / 都柏林（UTC+0/+1）', value: 'Europe/Dublin' },
  { label: '欧洲 / 巴黎（UTC+1/+2）', value: 'Europe/Paris' },
  { label: '欧洲 / 柏林（UTC+1/+2）', value: 'Europe/Berlin' },
  { label: '欧洲 / 赫尔辛基（UTC+2/+3）', value: 'Europe/Helsinki' },
  { label: '欧洲 / 伊斯坦布尔（UTC+3）', value: 'Europe/Istanbul' },
  { label: '欧洲 / 莫斯科（UTC+3）', value: 'Europe/Moscow' },
  { label: '非洲 / 开罗（UTC+2）', value: 'Africa/Cairo' },
  { label: '非洲 / 约翰内斯堡（UTC+2）', value: 'Africa/Johannesburg' },
  { label: '大洋洲 / 悉尼（UTC+10/+11）', value: 'Australia/Sydney' },
  { label: '大洋洲 / 奥克兰（UTC+12/+13）', value: 'Pacific/Auckland' },
];

const DORM_TIMEZONE_LABELS = new Map(
  DORM_TIMEZONE_OPTIONS.map((option) => [option.value, option.label]),
);

export function getDormTimezoneLabel(timeZone?: string) {
  if (!timeZone) return '未设置';
  return DORM_TIMEZONE_LABELS.get(timeZone) ?? timeZone;
}
