import type { FateChart } from "@/lib/types";
import { buildFortuneReport } from "@/lib/fortune";
import { analyzeDaily } from "@/lib/daily";
import { buildMonthlyReports, type MonthlyReport } from "@/lib/monthly";

export const CALENDAR_DAILY_DAYS = 60;
export const CALENDAR_MONTHLY_MONTHS = 12;

function escapeCalendarText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function allDayDate(year: number, month: number, day: number) {
  return `${year}${pad(month)}${pad(day)}`;
}

function shiftDay(year: number, month: number, day: number, days: number) {
  const date = new Date(year, month - 1, day + days);
  return allDayDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

interface CalendarEvent {
  uid: string;
  dateStart: string;
  dateEnd: string;
  summary: string;
  description: string;
}

function eventLines(event: CalendarEvent): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTART;VALUE=DATE:${event.dateStart}`,
    `DTEND;VALUE=DATE:${event.dateEnd}`,
    `SUMMARY:${escapeCalendarText(event.summary)}`,
    `DESCRIPTION:${escapeCalendarText(event.description)}`,
    "END:VEVENT",
  ];
}

function describeFortune(item: { evidence: string[]; counterpoint: string; observation: string }): string {
  return [
    "取象依据：",
    ...item.evidence.map((line) => `· ${line}`),
    `反向提醒：${item.counterpoint}`,
    `现实观测：${item.observation}`,
    "取象为传统规则推演，不是吉凶等级，不构成任何决策依据。",
  ].join("\n");
}

/**
 * 三层运势日历：未来 6 个流年、12 个流月、60 个流日，全部为全天事件。
 * 相同输入生成完全相同的 UID，重复导入日历时覆盖旧条目而非叠加。
 */
export function buildFortuneCalendar(chart: FateChart, now = new Date()): string {
  const profileTag = chart.profile.id || "chart";
  const events: CalendarEvent[] = [];

  // 流年：以立春为口径，事件放公历年首日，说明中注明差异。
  for (const year of buildFortuneReport(chart, now.getFullYear()).years) {
    events.push({
      uid: `${profileTag}-year-${year.year}@cyberfate.local`,
      dateStart: allDayDate(year.year, 1, 1),
      dateEnd: allDayDate(year.year + 1, 1, 1),
      summary: `流年 ${year.year} ${year.ganZhi} · ${year.state === "favorable" ? "得时乘势" : year.state === "caution" ? "守正慎行" : year.state === "change" ? "动象已彰" : year.state === "limited" ? "气弱待时" : year.state === "mixed" ? "吉凶相参" : "象静无征"}`,
      description: `年柱以立春为界（1 月 1 日至立春间仍属上一年干支）。\n${describeFortune(year)}`,
    });
  }

  // 流月：月柱以节气为界，每月事件取月中口径，跨节气月前后数日有出入。
  const months: MonthlyReport[] = buildMonthlyReports(chart, CALENDAR_MONTHLY_MONTHS, now);
  for (const month of months) {
    const [year, calendarMonth] = month.monthStart.split("-").map(Number);
    const nextMonth = new Date(year, calendarMonth, 1);
    events.push({
      uid: `${profileTag}-month-${month.monthStart}@cyberfate.local`,
      dateStart: month.monthStart.replaceAll("-", ""),
      dateEnd: `${nextMonth.getFullYear()}${pad(nextMonth.getMonth() + 1)}${pad(nextMonth.getDate())}`,
      summary: `流月 ${month.monthStart.slice(0, 7)} ${month.ganZhi} · ${month.state === "favorable" ? "得时乘势" : month.state === "caution" ? "守正慎行" : month.state === "change" ? "动象已彰" : month.state === "limited" ? "气弱待时" : month.state === "mixed" ? "吉凶相参" : "象静无征"}`,
      description: `月柱以节气为界，此处取公历月月中口径，月初数日或属上一节气月。\n${describeFortune(month)}`,
    });
  }

  // 流日：未来 60 天逐日观察。
  for (let index = 0; index < CALENDAR_DAILY_DAYS; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index);
    const daily = analyzeDaily(chart, date);
    const dateKey = allDayDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const label = daily.state === "favorable" ? "得时乘势" : daily.state === "caution" ? "守正慎行" : daily.state === "change" ? "动象已彰" : daily.state === "limited" ? "气弱待时" : daily.state === "mixed" ? "吉凶相参" : "象静无征";
    events.push({
      uid: `${profileTag}-day-${dateKey}@cyberfate.local`,
      dateStart: dateKey,
      dateEnd: shiftDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 1),
      summary: `流日 ${daily.ganZhi} · ${label}`,
      description: `流日只观当日表层信号，宜与流年、大运同参。\n${describeFortune(daily)}`,
    });
  }

  const calendarName = `Cyberfate 运势观察 · ${chart.profile.name || "命盘"}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cyberfate//Fortune Calendar//ZH-CN",
    `X-WR-CALNAME:${escapeCalendarText(calendarName)}`,
    "X-WR-CALDESC:规则取象导出，供自我观察，不构成决策依据",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
