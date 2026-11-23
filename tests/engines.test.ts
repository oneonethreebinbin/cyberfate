import assert from "node:assert/strict";
import { test } from "node:test";
import { correctSolarTime, createFateChart } from "../lib/engines";
import type { BirthProfile } from "../lib/types";

function profile(overrides: Partial<BirthProfile> = {}): BirthProfile {
  return {
    id: "golden",
    name: "固定命例",
    date: "1990-01-27",
    time: "08:30",
    timeKnown: true,
    gender: "男",
    longitude: 116.4,
    useTrueSolarTime: true,
    createdAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

test("固定命例四柱与真太阳时回归", () => {
  const chart = createFateChart(profile());
  assert.deepEqual(chart.bazi.pillars.map((p) => `${p.gan}${p.zhi}`), ["己巳", "丁丑", "壬辰", "甲辰"]);
  assert.equal(chart.correctedDateTime, "1990-01-27 08:02");
  assert.equal(chart.ziwei.palaces.length, 12);
});

test("相同输入得到完全相同的命盘", () => {
  assert.deepEqual(createFateChart(profile()), createFateChart(profile()));
});

test("夏令时结束日 0 点后出生：日期还原到前一日", () => {
  const { date, detail } = correctSolarTime(profile({ date: "1990-09-16", time: "00:30", longitude: 116.4 }));
  assert.equal(detail.dstMinutes, -60);
  assert.equal(date.getFullYear(), 1990);
  assert.equal(date.getMonth() + 1, 9);
  assert.equal(date.getDate(), 15, "钟表时间 00:30 还原后应为前一日");
});

test("晚子时紫微按晚子时口径排盘", () => {
  const late = createFateChart(profile({ time: "23:30" }));
  const early = createFateChart(profile({ time: "00:30" }));
  assert.equal(late.ziwei.time, "晚子时", "iztro 晚子时口径");
  assert.equal(early.ziwei.time, "早子时");
  // 晚子时与早子时星曜落宫不同：二者命盘不应完全一致。
  assert.notDeepEqual(late.ziwei.palaces, early.ziwei.palaces);
});

test("未知时辰按正午临时坐标", () => {
  const chart = createFateChart(profile({ timeKnown: false, time: "12:00" }));
  assert.ok(["丙午", "壬午"].includes(chart.bazi.pillars[3].gan + chart.bazi.pillars[3].zhi), "正午临时坐标应落在午时");
});
