"use client";

import { useEffect, useMemo, useState } from "react";
import { createFateChart } from "@/lib/engines";
import { analyzeCompatibility, analyzeSingleRelationship, type CompatibilityReport } from "@/lib/relationship";
import type { BirthProfile, FateChart, Gender } from "@/lib/types";
import { DateTimeField } from "@/components/DateTimeField";
import { TerminologyPanel } from "@/components/TerminologyPanel";
import { CITY_OPTIONS } from "@/lib/locations";

type RelationshipMode = "single" | "compatibility";

function handleModeKey(event: React.KeyboardEvent<HTMLButtonElement>, current: RelationshipMode, select: (mode: RelationshipMode) => void) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const modes: RelationshipMode[] = ["single", "compatibility"];
  const next = event.key === "Home" ? modes[0] : event.key === "End" ? modes[1] : modes[(modes.indexOf(current) + (event.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length];
  select(next);
  window.requestAnimationFrame(() => document.getElementById(`relationship-tab-${next}`)?.focus());
}

const TONE_LABELS = {
  jade: "结构支持",
  gold: "重点观察",
  vermilion: "显著信号",
  neutral: "基础线索",
};

type TimelineNoteStatus = "有对应经历" | "暂无对应经历" | "仍不确定";
type TimelineNote = { status?: TimelineNoteStatus; text?: string };

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function RelationshipTimeline({ chart, timeline }: { chart: FateChart; timeline: ReturnType<typeof analyzeSingleRelationship>["timeline"] }) {
  const storageKey = `cyberfate-relationship-notes:${chart.profile.id}`;
  const [notes, setNotes] = useState<Record<number, TimelineNote>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setNotes(stored ? JSON.parse(stored) as Record<number, TimelineNote> : {});
    } catch {
      setNotes({});
    }
  }, [storageKey]);

  function updateNote(year: number, change: Partial<TimelineNote>) {
    setNotes((current) => {
      const next = { ...current, [year]: { ...current[year], ...change } };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 本地存储不可用时仍保留当前会话状态 */ }
      return next;
    });
  }

  function clearNote(year: number) {
    setNotes((current) => {
      const next = { ...current };
      delete next[year];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 本地存储不可用时仍清除当前会话状态 */ }
      return next;
    });
  }

  return (
    <div className="relationship-timeline">
      {timeline.map((item) => {
        const note = notes[item.year] ?? {};
        return (
          <article className={item.level} key={item.year}>
            <div className="year-summary">
              <div className="year-mark"><span>{item.year}</span><b>{item.ganZhi}</b></div>
              <i />
              <div className="year-copy"><strong>{item.level}</strong><p>{item.reasons.join("；")}</p></div>
            </div>
            <details className="year-reflection">
              <summary><span>记录现实情况</span><small>{note.status ?? "未记录"}</small><i aria-hidden="true" /></summary>
              <div className="year-note-body">
                <div className="note-status" role="group" aria-label={`${item.year} 年现实情况`}>
                  {(["有对应经历", "暂无对应经历", "仍不确定"] as TimelineNoteStatus[]).map((status) => (
                    <button type="button" aria-pressed={note.status === status} className={note.status === status ? "active" : ""} onClick={() => updateNote(item.year, { status })} key={status}>{status}</button>
                  ))}
                </div>
                <label><span>补充记录（选填）</span><textarea value={note.text ?? ""} onChange={(event) => updateNote(item.year, { text: event.target.value })} placeholder="记录当年的关系、社交或生活变化" /></label>
                <footer><p>仅保存在当前浏览器，用于自我复盘，不用于证明规则正确。</p>{(note.status || note.text) && <button type="button" onClick={() => clearNote(item.year)}>清除本年记录</button>}</footer>
              </div>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function CompassGlyph({ branch }: { branch: string }) {
  return (
    <div className="relation-compass" aria-hidden="true">
      <i className="ring-one" /><i className="ring-two" />
      {"子丑寅卯辰巳午未申酉戌亥".split("").map((item, index) => <span key={item} style={{ "--n": index } as React.CSSProperties}>{item}</span>)}
      <div><small>夫妻宫</small><strong>{branch}</strong><em>日支</em></div>
    </div>
  );
}

function SingleReport({ chart, savedSourceIds, onSaveObservation }: {
  chart: FateChart;
  savedSourceIds: string[];
  onSaveObservation?: (sourceId: string, title: string, question: string) => void;
}) {
  const report = useMemo(() => analyzeSingleRelationship(chart), [chart]);
  const major = report.couplePalace.stars.filter((star) => star.type === "major").map((star) => star.name);

  return (
    <div className="relationship-stack">
      <section className="relationship-hero">
        <div className="relationship-copy">
          <span className="eyebrow">命盘关系结构</span>
          <h2>你的关系线索</h2>
          <p>自日支起手，参看配偶星、咸池位与紫微夫妻宫；此处只陈盘面之据，缘起缘续，还须二人自己经营。</p>
          <div className="relation-coordinates">
            <span><small>八字夫妻宫</small><b>{report.spousePalace}</b></span>
            <span><small>配偶星五行</small><b>{report.spouseElement}</b></span>
            <span><small>桃花触发</small><b>{report.peachBranch}</b></span>
            <span><small>紫微夫妻宫</small><b>{report.couplePalace.ganZhi}</b></span>
          </div>
        </div>
        <CompassGlyph branch={report.spousePalace} />
      </section>

      <section className="relationship-section">
        <header className="relationship-heading"><div><span>一 · 盘面依据</span><h2>姻缘结构</h2></div><p>条条有据，出处可查</p></header>
        <div className="signal-grid">
          {report.signals.map((signal, index) => (
            <article className={`signal-card ${signal.tone}`} key={signal.title}>
              <header><span>{String(index + 1).padStart(2, "0")}</span><em>{TONE_LABELS[signal.tone]}</em></header>
              <h3>{signal.title}</h3><strong>{signal.value}</strong><p>{signal.detail}</p>
              <details className="signal-evidence">
                <summary><span>查看依据与现实核对</span><i aria-hidden="true" /></summary>
                <div>
                  <p><b>盘面依据</b>{signal.evidence}</p>
                  <p><b>另一种理解</b>{signal.alternative}</p>
                  <p><b>当前未纳入</b>{signal.limits}</p>
                  <p className="signal-question"><b>可以问自己</b>{signal.reflection}</p>
                </div>
              </details>
              {onSaveObservation && <button className={savedSourceIds.includes(`relationship-${index}`) ? "signal-save saved" : "signal-save"} disabled={savedSourceIds.includes(`relationship-${index}`)} onClick={() => onSaveObservation(`relationship-${index}`, signal.title, signal.reflection)}>{savedSourceIds.includes(`relationship-${index}`) ? "已加入观测簿" : "留下这个关系问题"}</button>}
            </article>
          ))}
        </div>
      </section>

      <section className="relationship-section">
        <header className="relationship-heading"><div><span>二 · 流年触发</span><h2>未来五年关系窗口</h2></div><p>活跃不必然成婚，转折亦不必然离散</p></header>
        <p className="timeline-intro-note">标签只是起手之势。逐年展开，记下真实际遇，久之自成一部缘分账。</p>
        <RelationshipTimeline chart={chart} timeline={report.timeline} />
      </section>

      <section className="couple-palace-band">
        <div><span>紫微 · 夫妻宫</span><h2>{report.couplePalace.ganZhi} · 夫妻宫</h2></div>
        <div className="palace-starline">{major.length ? major.map((star) => <b key={star}>{star}</b>) : <b>{report.coupleOpposite?.name ?? "对宫"}借{report.coupleBorrowed.join("、") || "星"}</b>}</div>
        <div className="couple-network">
          <p><small>三方四正会照</small>{report.coupleTrineMajors.length ? report.coupleTrineMajors.join("、") : "三方未见主星"}{report.coupleOpposite ? ` · 对宫${report.coupleOpposite.name}` : ""}</p>
          <p><small>夫妻宫飞四化</small>{report.coupleFlies.stem}干：{report.coupleFlies.flies.map((fly) => `${fly.star}化${fly.mutagen}入${fly.toPalace ?? "盘内不见"}`).join("、")}</p>
          <p>紫微之学，不执一宫而断：空宫借对宫，会照与飞化俱列于上；余下宫位，待后续深报同参。</p>
        </div>
      </section>
    </div>
  );
}

function CompatibilityResult({ report, aName, bName, approximate }: { report: CompatibilityReport; aName: string; bName: string; approximate: boolean }) {
  const [copied, setCopied] = useState(false);
  const dimensions = approximate ? report.dimensions.slice(0, 3) : report.dimensions;

  async function copySummary() {
    const text = [
      "CYBERFATE · 脱敏关系摘要",
      `${aName || "A"} × ${bName || "B"}：${report.relationLabel}`,
      report.headline,
      ...dimensions.map((dimension) => `${dimension.name}｜${dimension.status}：${dimension.detail}`),
      approximate ? "对方时辰未知：仅保留日柱层面的有限比较。" : "",
      "传统规则推演，仅供共同讨论，不作为关系决策依据。",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="compatibility-result">
      <section className="compatibility-hero">
        <span className="eyebrow">双人关系合盘</span>
        <div className="name-pair"><h2>{aName || "A"}</h2><i><small>关系结构</small><b>{report.relationLabel}</b></i><h2>{bName || "B"}</h2></div>
        <p>{report.headline}</p>
        {approximate && <div className="compatibility-limited"><b>有限比较</b><span>对方时辰未知，仅保留双方日柱的吸引、沟通和冲突结构；紫微、配偶星强弱与时间协调不展示。</span></div>}
        <button className="share-summary-button" onClick={copySummary}>{copied ? "摘要已复制" : "复制脱敏摘要"}</button>
      </section>
      <section className="dimension-list">
        {dimensions.map((dimension, index) => (
          <article key={dimension.name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{dimension.name}</h3><small>{dimension.evidence}</small></div>
            <b className={`status-${dimension.status}`}>{dimension.status}</b>
            <p>{dimension.detail}</p>
            <details className="dimension-check">
              <summary><span>现实核对</span><i aria-hidden="true" /></summary>
              <div><p><b>可以一起讨论</b>{dimension.question}</p><p><b>当前局限</b>{dimension.limits}</p></div>
            </details>
          </article>
        ))}
      </section>
      <div className="compatibility-note"><b>缘分不打分</b><p>关系不作考试之比。协同、互补与须经营之处分列而陈，免得一个分数掩了真章。</p></div>
    </div>
  );
}

function CompatibilityView({ chart }: { chart: FateChart }) {
  const [partner, setPartner] = useState<BirthProfile>({
    id: "partner",
    name: "",
    date: "",
    time: "",
    timeKnown: true,
    gender: "男",
    longitude: 116.4,
    useTrueSolarTime: true,
    createdAt: new Date().toISOString(),
  });
  const [partnerCity, setPartnerCity] = useState("");
  const [partnerGenderSelected, setPartnerGenderSelected] = useState(false);
  const [result, setResult] = useState<CompatibilityReport | null>(null);
  const [error, setError] = useState("");
  const partnerReady = /^\d{4}-\d{2}-\d{2}$/.test(partner.date) && (partner.timeKnown === false || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(partner.time)) && partnerGenderSelected && Boolean(partnerCity);

  function update<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setPartner((current) => ({ ...current, [key]: value }));
  }

  function calculate() {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(partner.date) || (partner.timeKnown !== false && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(partner.time))) {
        throw new Error(partner.timeKnown === false ? "请填写对方出生日期" : "请填写对方完整的出生日期和时间");
      }
      if (partner.date < "1900-01-01" || partner.date > today()) throw new Error("对方出生日期需在 1900 年至今天之间");
      if (!partnerGenderSelected) throw new Error("请选择对方的传统排盘口径");
      if (!partnerCity) throw new Error("请选择对方出生城市；当前仅支持中国标准时间（UTC+8）");
      if (!Number.isFinite(partner.longitude) || partner.longitude < 73 || partner.longitude > 135) {
        throw new Error("对方出生地经度请输入 73°–135° 之间的数值");
      }
      const partnerChart = createFateChart({ ...partner, time: partner.timeKnown === false ? "12:00" : partner.time, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      setResult(analyzeCompatibility(chart, partnerChart));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "合盘失败，请检查出生资料");
    }
  }

  return (
    <div className="compatibility-layout">
      <section className="partner-form-panel">
        <header><span>第二人资料</span><h2>对方生辰</h2><p>资料只在当前浏览器中计算，不会上传。</p></header>
        <div className="partner-form">
          <label><span>称呼</span><input value={partner.name} onChange={(event) => update("name", event.target.value)} placeholder="选填" /></label>
          <div className="partner-pair"><DateTimeField label="公历日期" type="date" value={partner.date} max={today()} onChange={(value) => update("date", value)} />{partner.timeKnown !== false ? <DateTimeField label="出生时间" type="time" value={partner.time} onChange={(value) => update("time", value)} /> : <div className="partner-unknown-time"><span>出生时间</span><b>暂不知道</b><small>只比较日柱层面</small></div>}</div>
          <fieldset className="partner-time-certainty"><legend>对方时辰</legend><div className="partner-gender"><button type="button" aria-pressed={partner.timeKnown !== false} className={partner.timeKnown !== false ? "active" : ""} onClick={() => { update("timeKnown", true); update("time", ""); }}>知道</button><button type="button" aria-pressed={partner.timeKnown === false} className={partner.timeKnown === false ? "active" : ""} onClick={() => { update("timeKnown", false); update("time", "12:00"); }}>不知道</button></div></fieldset>
          <fieldset><legend>传统排盘口径</legend><div className="partner-gender">{(["男", "女"] as Gender[]).map((gender) => <button type="button" aria-pressed={partnerGenderSelected && partner.gender === gender} className={partnerGenderSelected && partner.gender === gender ? "active" : ""} key={gender} onClick={() => { update("gender", gender); setPartnerGenderSelected(true); }}>{gender}命</button>)}</div></fieldset>
          <label><span>出生城市</span><select value={partnerCity} onChange={(event) => { const id = event.target.value; setPartnerCity(id); const city = CITY_OPTIONS.find((item) => item.id === id); if (city) update("longitude", city.longitude); }}><option value="" disabled>请选择城市</option>{CITY_OPTIONS.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}<option value="custom">其他 / 手动经度</option></select></label>
          <p className="partner-timezone-note">当前仅支持按中国标准时间（UTC+8）记录的出生时间。</p>
          {partnerCity === "custom" && <label><span>出生地经度（东经）</span><input type="number" min="73" max="135" step="0.1" value={partner.longitude} onChange={(event) => update("longitude", Number(event.target.value))} /></label>}
          <label className="partner-toggle"><input type="checkbox" checked={partner.useTrueSolarTime} onChange={(event) => update("useTrueSolarTime", event.target.checked)} /><span>使用真太阳时校正</span></label>
          {error && <p className="partner-error" role="alert">{error}</p>}
          <button className="compatibility-button" disabled={!partnerReady} onClick={calculate}><span>生成双人合盘</span><small>{partnerReady ? "比较两张命盘" : "请先完成必填资料"}</small></button>
        </div>
      </section>
      <div className="compatibility-stage">
        {result ? <CompatibilityResult report={result} aName={chart.profile.name} bName={partner.name} approximate={partner.timeKnown === false} /> : <div className="compatibility-empty"><div className="empty-rings"><i /><i /><b>合</b></div><span>双人合盘</span><h2>两盘对坐，共观一缘</h2><p>较双方之日柱、夫妻宫、五行与五年共同触发之窗；不知道对方时辰也可先做有限比较。</p></div>}
      </div>
    </div>
  );
}

export function RelationshipView({ chart, savedSourceIds = [], onSaveObservation }: {
  chart: FateChart;
  savedSourceIds?: string[];
  onSaveObservation?: (sourceId: string, title: string, question: string) => void;
}) {
  const [mode, setMode] = useState<RelationshipMode>("single");
  return (
    <div className="view-stack relationship-view">
      <section className="page-intro relationship-intro">
        <div><span className="eyebrow">关系专题</span><h1>姻缘观测</h1><p>从夫妻宫、配偶星与流年触发处，看一段缘分的气数脉络。</p></div>
        <div className="relationship-mode" role="tablist" aria-label="姻缘分析方式">
          <button id="relationship-tab-single" aria-controls="relationship-panel" tabIndex={mode === "single" ? 0 : -1} role="tab" aria-selected={mode === "single"} className={mode === "single" ? "active" : ""} onKeyDown={(event) => handleModeKey(event, mode, setMode)} onClick={() => setMode("single")}><b>单人姻缘</b><small>关系模式与时间</small></button>
          <button id="relationship-tab-compatibility" aria-controls="relationship-panel" tabIndex={mode === "compatibility" ? 0 : -1} role="tab" aria-selected={mode === "compatibility"} className={mode === "compatibility" ? "active" : ""} onKeyDown={(event) => handleModeKey(event, mode, setMode)} onClick={() => setMode("compatibility")}><b>双人合盘</b><small>互动结构与差异</small></button>
        </div>
      </section>
      <div id="relationship-panel" role="tabpanel" aria-labelledby={`relationship-tab-${mode}`}>{mode === "single" ? <SingleReport chart={chart} savedSourceIds={savedSourceIds} onSaveObservation={onSaveObservation} /> : <CompatibilityView chart={chart} />}</div>
      <TerminologyPanel scope="relationship" />
      <p className="source-note relationship-disclaimer">古法无科验之据，此页只助自省与共谈；相处之道在两人，不在此盘。</p>
    </div>
  );
}
