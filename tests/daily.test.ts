import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeDaily, getDailyGanZhi, type DailyReport } from "../lib/daily";
import { createFateChart } from "../lib/engines";
import type { BirthProfile } from "../lib/types";

function profile(): BirthProfile {
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
  };
}

const chart = createFateChart(profile());
// 固定命例日支为辰。

test("当日日柱干支取当日历元", () => {
  const { gan, zhi } = getDailyGanZhi(new Date(2026, 10, 23));
  assert.equal(`${gan}${zhi}`, "辛丑", "2026-11-23 流日干支");
  const first = getDailyGanZhi(new Date(2026, 11, 1));
  const second = getDailyGanZhi(new Date(2026, 11, 1));
  assert.deepEqual(first, second);
});

test("流日报告结构完整且可复现", () => {
  const date = new Date(2026, 10, 23);
  const first: DailyReport = analyzeDaily(chart, date);
  const second = analyzeDaily(chart, date);
  assert.deepEqual(first, second, "相同输入必须得到相同流日报告");
  assert.equal(first.date, "2026-11-23");
  assert.equal(first.ganZhi, "辛丑");
  assert.ok(first.scores.support >= 0 && first.scores.pressure >= 0, "计数非负");
  assert.ok(Number.isInteger(first.scores.support) && Number.isInteger(first.scores.pressure), "计数为整数");
  assert.ok(first.evidence.length > 0, "必有取象依据");
});

test("流日冲日支时动象信号显现", () => {
  // 固定命例日支为辰，戌日与辰六冲；扫描 2026-12 上旬找到戌日。
  let clashDay: DailyReport | null = null;
  for (let day = 1; day <= 20; day += 1) {
    const report = analyzeDaily(chart, new Date(2026, 11, day));
    if (report.ganZhi[1] === "戌") { clashDay = report; break; }
  }
  assert.ok(clashDay, "扫描窗口内应出现戌日");
  assert.ok(clashDay!.evidence.some((item) => item.includes("六冲")), "冲日支应写入依据");
  assert.ok(clashDay!.scores.movement > 0, "冲日支动象大于零");
});

test("取象始终落在六象之内", () => {
  const states = new Set(["favorable", "caution", "change", "limited", "mixed", "quiet"]);
  for (let day = 1; day <= 30; day += 1) {
    const report = analyzeDaily(chart, new Date(2026, 10, day));
    assert.ok(states.has(report.state), `非法取象：${report.state}`);
    assert.ok(report.counterpoint.length > 0, "必有反向提醒");
    assert.ok(report.observation.length > 0, "必有现实观测建议");
  }
});
