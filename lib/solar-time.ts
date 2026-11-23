import type { BirthProfile, SolarCorrection } from "@/lib/types";

const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function equationOfTimeMinutes(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
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

function dstAdjustmentMinutes(date: Date): number {
  for (const [sy, sm, sd, ey, em, ed] of DST_PERIODS) {
    if (date >= new Date(sy, sm - 1, sd) && date < new Date(ey, em - 1, ed)) return -60;
  }
  return 0;
}

export function correctSolarTime(profile: BirthProfile): { date: Date; detail: SolarCorrection } {
  const [year, month, day] = profile.date.split("-").map(Number);
  const [hour, minute] = profile.time.split(":").map(Number);
  const clock = new Date(year, month - 1, day, hour, minute, 0, 0);
  const dstMinutes = dstAdjustmentMinutes(clock);
  const standard = new Date(clock.getTime() + dstMinutes * 60_000);
  const eot = equationOfTimeMinutes(standard);
  const longitudeOffset = (profile.longitude - 120) * 4;
  const solarAdjustment = profile.useTrueSolarTime ? eot + longitudeOffset : 0;
  const corrected = new Date(standard.getTime() + solarAdjustment * 60_000);

  return {
    date: corrected,
    detail: {
      clockTime: `${profile.date} ${profile.time}`,
      solarTime: `${corrected.getFullYear()}-${pad(corrected.getMonth() + 1)}-${pad(corrected.getDate())} ${pad(corrected.getHours())}:${pad(corrected.getMinutes())}`,
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
  return Number.isFinite(hour) ? EARTHLY_BRANCHES[hourBranchIndex(hour)] : "";
}
