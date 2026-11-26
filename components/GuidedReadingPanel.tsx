"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Icon";
import type { ExploreMode, ReadingDepth } from "@/components/types";
import type { GuidedReport, RuleEvidence } from "@/lib/guided-reading";
import type { ObservationDraft, ObservationRecord, ObservationStatus } from "@/lib/observations";
import { OBSERVATION_STATUS_META } from "@/lib/observations";
import { trackLocalEvent } from "@/lib/product";
import { METHOD_REFERENCES } from "@/lib/references";
import { deviceDateAfter, deviceToday } from "@/lib/birth";
import styles from "./GuidedReadingPanel.module.css";

const VALIDATION_STATUSES: ObservationStatus[] = ["pending", "matches", "partial", "differs", "uncertain"];
const READING_DEPTHS: Array<{ id: ReadingDepth; label: string; hint: string }> = [
  { id: "brief", label: "简读", hint: "30 秒抓重点" },
  { id: "guided", label: "导读", hint: "看现实表现" },
  { id: "expert", label: "证据", hint: "查规则与边界" },
];
const SOURCE_NAMES = new Map(METHOD_REFERENCES.map((item) => [item.id, item.title]));

function strengthLabel(level: RuleEvidence["strength"]["level"]) {
  if (level === "strong") return "多项规则支持";
  if (level === "combined") return "组合线索";
  return "等待现实核对";
}

function EvidenceLedger({ evidence, compact = false }: { evidence: RuleEvidence; compact?: boolean }) {
  return <div className={`${styles.ledger} ${compact ? styles.compactLedger : ""}`}>
    <div className={styles.ledgerMeta}>
      <span><small>所属体系</small>{evidence.systems.join(" · ")}</span>
      <span><small>规则版本</small>{evidence.ruleVersion}</span>
      <span data-strength={evidence.strength.level}><small>证据强度</small>{strengthLabel(evidence.strength.level)}</span>
      <span data-conflict={evidence.conflict.level}><small>冲突信号</small>{evidence.conflict.label}</span>
    </div>
    {!compact && <>
      <p className={styles.school}><b>流派与口径</b>{evidence.school}</p>
      <div className={styles.ledgerColumns}>
        <section><b>本次命中的盘面信号</b><ul>{evidence.signals.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><b>结论成立条件</b><ul>{evidence.conditions.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><b>尚未纳入</b><ul>{evidence.missing.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
      <p className={styles.conflictNote}><b>{evidence.conflict.label}</b>{evidence.conflict.detail}</p>
      <div className={styles.sources}><b>来源</b>{evidence.sourceIds.map((id) => <Link key={id} href={`/method#source-${id}`}>{SOURCE_NAMES.get(id) ?? id}</Link>)}</div>
      <p className={styles.strengthReason}>{evidence.strength.reason}</p>
    </>}
  </div>;
}

export function GuidedReadingPanel({ report, records, profileId, depth, onDepthChange, onExplore, onValidate, onOpenObservations }: {
  report: GuidedReport;
  records: ObservationRecord[];
  profileId: string;
  depth: ReadingDepth;
  onDepthChange: (depth: ReadingDepth) => void;
  onExplore: (mode: ExploreMode) => void;
  onValidate: (draft: ObservationDraft) => void;
  onOpenObservations: () => void;
}) {
  const [activeThemeId, setActiveThemeId] = useState(report.themes[0]?.id ?? "");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [activeValidation, setActiveValidation] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<ObservationStatus | null>(null);
  const [validationNote, setValidationNote] = useState("");
  const [observedOn, setObservedOn] = useState(deviceToday());
  const [reviewOn, setReviewOn] = useState(deviceDateAfter(30));
  const validationRef = useRef<HTMLElement>(null);
  const activeTheme = report.themes.find((item) => item.id === activeThemeId) ?? report.themes[0];
  const selected = report.questions.find((item) => item.id === activeQuestion) ?? null;
  const validating = report.themes.find((item) => item.id === activeValidation) ?? null;

  function chooseDepth(nextDepth: ReadingDepth) {
    onDepthChange(nextDepth);
    trackLocalEvent("reading_depth_changed", { depth: nextDepth, intent: report.intent });
  }

  function handleDepthKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? READING_DEPTHS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + READING_DEPTHS.length) % READING_DEPTHS.length;
    const next = READING_DEPTHS[nextIndex].id;
    chooseDepth(next);
    window.requestAnimationFrame(() => document.getElementById(`reading-depth-${next}`)?.focus());
  }

  function chooseTheme(id: string) {
    setActiveThemeId(id);
    setActiveValidation(null);
  }

  function chooseQuestion(id: string) {
    setActiveQuestion((current) => current === id ? null : id);
    trackLocalEvent("guided_question_opened", { intent: report.intent, question: id });
  }

  function startValidation(id: string) {
    if (activeValidation === id) {
      setActiveValidation(null);
      return;
    }
    setActiveValidation(id);
    setValidationStatus(null);
    setValidationNote("");
    setObservedOn(deviceToday());
    setReviewOn(deviceDateAfter(30));
    trackLocalEvent("observation_started", { intent: report.intent, theme: id });
    window.requestAnimationFrame(() => validationRef.current?.focus());
  }

  function saveValidation() {
    if (!validating || !validationStatus) return;
    onValidate({
      source: report.intent === "timing" ? "time" : report.intent === "relationship" ? "relationship" : "insight",
      sourceId: `guided-${report.intent}-${validating.id}`,
      title: validating.title,
      question: `“${validating.detail}”与你的现实经历是否相符？`,
      status: validationStatus,
      note: validationStatus === "pending" ? "" : validationNote.trim(),
      observedOn,
      reviewOn: reviewOn || undefined,
    });
    setActiveValidation(null);
  }

  if (!activeTheme) return null;
  const saved = records.some((record) => record.profileId === profileId && record.sourceId === `guided-${report.intent}-${activeTheme.id}`);

  return (
    <section className={styles.shell} aria-labelledby="guided-reading-title">
      <header className={styles.readingToolbar}>
        <div><span>阅读深度</span><p>先抓住重点，需要时再展开依据。</p></div>
        <div className={styles.depthButtons} role="group" aria-label="选择阅读深度">
          {READING_DEPTHS.map((item, index) => <button
            type="button"
            id={`reading-depth-${item.id}`}
            key={item.id}
            aria-pressed={depth === item.id}
            tabIndex={depth === item.id ? 0 : -1}
            onClick={() => chooseDepth(item.id)}
            onKeyDown={(event) => handleDepthKey(event, index)}
          ><b>{item.label}</b><small>{item.hint}</small></button>)}
        </div>
      </header>

      <div className={styles.answerBand}>
        <div className={styles.answerCopy}>
          <span>{report.eyebrow}</span>
          <h1 id="guided-reading-title">{report.title}</h1>
          <p>{report.summary}</p>
        </div>
        <aside className={styles.actionNote}>
          <small>现在可以做什么</small>
          <p>{report.recommendation}</p>
          <button type="button" onClick={() => onExplore(report.nextMode)}>{report.nextLabel}<Icon name="arrow" size={15} /></button>
        </aside>
      </div>

      <nav className={styles.themeSelector} aria-label="三条核心线索">
        {report.themes.map((theme, index) => <button
          type="button"
          key={theme.id}
          aria-current={activeTheme.id === theme.id ? "true" : undefined}
          onClick={() => chooseTheme(theme.id)}
        ><span>0{index + 1}</span><small>{theme.label}</small><b>{theme.title}</b></button>)}
      </nav>

      <article className={styles.themeStage}>
        <div className={styles.themeCopy}>
          <header><span>{activeTheme.label}</span><em>{strengthLabel(activeTheme.evidence.strength.level)}</em></header>
          <h2>{activeTheme.title}</h2>
          <p>{activeTheme.detail}</p>
          {depth !== "brief" && <ul>{activeTheme.manifestations.map((item) => <li key={item}>{item}</li>)}</ul>}
          {depth === "guided" && <p className={styles.boundary}><strong>别这样误读</strong>{activeTheme.boundary}</p>}
        </div>
        <aside className={styles.validationCallout}>
          <small>把判断交给现实</small>
          <p>你不必现在判定对错，也可以先留到未来观察。</p>
          {saved
            ? <button type="button" className={styles.savedValidation} onClick={onOpenObservations}>已保存 · 去观测簿复盘</button>
            : <button type="button" className={styles.validateButton} aria-expanded={activeValidation === activeTheme.id} aria-controls="guided-validation-panel" onClick={() => startValidation(activeTheme.id)}>{activeValidation === activeTheme.id ? "收起验证" : "验证这条线索"}</button>}
        </aside>
      </article>

      {validating && <section ref={validationRef} tabIndex={-1} id="guided-validation-panel" className={styles.validationPanel} aria-labelledby="validation-title">
        <header><span>现实验证 · 只保存在本机</span><h2 id="validation-title">你现在能判断这条线索吗？</h2><p>{validating.title}</p></header>
        <div className={styles.statusChoices} role="group" aria-label="选择当前状态">
          {VALIDATION_STATUSES.map((status) => <button type="button" key={status} aria-pressed={validationStatus === status} onClick={() => setValidationStatus(status)}>{status === "pending" ? "先留作观察" : OBSERVATION_STATUS_META[status].label}</button>)}
        </div>

        {validationStatus === "pending" ? <div className={styles.pendingPlan} role="status"><b>很好，不急着判断。</b><span>选一个回来看看的时间；届时再记录符合、反例或仍不确定。</span></div> : validationStatus ? <div className={styles.validationFields}>
          <label><span>现实事件或反例（选填）</span><textarea value={validationNote} onChange={(event) => setValidationNote(event.target.value)} placeholder="写下发生了什么、当时情境，或为什么仍无法判断" /></label>
          <label><span>观察日期</span><input type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} /></label>
        </div> : <p className={styles.validationPrompt} aria-live="polite">先选择一个状态。没有足够经历时，“先留作观察”就是完整答案。</p>}

        {validationStatus && <div className={styles.reviewPlanner}>
          <span>什么时候回来复盘？</span>
          <div role="group" aria-label="选择复盘时间">
            <button type="button" onClick={() => setReviewOn(deviceDateAfter(7))}>7 天后</button>
            <button type="button" onClick={() => setReviewOn(deviceDateAfter(30))}>30 天后</button>
            <button type="button" onClick={() => setReviewOn("")}>暂不安排</button>
          </div>
          <label><span>自定义日期</span><input type="date" min={deviceToday()} value={reviewOn} onChange={(event) => setReviewOn(event.target.value)} /></label>
        </div>}
        <footer><p>符合、部分符合、不符合都同样保留；记录不会反向改写排盘结果。</p><button type="button" disabled={!validationStatus} onClick={saveValidation}>{validationStatus === "pending" ? "保存观察计划" : "保存验证与复盘"}</button></footer>
      </section>}

      {depth === "expert" && <section className={styles.expertEvidence}>
        <header><span>PROVENANCE</span><h2>完整证据链与使用边界</h2><p>这里说明结论从哪里来、何时成立，以及哪些变量尚未纳入。</p></header>
        <article><h3>首屏结论</h3><EvidenceLedger evidence={report.primaryEvidence} /></article>
        {report.themes.map((theme) => <article key={theme.id}><h3>{theme.label} · {theme.title}</h3><EvidenceLedger evidence={theme.evidence} /><p className={styles.boundary}><strong>使用边界</strong>{theme.boundary}</p></article>)}
      </section>}

      {depth !== "brief" && <div className={styles.questions}>
        <header>
          <div><span>继续问，但不让答案脱离盘面</span><h2>你可能真正想知道的事</h2></div>
          <p>只回答当前规则已经覆盖的问题；没有证据的部分，不在这里补写。</p>
        </header>
        <div className={styles.questionButtons} role="group" aria-label="选择一个问题">
          {report.questions.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-expanded={activeQuestion === item.id}
              aria-controls={`guided-answer-${item.id}`}
              className={activeQuestion === item.id ? styles.activeQuestion : undefined}
              onClick={() => chooseQuestion(item.id)}
            >
              <span>{item.question}</span><Icon name="arrow" size={14} />
            </button>
          ))}
        </div>
        {selected && <article id={`guided-answer-${selected.id}`} className={styles.questionAnswer} aria-live="polite">
          <span>直接回答</span>
          <h3>{selected.question}</h3>
          <p>{selected.answer}</p>
          {depth === "expert" && <EvidenceLedger evidence={selected.evidence} />}
          <aside><b>别这样误读</b>{selected.boundary}</aside>
        </article>}
      </div>}
    </section>
  );
}
