import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeMonthly, buildMonthlyReports, getMonthlyGanZhi, type MonthlyReport } from "../lib/monthly";
import { buildFortuneCalendar, CALENDAR_DAILY_DAYS, CALENDAR_MONTHLY_MONTHS } from "../lib/calendar-export";
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

test("月柱按节气月取值", () => {
  assert.equal(`${getMonthlyGanZhi(new Date(2026, 10, 23)).gan}${getMonthlyGanZhi(new Date(2026, 10, 23)).zhi}`, "己亥", "立冬后为亥月");
  assert.equal(`${getMonthlyGanZhi(new Date(2026, 11, 15)).gan}${getMonthlyGanZhi(new Date(2026, 11, 15)).zhi}`, "庚子", "大雪后为子月");
  assert.equal(`${getMonthlyGanZhi(new Date(2027, 0, 15)).gan}${getMonthlyGanZhi(new Date(2027, 0, 15)).zhi}`, "辛丑");
});

test("流月报告可复现且结构完整", () => {
  const first: MonthlyReport = analyzeMonthly(chart, new Date(2026, 10, 23));
  const second = analyzeMonthly(chart, new Date(2026, 10, 23));
  assert.deepEqual(first, second);
  assert.equal(first.monthStart, "2026-11-01");
  assert.equal(first.ganZhi, "己亥");
  assert.ok(first.evidence.length > 0);
  assert.ok(first.counterpoint.length > 0);
});

test("十二个流月报告序列", () => {
  const reports = buildMonthlyReports(chart, 12, new Date(2026, 10, 23));
  assert.equal(reports.length, 12);
  assert.equal(reports[0].ganZhi, "己亥");
  assert.equal(reports[1].ganZhi, "庚子", "12 月为子月");
  assert.equal(reports[2].ganZhi, "辛丑", "1 月为丑月");
  for (const report of reports) {
    assert.ok(report.monthStart.endsWith("-01"), "月起点为公历 1 日");
  }
});

test("运势日历包含三层事件且可重复导入", () => {
  const now = new Date(2026, 10, 23);
  const calendar = buildFortuneCalendar(chart, now);
  const events = calendar.match(/BEGIN:VEVENT/g);
  assert.equal(events?.length, 6 + CALENDAR_MONTHLY_MONTHS + CALENDAR_DAILY_DAYS, "6 流年 + 12 流月 + 60 流日");
  assert.ok(calendar.includes("BEGIN:VCALENDAR"));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  assert.ok(calendar.includes("DTSTART;VALUE=DATE:20260101"), "流年事件从公历年首日开始");
  assert.ok(calendar.includes("SUMMARY:流日 辛丑"), "首日流日事件");
  assert.ok(calendar.includes("SUMMARY:流月 2026-11 己亥"));
  assert.ok(calendar.includes("SUMMARY:流年 2026"), "流年事件存在");
  assert.ok(calendar.includes("@cyberfate.local"), "UID 域名");
  // 相同输入完全相同，保证重复导入覆盖而非叠加。
  assert.equal(calendar, buildFortuneCalendar(chart, now));
  // 描述文本中的换行必须转义。
  assert.ok(calendar.split("\r\n").every((line) => !line.includes("SUMMARY:流") || !line.slice(8).includes("\n")));
});
