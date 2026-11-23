import assert from "node:assert/strict";
import { test } from "node:test";
import { correctSolarTime, getTimeBranch } from "../lib/solar-time";
import type { BirthProfile } from "../lib/types";

function profile(overrides: Partial<BirthProfile> = {}): BirthProfile {
  return {
    id: "test",
    name: "测试",
    date: "1990-06-15",
    time: "12:00",
    timeKnown: true,
    gender: "男",
    longitude: 120,
    useTrueSolarTime: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function parseSolar(solarTime: string) {
  const [datePart, timePart] = solarTime.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return { year, month, day, hour, minute };
}

test("夏令时起始日 02:00 才生效", () => {
  const before = correctSolarTime(profile({ date: "1990-04-15", time: "01:30" }));
  assert.equal(before.detail.dstMinutes, 0, "起始日 01:30 仍是标准时间");

  const after = correctSolarTime(profile({ date: "1990-04-15", time: "02:00" }));
  assert.equal(after.detail.dstMinutes, -60, "起始日 02:00 起为夏令时");
});

test("夏令时结束日 00:00–01:59 仍属夏令时（修复 0 点截断）", () => {
  const lateNight = correctSolarTime(profile({ date: "1990-09-16", time: "00:30", longitude: 116.4 }));
  assert.equal(lateNight.detail.dstMinutes, -60, "结束日 00:30 仍是夏令时");
  const { hour, day } = parseSolar(lateNight.detail.solarTime);
  assert.equal(hour, 23, "还原后应为前一日 23 点段");
  assert.equal(day, 15, "还原后日期应回到 9 月 15 日");

  const ambiguous = correctSolarTime(profile({ date: "1990-09-16", time: "01:10" }));
  assert.equal(ambiguous.detail.dstMinutes, -60, "结束日 01:10 仍是夏令时");

  const restored = correctSolarTime(profile({ date: "1990-09-16", time: "02:10" }));
  assert.equal(restored.detail.dstMinutes, 0, "结束日 02:00 后已是标准时间");
});

test("夏令时区间外不做还原", () => {
  assert.equal(correctSolarTime(profile({ date: "1986-05-04", time: "03:00" })).detail.dstMinutes, -60, "1986 起始日之后");
  assert.equal(correctSolarTime(profile({ date: "1985-06-15", time: "12:00" })).detail.dstMinutes, 0, "1986 年之前");
  assert.equal(correctSolarTime(profile({ date: "1991-10-01", time: "12:00" })).detail.dstMinutes, 0, "1991 结束日之后");
  assert.equal(correctSolarTime(profile({ date: "1992-06-15", time: "12:00" })).detail.dstMinutes, 0, "1992 年之后");
});

test("真太阳时校正包含经度差与均时差", () => {
  const result = correctSolarTime(profile({ longitude: 116.4, useTrueSolarTime: true }));
  assert.equal(result.detail.longitudeOffset, -14.4, "东经 116.4 相对东经 120 的经度差");
  assert.equal(result.detail.minutes, Math.round(result.detail.dstMinutes + result.detail.equationOfTime + result.detail.longitudeOffset), "总校正为三项之和取整");
});

test("关闭真太阳时时只还原夏令时", () => {
  const result = correctSolarTime(profile({ date: "1990-06-15", time: "12:00", useTrueSolarTime: false }));
  assert.equal(result.detail.minutes, -60);
  const { hour } = parseSolar(result.detail.solarTime);
  assert.equal(hour, 11);
});

test("时辰地支映射", () => {
  assert.equal(getTimeBranch("00:30"), "子", "早子时");
  assert.equal(getTimeBranch("07:00"), "辰", "7 点为辰时");
  assert.equal(getTimeBranch("13:15"), "未", "13 点为未时");
  assert.equal(getTimeBranch("23:45"), "子", "晚子时仍归子");
  assert.equal(getTimeBranch(""), "", "非法输入返回空串");
});
