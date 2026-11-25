import type { BirthProfile, SolarCorrection } from "@/lib/types";

const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/**
 * 不带设备时区的民用时间。出生资料始终按产品声明的中国标准时间钟表字段解释；
 * UTC 时间戳仅作为跨日加减分钟的算术载体，绝不代表真实 UTC 瞬间。
 */
export interface CivilDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function civilTimestamp({ year, month, day, hour, minute }: CivilDateTime) {
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

function civilFromTimestamp(timestamp: number): CivilDateTime {
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function equationOfTimeMinutes(date: CivilDateTime) {
  const start = Date.UTC(date.year, 0, 0);
  const current = Date.UTC(date.year, date.month - 1, date.day);
  const day = Math.floor((current - start) / 86_400_000);
  const b = ((360 / 365) * (day - 81) * Math.PI) / 180;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

// 1986–1991 年中国实行夏令时；钟表时间需先还原，再做真太阳时校正。
const DST_PERIODS: Array<[number, number, number, number, number, number]> = [
  [1986, 5, 4, 1986, 9, 14],
  [1987, 4, 12, 1987, 9, 13],
  [1988, 4, 10, 1988, 9, 11],
  [1989, 4, 16, 1989, 9, 17],
  [1990, 4, 15, 1990, 9, 16],
  [1991, 4, 14, 1991, 9, 15],
];

// 1986–1991 年中国实行夏令时；起始日 02:00 起拨快一小时，结束日 02:00 拨回。
// 因此结束日 00:00–01:59 仍属夏令时，出生时间需还原到前一日 23:xx 或当日 00:xx。
function dstAdjustmentMinutes(date: CivilDateTime): number {
  const timestamp = civilTimestamp(date);
  for (const [sy, sm, sd, ey, em, ed] of DST_PERIODS) {
    const start = Date.UTC(sy, sm - 1, sd, 2);
    const end = Date.UTC(ey, em - 1, ed, 2);
    if (timestamp >= start && timestamp < end) return -60;
  }
  return 0;
}

export function correctSolarTime(profile: BirthProfile): { civil: CivilDateTime; detail: SolarCorrection } {
  const [year, month, day] = profile.date.split("-").map(Number);
  const [hour, minute] = profile.time.split(":").map(Number);
  const clock: CivilDateTime = { year, month, day, hour, minute };
  const dstMinutes = dstAdjustmentMinutes(clock);
  const standardTimestamp = civilTimestamp(clock) + dstMinutes * 60_000;
  const standard = civilFromTimestamp(standardTimestamp);
  const eot = equationOfTimeMinutes(standard);
  const longitudeOffset = (profile.longitude - 120) * 4;
  const solarAdjustment = profile.useTrueSolarTime ? eot + longitudeOffset : 0;
  const corrected = civilFromTimestamp(standardTimestamp + solarAdjustment * 60_000);

  return {
    civil: corrected,
    detail: {
      clockTime: `${profile.date} ${profile.time}`,
      solarTime: `${corrected.year}-${pad(corrected.month)}-${pad(corrected.day)} ${pad(corrected.hour)}:${pad(corrected.minute)}`,
      minutes: Math.round(dstMinutes + solarAdjustment),
      equationOfTime: Math.round(eot * 10) / 10,
      longitudeOffset: Math.round(longitudeOffset * 10) / 10,
      dstMinutes,
    },
  };
}

function hourBranchIndex(hour: number) {
  return Math.floor((hour + 1) / 2) % 12;
}

export function getTimeBranch(time: string) {
  const hour = Number(time.split(":")[0]);
  return time !== "" && Number.isFinite(hour) ? EARTHLY_BRANCHES[hourBranchIndex(hour)] : "";
}
