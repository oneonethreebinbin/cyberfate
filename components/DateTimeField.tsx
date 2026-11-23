"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

interface DateTimeFieldProps {
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function pad(value: number | string) {
  return String(value).padStart(2, "0");
}

export function DateTimeField({ label, type, value, onChange, min = "1900-01-01", max }: DateTimeFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const dateParts = useMemo(() => value.split("-").map(Number), [value]);
  const timeParts = useMemo(() => value.split(":"), [value]);
  const [viewYear, setViewYear] = useState(dateParts[0] || 1990);
  const [viewMonth, setViewMonth] = useState(dateParts[1] || 1);
  const [draftHour, setDraftHour] = useState(timeParts[0] || "00");
  const [draftMinute, setDraftMinute] = useState(timeParts[1] || "00");
  const minYear = Number(min.slice(0, 4)) || 1900;
  const maxYear = Number(max?.slice(0, 4)) || new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index), [maxYear, minYear]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      const preferred = rootRef.current?.querySelector<HTMLElement>(type === "date" ? ".calendar-days button.selected:not(:disabled), .calendar-days button:not(:disabled)" : ".time-selectors select");
      preferred?.focus();
    });
  }, [open, type]);

  function toggle() {
    if (!open) {
      if (type === "date") {
        setViewYear(dateParts[0] || 1990);
        setViewMonth(dateParts[1] || 1);
      } else {
        setDraftHour(timeParts[0] || "00");
        setDraftMinute(timeParts[1] || "00");
      }
    }
    setOpen((current) => !current);
  }

  const displayValue = type === "date" ? value.replaceAll("-", " / ") : value;
  const firstWeekday = type === "date" ? (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7 : 0;
  const daysInMonth = type === "date" ? new Date(viewYear, viewMonth, 0).getDate() : 0;

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth - 1 + offset, 1);
    const nextYear = Math.min(maxYear, Math.max(minYear, next.getFullYear()));
    const nextMonth = nextYear !== next.getFullYear() ? (nextYear === minYear ? 1 : 12) : next.getMonth() + 1;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  }

  function selectDay(day: number) {
    const nextValue = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
    if (nextValue < min || (max && nextValue > max)) return;
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function confirmTime() {
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleDayKey(event: React.KeyboardEvent<HTMLButtonElement>, day: number) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const nextDay = day + moves[event.key];
    const target = rootRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${nextDay}"]:not(:disabled)`);
    target?.focus();
  }

  return (
    <div className={`picker-field picker-${type}`} ref={rootRef}>
      <span className="picker-label" id={labelId}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="picker-trigger"
        aria-labelledby={labelId}
        aria-description={displayValue ? `当前值：${displayValue}` : "尚未选择"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <b className={displayValue ? "" : "placeholder"}>{displayValue || (type === "date" ? "请选择日期" : "请选择时间")}</b>
        <i className={`picker-icon ${type}`} aria-hidden="true" />
      </button>

      {open && type === "date" && (
        <div className="picker-popover date-popover" role="dialog" aria-label="选择公历日期">
          <header className="calendar-header">
            <button type="button" aria-label="上个月" onClick={() => moveMonth(-1)}>‹</button>
            <div>
              <select aria-label="年份" value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))}>
                {years.map((year) => <option key={year} value={year}>{year} 年</option>)}
              </select>
              <select aria-label="月份" value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 月</option>)}
              </select>
            </div>
            <button type="button" aria-label="下个月" onClick={() => moveMonth(1)}>›</button>
          </header>
          <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: firstWeekday }, (_, index) => <i key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const selected = dateParts[0] === viewYear && dateParts[1] === viewMonth && dateParts[2] === day;
              const dateValue = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
              const disabled = dateValue < min || Boolean(max && dateValue > max);
              return <button type="button" data-day={day} disabled={disabled} className={selected ? "selected" : ""} aria-pressed={selected} key={day} onKeyDown={(event) => handleDayKey(event, day)} onClick={() => selectDay(day)}>{day}</button>;
            })}
          </div>
        </div>
      )}

      {open && type === "time" && (
        <div className="picker-popover time-popover" role="dialog" aria-label="选择出生时间">
          <span className="time-caption">24 小时制</span>
          <div className="time-selectors">
            <label><span>时</span><select value={draftHour} onChange={(event) => setDraftHour(event.target.value)}>{HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            <b>:</b>
            <label><span>分</span><select value={draftMinute} onChange={(event) => setDraftMinute(event.target.value)}>{MINUTES.map((minute) => <option key={minute}>{minute}</option>)}</select></label>
          </div>
          <button type="button" className="time-confirm" onClick={confirmTime}>确认时间</button>
        </div>
      )}
    </div>
  );
}
