"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Icon";
import type { ExploreMode } from "@/components/types";
import type { GuidedReport, RuleEvidence } from "@/lib/guided-reading";
import type { ObservationDraft, ObservationRecord, ObservationStatus } from "@/lib/observations";
import { OBSERVATION_STATUS_META } from "@/lib/observations";
import { trackLocalEvent } from "@/lib/product";
import { METHOD_REFERENCES } from "@/lib/references";
import styles from "./GuidedReadingPanel.module.css";

const VALIDATION_STATUSES: Exclude<ObservationStatus, "pending">[] = ["matches", "partial", "differs", "uncertain"];
const SOURCE_NAMES = new Map(METHOD_REFERENCES.map((item) => [item.id, item.title]));

function localDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function today() {
  return localDateAfter(0);
}

function EvidenceLedger({ evidence, compact = false }: { evidence: RuleEvidence; compact?: boolean }) {
  return <div className={`${styles.ledger} ${compact ? styles.compactLedger : ""}`}>
    <div className={styles.ledgerMeta}>
      <span><small>所属体系</small>{evidence.systems.join(" · ")}</span>
      <span><small>规则版本</small>{evidence.ruleVersion}</span>
      <span data-strength={evidence.strength.level}><small>证据强度</small>{evidence.strength.label}</span>
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

export function GuidedReadingPanel({ report, records, profileId, onExplore, onValidate, onOpenObservations }: {
  report: GuidedReport;
  records: ObservationRecord[];
  profileId: string;
  onExplore: (mode: ExploreMode) => void;
  onValidate: (draft: ObservationDraft) => void;
  onOpenObservations: () => void;
}) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [activeValidation, setActiveValidation] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<Exclude<ObservationStatus, "pending">>("uncertain");
  const [validationNote, setValidationNote] = useState("");
  const [observedOn, setObservedOn] = useState(today());
  const [reviewOn, setReviewOn] = useState(localDateAfter(30));
  const selected = report.questions.find((item) => item.id === activeQuestion) ?? null;
  const validating = report.themes.find((item) => item.id === activeValidation) ?? null;

  function chooseQuestion(id: string) {
    setActiveQuestion((current) => current === id ? null : id);
    trackLocalEvent("guided_question_opened", { intent: report.intent, question: id });
  }

  function startValidation(id: string) {
    setActiveValidation((current) => current === id ? null : id);
    setValidationStatus("uncertain");
    setValidationNote("");
    setObservedOn(today());
    setReviewOn(localDateAfter(30));
  }

  function saveValidation() {
    if (!validating) return;
    onValidate({
      source: report.intent === "timing" ? "time" : report.intent === "relationship" ? "relationship" : "insight",
      sourceId: `guided-${report.intent}-${validating.id}`,
      title: validating.title,
      question: `“${validating.detail}”与你的现实经历是否相符？`,
      status: validationStatus,
      note: validationNote.trim(),
      observedOn,
      reviewOn: reviewOn || undefined,
    });
    setActiveValidation(null);
  }

  return (
    <section className={styles.shell} aria-labelledby="guided-reading-title">
      <div className={styles.answerBand}>
        <div className={styles.answerCopy}>
          <span>{report.eyebrow}</span>
          <h1 id="guided-reading-title">{report.title}</h1>
          <p>{report.summary}</p>
        </div>
        <aside className={styles.actionNote}>
          <small>现在可以做什么</small>
          <p>{report.recommendation}</p>
          <button onClick={() => onExplore(report.nextMode)}>{report.nextLabel}<Icon name="arrow" size={15} /></button>
        </aside>
      </div>
      <details className={styles.primaryEvidence}>
        <summary>查看首屏结论的完整证据链</summary>
        <EvidenceLedger evidence={report.primaryEvidence} />
      </details>

      <div className={styles.themeGrid}>
        {report.themes.map((theme, index) => (
          <article className={styles.theme} key={theme.id}>
            <header><span>0{index + 1}</span><small>{theme.label}</small><em>{theme.confidence}</em></header>
            <h2>{theme.title}</h2>
            <p>{theme.detail}</p>
            <ul>{theme.manifestations.map((item) => <li key={item}>{item}</li>)}</ul>
            <details>
              <summary>为什么这样说</summary>
              <EvidenceLedger evidence={theme.evidence} />
              <p className={styles.boundary}><strong>使用边界</strong>{theme.boundary}</p>
            </details>
            {records.some((record) => record.profileId === profileId && record.sourceId === `guided-${report.intent}-${theme.id}`)
              ? <button className={styles.savedValidation} onClick={onOpenObservations}>已保存验证 · 去复盘</button>
              : <button className={styles.validateButton} onClick={() => startValidation(theme.id)}>{activeValidation === theme.id ? "收起验证" : "验证这条结论"}</button>}
          </article>
        ))}
      </div>

      {validating && <section className={styles.validationPanel} aria-labelledby="validation-title">
        <header><span>现实验证 · 只保存在本机</span><h2 id="validation-title">这条结论与你的经历相符吗？</h2><p>{validating.title}</p></header>
        <div className={styles.statusChoices} role="group" aria-label="选择符合程度">
          {VALIDATION_STATUSES.map((status) => <button key={status} aria-pressed={validationStatus === status} onClick={() => setValidationStatus(status)}>{OBSERVATION_STATUS_META[status].label}</button>)}
        </div>
        <div className={styles.validationFields}>
          <label><span>现实事件或反例</span><textarea value={validationNote} onChange={(event) => setValidationNote(event.target.value)} placeholder="写下发生了什么、当时情境，或为什么暂时无法判断" /></label>
          <div><label><span>观察日期</span><input type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} /></label><label><span>指定复盘日期</span><input type="date" min={today()} value={reviewOn} onChange={(event) => setReviewOn(event.target.value)} /></label></div>
        </div>
        <footer><p>符合、部分符合、不符合都同样保留；记录不会反向改写排盘结果。</p><button onClick={saveValidation}>保存验证与复盘计划</button></footer>
      </section>}

      <div className={styles.questions}>
        <header>
          <div><span>继续问，但不让答案脱离盘面</span><h2>你可能真正想知道的事</h2></div>
          <p>以下问题只调用已经计算出的规则；没有证据覆盖的事，不在这里作答。</p>
        </header>
        <div className={styles.questionButtons} role="group" aria-label="选择一个问题">
          {report.questions.map((item) => (
            <button
              key={item.id}
              aria-pressed={activeQuestion === item.id}
              className={activeQuestion === item.id ? styles.activeQuestion : undefined}
              onClick={() => chooseQuestion(item.id)}
            >
              <span>{item.question}</span><Icon name="arrow" size={14} />
            </button>
          ))}
        </div>
        {selected && <article className={styles.questionAnswer} aria-live="polite">
          <span>直接回答</span>
          <h3>{selected.question}</h3>
          <p>{selected.answer}</p>
          <EvidenceLedger evidence={selected.evidence} />
          <aside><b>别这样误读</b>{selected.boundary}</aside>
        </article>}
      </div>
    </section>
  );
}
