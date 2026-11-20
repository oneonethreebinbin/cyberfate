"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DateTimeFieldProps {
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const YEARS = Array.from({ length: 201 }, (_, index) => 1900 + index);
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function pad(value: number | string) {
  return String(value).padStart(2, "0");
}

export function DateTimeField({ label, type, value, onChange }: DateTimeFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const dateParts = useMemo(() => value.split("-").map(Number), [value]);
  const timeParts = useMemo(() => value.split(":"), [value]);
  const [viewYear, setViewYear] = useState(dateParts[0] || 1990);
  const [viewMonth, setViewMonth] = useState(dateParts[1] || 1);
  const [draftHour, setDraftHour] = useState(timeParts[0] || "00");
  const [draftMinute, setDraftMinute] = useState(timeParts[1] || "00");

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  }

  function selectDay(day: number) {
    onChange(`${viewYear}-${pad(viewMonth)}-${pad(day)}`);
    setOpen(false);
  }

  function confirmTime() {
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  }

  return (
    <div className={`picker-field picker-${type}`} ref={rootRef}>
      <span className="picker-label">{label}</span>
      <button
        type="button"
        className="picker-trigger"
        aria-label={`${label}：${displayValue}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <b>{displayValue}</b>
        <i className={`picker-icon ${type}`} aria-hidden="true" />
      </button>

      {open && type === "date" && (
        <div className="picker-popover date-popover" role="dialog" aria-label="选择公历日期">
          <header className="calendar-header">
            <button type="button" aria-label="上个月" onClick={() => moveMonth(-1)}>‹</button>
            <div>
              <select aria-label="年份" value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))}>
                {YEARS.map((year) => <option key={year} value={year}>{year} 年</option>)}
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
              return <button type="button" className={selected ? "selected" : ""} aria-pressed={selected} key={day} onClick={() => selectDay(day)}>{day}</button>;
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
