"use client";

import { useMemo, useState } from "react";
import type { FateChart } from "@/lib/types";
import {
  createObservationRecord,
  OBSERVATION_STATUS_META,
  type ObservationRecord,
  type ObservationStatus,
} from "@/lib/observations";
import { PrivacyConfirmDialog } from "@/components/shared/PrivacyConfirmDialog";

const STATUS_ORDER: ObservationStatus[] = ["matches", "partial", "differs", "uncertain"];
type ObservationExportKind = "journal" | "calendar";

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function escapeCalendarText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

export function ObservationView({ chart, records, onChange, onExplore }: {
  chart: FateChart;
  records: ObservationRecord[];
  onChange: (records: ObservationRecord[]) => void;
  onExplore: () => void;
}) {
  const [showAllProfiles, setShowAllProfiles] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualDate, setManualDate] = useState(today());
  const [manualReviewOn, setManualReviewOn] = useState(dateAfter(30));
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingExport, setPendingExport] = useState<ObservationExportKind | null>(null);

  const visibleRecords = useMemo(() => records
    .filter((record) => showAllProfiles || record.profileId === chart.profile.id)
    .sort((a, b) => `${b.observedOn}${b.createdAt}`.localeCompare(`${a.observedOn}${a.createdAt}`)), [chart.profile.id, records, showAllProfiles]);
  const reviewed = visibleRecords.filter((record) => record.status !== "pending");
  const scheduled = visibleRecords.filter((record) => record.reviewOn);
  const dueCount = scheduled.filter((record) => record.status === "pending" && record.reviewOn! <= today()).length;
  const counts = {
    pending: visibleRecords.filter((record) => record.status === "pending").length,
    matches: visibleRecords.filter((record) => record.status === "matches").length,
    partial: visibleRecords.filter((record) => record.status === "partial").length,
    differs: visibleRecords.filter((record) => record.status === "differs").length,
    uncertain: visibleRecords.filter((record) => record.status === "uncertain").length,
  };

  const summary = !reviewed.length
    ? "先留下一个问题或一段真实经历。等事实发生后再回来核对，不必急着证明任何结论。"
    : counts.partial > 0 && counts.partial >= Math.max(counts.matches, counts.differs)
      ? `已复盘 ${reviewed.length} 条，其中部分符合较多。建议保留“符合的部分”和“未对应的部分”，复盘时分别核对成立条件。`
    : counts.matches === counts.differs
      ? `已复盘 ${reviewed.length} 条，符合与不符合的记录相近。当前最重要的是继续积累反例和具体情境。`
      : counts.matches > counts.differs
        ? `已复盘 ${reviewed.length} 条，其中符合记录较多。仍要保留部分符合、不符合与不确定记录，避免只记住“说中”的部分。`
        : `已复盘 ${reviewed.length} 条，其中不符合记录较多。这些反例同样重要，可以帮助你判断哪些规则对自己并不适用。`;

  function update(id: string, change: Partial<ObservationRecord>) {
    onChange(records.map((record) => record.id === id ? {
      ...record,
      ...change,
      reviewedAt: change.status && change.status !== "pending" ? new Date().toISOString() : record.reviewedAt,
    } : record));
  }

  function remove(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    onChange(records.filter((record) => record.id !== id));
    setPendingDelete(null);
  }

  function addManualRecord() {
    const title = manualTitle.trim();
    const note = manualNote.trim();
    if (!title && !note) return;
    const record = createObservationRecord({
      profileId: chart.profile.id,
      profileName: chart.profile.name || "未命名命盘",
      source: "manual",
      sourceId: `manual-${Date.now()}`,
      title: title || "一段真实经历",
      question: "这段经历与之前的观察有什么对应、差异或新的解释？",
      observedOn: manualDate,
      reviewOn: manualReviewOn || undefined,
    });
    onChange([{ ...record, note }, ...records]);
    setManualTitle("");
    setManualNote("");
    setManualDate(today());
    setManualReviewOn(dateAfter(30));
    setManualOpen(false);
  }

  function exportJournal() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records: visibleRecords }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cyberfate-observations-${today()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setPendingExport(null);
  }

  function exportReviewCalendar() {
    const entries = scheduled.map((record) => {
      const day = record.reviewOn!.replaceAll("-", "");
      return [
        "BEGIN:VEVENT",
        `UID:${record.id}@cyberfate.local`,
        `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:${escapeCalendarText(`复盘：${record.title}`)}`,
        `DESCRIPTION:${escapeCalendarText(`${record.question}\n此提醒来自 Cyberfate 本地观测簿。`)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
    const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cyberfate//Observation Review//ZH-CN", ...entries, "END:VCALENDAR", ""].join("\r\n");
    const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cyberfate-review-${today()}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setPendingExport(null);
  }

  return (
    <div className="view-stack observation-view">
      <section className="page-intro observation-intro">
        <div><span className="eyebrow">记录 · 核对 · 修正</span><h1>观测簿</h1><p>把当时的问题和后来发生的事实放在一起。符合、反例和不确定，同样值得保留。</p></div>
        <button className="journal-add-button" onClick={() => setManualOpen((value) => !value)}>{manualOpen ? "收起记录" : "记录真实经历"}</button>
      </section>

      <section className="observation-summary">
        <div className="summary-copy"><span>阶段复盘</span><h2>{visibleRecords.length ? `已留下 ${visibleRecords.length} 条观测` : "从第一条现实记录开始"}</h2><p>{summary}</p>{dueCount > 0 && <b className="review-due-badge">有 {dueCount} 条已到复盘日期</b>}</div>
        <div className="summary-counts" aria-label="观测状态统计">
          <span><small>待观察</small><b>{counts.pending}</b></span>
          <span><small>符合</small><b>{counts.matches}</b></span>
          <span><small>部分符合</small><b>{counts.partial}</b></span>
          <span><small>不符合</small><b>{counts.differs}</b></span>
          <span><small>暂不确定</small><b>{counts.uncertain}</b></span>
        </div>
      </section>

      {manualOpen && <section className="manual-observation-form">
        <header><span>过去或此刻</span><h2>记录一段真实经历</h2><p>先写事实，再决定它是否对应某条观察。</p></header>
        <div>
          <label><span>发生日期</span><input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} /></label>
          <label><span>计划复盘</span><input type="date" min={today()} value={manualReviewOn} onChange={(event) => setManualReviewOn(event.target.value)} /></label>
          <label><span>简短标题</span><input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="例如：换了新的工作方向" /></label>
          <label className="manual-note"><span>发生了什么</span><textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="只写你愿意留在本机的事实与感受" /></label>
          <button onClick={addManualRecord} disabled={!manualTitle.trim() && !manualNote.trim()}>保存到观测簿</button>
        </div>
      </section>}

      <div className="journal-toolbar">
        <div className="journal-scope" role="group" aria-label="档案范围">
          <button className={!showAllProfiles ? "active" : ""} onClick={() => setShowAllProfiles(false)}>当前档案</button>
          <button className={showAllProfiles ? "active" : ""} onClick={() => setShowAllProfiles(true)}>全部档案</button>
        </div>
        {!!visibleRecords.length && <div className="journal-actions"><button className="journal-export" onClick={() => setPendingExport("journal")}>导出观测记录</button>{scheduled.length > 0 && <button className="journal-export" onClick={() => setPendingExport("calendar")}>加入日历提醒</button>}</div>}
      </div>

      {visibleRecords.length ? <section className="observation-list">
        {visibleRecords.map((record) => <article className={`observation-record status-${record.status}`} key={record.id}>
          <header>
            <div><span>{record.source === "manual" ? "真实经历" : record.source === "time" ? "时间观察" : record.source === "relationship" ? "关系观察" : "盘面观察"}</span><h2>{record.title}</h2></div>
            <time>{record.observedOn}</time>
          </header>
          <blockquote>{record.question}</blockquote>
          <div className="observation-status" role="group" aria-label="现实核对状态">
            {STATUS_ORDER.map((status) => <button key={status} aria-pressed={record.status === status} className={record.status === status ? "active" : ""} onClick={() => update(record.id, { status })}>{OBSERVATION_STATUS_META[status].short}</button>)}
          </div>
          <label className="review-date-field"><span>下次复盘日期</span><input type="date" min={today()} value={record.reviewOn ?? ""} onChange={(event) => update(record.id, { reviewOn: event.target.value || undefined })} /></label>
          <label><span>现实记录</span><textarea value={record.note} onChange={(event) => update(record.id, { note: event.target.value })} placeholder="记录对应、反例、当时情境或仍不确定的原因" /></label>
          <footer><span>{record.profileName} · 只保存在当前浏览器</span><button className={pendingDelete === record.id ? "confirm" : ""} onClick={() => remove(record.id)}>{pendingDelete === record.id ? "再次点击确认删除" : "删除"}</button></footer>
        </article>)}
      </section> : <section className="observation-empty">
        <div aria-hidden="true"><i /><b>记</b></div><span>还没有观测记录</span><h2>先留下一个值得回来的问题</h2><p>你可以从“此刻”的三条观察中选择一个，也可以记录已经发生的真实经历。</p><button onClick={onExplore}>返回此刻选择问题</button>
      </section>}
      {pendingExport && <PrivacyConfirmDialog
        title={pendingExport === "journal" ? "导出观测记录？" : "下载复盘日历？"}
        description={pendingExport === "journal"
          ? "导出的 JSON 将包含当前范围内的档案称呼、观察标题、现实问题、核对状态、自由笔记与日期。文件只会下载到你的设备，不会上传到 Cyberfate；请勿直接公开分享。"
          : "日历文件将包含观察标题、现实问题与复盘日期。文件只会下载到你的设备；导入系统或第三方日历后，是否同步到云端取决于你的日历账户设置。"}
        confirmLabel={pendingExport === "journal" ? "确认导出记录" : "确认下载日历"}
        onCancel={() => setPendingExport(null)}
        onConfirm={pendingExport === "journal" ? exportJournal : exportReviewCalendar}
      />}
    </div>
  );
}
