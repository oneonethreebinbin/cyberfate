import assert from "node:assert/strict";
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

const base = profile();
const first = createFateChart(base);
const second = createFateChart(base);

assert.deepEqual(first, second, "相同输入必须得到完全相同的命盘");
assert.deepEqual(first.bazi.pillars.map((pillar) => `${pillar.gan}${pillar.zhi}`), ["己巳", "丁丑", "壬辰", "甲辰"], "固定命例四柱发生变化");
assert.equal(first.correctedDateTime, "1990-01-27 08:02", "北京真太阳时校正结果发生变化");
assert.equal(first.ziwei.palaces.length, 12, "紫微盘必须保持十二宫");

const dst = correctSolarTime(profile({ date: "1990-06-15", time: "12:00", longitude: 120 }));
assert.equal(dst.detail.dstMinutes, -60, "1990 年夏令时必须还原一小时");
assert.equal(dst.detail.clockTime, "1990-06-15 12:00");

const lateZi = createFateChart(profile({ date: "1990-01-27", time: "23:30", longitude: 120, useTrueSolarTime: false }));
const earlyZi = createFateChart(profile({ date: "1990-01-27", time: "00:30", longitude: 120, useTrueSolarTime: false }));
assert.notDeepEqual(lateZi.ziwei.palaces, earlyZi.ziwei.palaces, "同一公历日的晚子时与早子时必须使用不同紫微 timeIndex");
assert.equal(lateZi.bazi.pillars[2].gan + lateZi.bazi.pillars[2].zhi, "壬辰", "晚子时 sect 2 的日柱口径发生变化");

const unknown = createFateChart(profile({ time: "12:00", timeKnown: false }));
assert.equal(unknown.profile.timeKnown, false, "未知时辰标记必须保留到结果中");

console.log("✓ 6 组排盘回归检查通过");
