"use client";

import { useMemo, useState } from "react";
import { Solar } from "lunar-javascript";
import type { FateChart } from "@/lib/types";
import { analyzeDaily, type DailyReport } from "@/lib/daily";
import { analyzeMonthly, buildMonthlyReports } from "@/lib/monthly";
import { analyzeYear, FORTUNE_STATE_META } from "@/lib/fortune";
import { ScoreStrip } from "@/components/shared/reading-parts";
import { trackLocalEvent } from "@/lib/product";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const STATE_ORDER = ["favorable", "caution", "change", "limited", "mixed", "quiet"] as const;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface CalendarCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  lunarDay: string;
  report: DailyReport;
}

export function FortuneCalendar({ chart, savedSourceIds = [], onSaveObservation }: {
  chart: FateChart;
  savedSourceIds?: string[];
  onSaveObservation?: (sourceId: string, title: string, question: string, observedOn: string) => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), key: dateKey(now) };
  }, []);
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [selectedKey, setSelectedKey] = useState(today.key);

  // 年带：当年 12 个流月（月中口径）与该年流年取象。
  const yearReport = useMemo(() => analyzeYear(chart, cursor.year), [chart, cursor.year]);
  const monthsOfYear = useMemo(() => buildMonthlyReports(chart, 12, new Date(cursor.year, 0, 15)), [chart, cursor.year]);
  const yearMeta = FORTUNE_STATE_META[yearReport.state];

  // 当月：月柱取月中口径（与运势日历导出一致）。
  const monthReport = useMemo(() => analyzeMonthly(chart, new Date(cursor.year, cursor.month, 15)), [chart, cursor]);
  const monthMeta = FORTUNE_STATE_META[monthReport.state];

  // 六周网格：周一起始，覆盖当月前后补位日。
  const cells = useMemo<CalendarCell[]>(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = new Date(cursor.year, cursor.month, 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return {
        key: dateKey(date),
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month,
        isToday: dateKey(date) === today.key,
        lunarDay: Solar.fromDate(date).getLunar().getDayInChinese(),
        report: analyzeDaily(chart, date),
      };
    });
  }, [chart, cursor, today.key]);

  // 选中之日：独立于网格计算，翻月后仍显示其详情。
  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedKey.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }, [selectedKey]);
  const selectedReport = useMemo(() => analyzeDaily(chart, selectedDate), [chart, selectedDate]);
  const selectedMonth = useMemo(() => analyzeMonthly(chart, selectedDate), [chart, selectedDate]);
  const selectedMeta = FORTUNE_STATE_META[selectedReport.state];
  const selectedLunar = useMemo(() => Solar.fromDate(selectedDate).getLunar(), [selectedDate]);
  const selectedSourceId = `daily-${selectedKey}`;
  const selectedSaved = savedSourceIds.includes(selectedSourceId);

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function gotoMonth(month: number) {
    setCursor((current) => ({ year: current.year, month }));
  }

  function selectCell(cell: CalendarCell) {
    setSelectedKey(cell.key);
    if (!cell.inMonth) setCursor((current) => {
      const [year, month] = cell.key.split("-").map(Number);
      return year === current.year && month - 1 === current.month ? current : { year, month: month - 1 };
    });
  }

  function goToday() {
    setCursor({ year: today.year, month: today.month });
    setSelectedKey(today.key);
    trackLocalEvent("fortune_calendar_back_today");
  }

  return (
    <section className="fortune-section fortune-calendar-section" aria-label="时运日历">
      <header className="fortune-heading">
        <div><span>日 · 月 · 年 三层同观</span><h2>时运日历</h2></div>
        <p>逐日翻看流日六象，配合所在流月与当年流年</p>
      </header>

      <div className="fcal">
        <div className="fcal-year">
          <div className={`fcal-year-main state-${yearReport.state}`}>
            <span>流年取象 · {yearReport.ganZhi}</span>
            <b>{cursor.year} 年</b>
            <em>{yearMeta.seal} · {yearMeta.label}</em>
          </div>
          <div className="fcal-months">
            {monthsOfYear.map((month, index) => {
              const meta = FORTUNE_STATE_META[month.state];
              const current = index === cursor.month;
              return (
                <button
                  key={month.monthStart}
                  className={`fcal-month-chip state-${month.state}${current ? " current" : ""}`}
                  onClick={() => gotoMonth(index)}
                  aria-label={`${cursor.year}年${index + 1}月 流月${month.ganZhi} · ${meta.label}`}
                  aria-current={current ? "true" : undefined}
                >
                  <b>{index + 1}月</b>
                  <i aria-hidden="true">{meta.seal}</i>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fcal-main">
          <div className="fcal-grid-wrap">
            <div className="fcal-toolbar">
              <div className="fcal-toolbar-nav">
                <button onClick={() => shiftMonth(-1)} aria-label="上一月">‹</button>
                <b className={`state-${monthReport.state}`}>{cursor.year} 年 {cursor.month + 1} 月 · 流月{monthReport.ganZhi}<em>{monthMeta.label}</em></b>
                <button onClick={() => shiftMonth(1)} aria-label="下一月">›</button>
              </div>
              <button className="fcal-today-btn" onClick={goToday}>回到今天</button>
            </div>
            <div className="fcal-week" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="fcal-grid">
              {cells.map((cell) => {
                const meta = FORTUNE_STATE_META[cell.report.state];
                const selected = cell.key === selectedKey;
                return (
                  <button
                    key={cell.key}
                    className={[
                      "fcal-cell",
                      `state-${cell.report.state}`,
                      cell.inMonth ? "" : "fcal-out",
                      cell.isToday ? "fcal-is-today" : "",
                      selected ? "fcal-selected" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => selectCell(cell)}
                    aria-pressed={selected}
                    title={`${cell.key} ${cell.report.ganZhi} · ${meta.label}`}
                  >
                    <b>{cell.day}</b>
                    <small>{cell.lunarDay}</small>
                  </button>
                );
              })}
            </div>
            <div className="fcal-legend" aria-hidden="true">
              {STATE_ORDER.map((state) => (
                <span key={state} className={`state-${state}`}><i />{FORTUNE_STATE_META[state].label}</span>
              ))}
            </div>
            <p className="fcal-note">格子底色、左侧色条与日期颜色为当日六象，玉色方块即今天；月柱以节气为界、流年以立春为界。</p>
          </div>

          <aside className={`fcal-detail state-${selectedReport.state}`}>
            <span>选中之日 · {selectedKey} {selectedReport.ganZhi} · 农历{selectedLunar.getMonthInChinese()}月{selectedLunar.getDayInChinese()} · 流月{selectedMonth.ganZhi}</span>
            <h3>{selectedMeta.label}</h3>
            <p className="fcal-detail-subtitle">{selectedMeta.subtitle}</p>
            <p>{selectedMeta.explanation}</p>
            <ScoreStrip scores={selectedReport.scores} />
            <div className="fcal-evidence">
              <b>取象依据</b>
              <ul>{selectedReport.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
              <p><b>反向提醒</b>{selectedReport.counterpoint}</p>
              <p><b>现实观测</b>{selectedReport.observation}</p>
            </div>
            {onSaveObservation && (
              <button
                className={selectedSaved ? "fortune-save saved" : "fortune-save"}
                disabled={selectedSaved}
                onClick={() => onSaveObservation(selectedSourceId, `流日 ${selectedReport.ganZhi} · ${selectedMeta.label}`, selectedReport.observation, selectedKey)}
              >
                {selectedSaved ? "已加入观测簿" : "记下这一日"}
              </button>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
