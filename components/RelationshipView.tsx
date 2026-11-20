"use client";

import { useMemo, useState } from "react";
import { createFateChart } from "@/lib/engines";
import { analyzeCompatibility, analyzeSingleRelationship, type CompatibilityReport } from "@/lib/relationship";
import type { BirthProfile, FateChart, Gender } from "@/lib/types";
import { DateTimeField } from "@/components/DateTimeField";

type RelationshipMode = "single" | "compatibility";

const TONE_LABELS = {
  jade: "结构支持",
  gold: "重点观察",
  vermilion: "显著信号",
  neutral: "基础线索",
};

function CompassGlyph({ branch }: { branch: string }) {
  return (
    <div className="relation-compass" aria-hidden="true">
      <i className="ring-one" /><i className="ring-two" />
      {"子丑寅卯辰巳午未申酉戌亥".split("").map((item, index) => <span key={item} style={{ "--n": index } as React.CSSProperties}>{item}</span>)}
      <div><small>夫妻宫</small><strong>{branch}</strong><em>日支</em></div>
    </div>
  );
}

function SingleReport({ chart }: { chart: FateChart }) {
  const report = useMemo(() => analyzeSingleRelationship(chart), [chart]);
  const major = report.couplePalace.stars.filter((star) => star.type === "major").map((star) => star.name);

  return (
    <div className="relationship-stack">
      <section className="relationship-hero">
        <div className="relationship-copy">
          <span className="eyebrow">命盘关系结构</span>
          <h2>你的关系线索</h2>
          <p>从八字日支出发，参看配偶星、桃花位和紫微夫妻宫。这里只列盘面依据，不替你判断一段关系。</p>
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
        <header className="relationship-heading"><div><span>一 · 盘面依据</span><h2>姻缘结构</h2></div><p>每条判断均保留计算依据</p></header>
        <div className="signal-grid">
          {report.signals.map((signal, index) => (
            <article className={`signal-card ${signal.tone}`} key={signal.title}>
              <header><span>{String(index + 1).padStart(2, "0")}</span><em>{TONE_LABELS[signal.tone]}</em></header>
              <h3>{signal.title}</h3><strong>{signal.value}</strong><p>{signal.detail}</p>
              <footer>{signal.evidence}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="relationship-section">
        <header className="relationship-heading"><div><span>二 · 流年触发</span><h2>未来五年关系窗口</h2></div><p>活跃不等于必然结婚，转折也不等于分离</p></header>
        <div className="relationship-timeline">
          {report.timeline.map((item) => (
            <article className={item.level} key={item.year}>
              <div className="year-mark"><span>{item.year}</span><b>{item.ganZhi}</b></div>
              <i />
              <div className="year-copy"><strong>{item.level}</strong><p>{item.reasons.join("；")}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="couple-palace-band">
        <div><span>紫微 · 夫妻宫</span><h2>{report.couplePalace.ganZhi} · 夫妻宫</h2></div>
        <div className="palace-starline">{major.length ? major.map((star) => <b key={star}>{star}</b>) : <b>空宫 · 借对宫观察</b>}</div>
        <p>紫微部分不单宫断事。后续深度报告将同时展开命宫、福德宫、官禄宫与夫妻宫三方四正。</p>
      </section>
    </div>
  );
}

function CompatibilityResult({ report, aName, bName }: { report: CompatibilityReport; aName: string; bName: string }) {
  return (
    <div className="compatibility-result">
      <section className="compatibility-hero">
        <span className="eyebrow">双人关系合盘</span>
        <div className="name-pair"><h2>{aName || "A"}</h2><i><small>关系结构</small><b>{report.relationLabel}</b></i><h2>{bName || "B"}</h2></div>
        <p>{report.headline}</p>
      </section>
      <section className="dimension-list">
        {report.dimensions.map((dimension, index) => (
          <article key={dimension.name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{dimension.name}</h3><small>{dimension.evidence}</small></div>
            <b className={`status-${dimension.status}`}>{dimension.status}</b>
            <p>{dimension.detail}</p>
          </article>
        ))}
      </section>
      <div className="compatibility-note"><b>不设置总匹配分</b><p>关系不是一场考试。这里分别呈现协同、互补与需要经营的维度，避免用单一分数掩盖真实差异。</p></div>
    </div>
  );
}

function CompatibilityView({ chart }: { chart: FateChart }) {
  const [partner, setPartner] = useState<BirthProfile>({
    id: "partner",
    name: "",
    date: "1992-08-16",
    time: "12:00",
    gender: chart.profile.gender === "男" ? "女" : "男",
    longitude: 116.4,
    useTrueSolarTime: true,
    createdAt: new Date().toISOString(),
  });
  const [result, setResult] = useState<CompatibilityReport | null>(null);
  const [error, setError] = useState("");

  function update<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setPartner((current) => ({ ...current, [key]: value }));
  }

  function calculate() {
    try {
      const partnerChart = createFateChart({ ...partner, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      setResult(analyzeCompatibility(chart, partnerChart));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "合盘失败，请检查出生资料");
    }
  }

  return (
    <div className="compatibility-layout">
      <section className="partner-form-panel">
        <header><span>第二人资料</span><h2>输入对方资料</h2><p>资料只在当前浏览器中计算，不会上传。</p></header>
        <div className="partner-form">
          <label><span>称呼</span><input value={partner.name} onChange={(event) => update("name", event.target.value)} placeholder="选填" /></label>
          <div className="partner-pair"><DateTimeField label="公历日期" type="date" value={partner.date} onChange={(value) => update("date", value)} /><DateTimeField label="出生时间" type="time" value={partner.time} onChange={(value) => update("time", value)} /></div>
          <fieldset><legend>性别</legend><div className="partner-gender">{(["男", "女"] as Gender[]).map((gender) => <button type="button" className={partner.gender === gender ? "active" : ""} key={gender} onClick={() => update("gender", gender)}>{gender}命</button>)}</div></fieldset>
          <label><span>出生地经度（东经）</span><input type="number" min="73" max="135" step="0.1" value={partner.longitude} onChange={(event) => update("longitude", Number(event.target.value))} /></label>
          <label className="partner-toggle"><input type="checkbox" checked={partner.useTrueSolarTime} onChange={(event) => update("useTrueSolarTime", event.target.checked)} /><span>使用真太阳时校正</span></label>
          {error && <p className="partner-error">{error}</p>}
          <button className="compatibility-button" onClick={calculate}><span>生成双人合盘</span><small>比较两张命盘</small></button>
        </div>
      </section>
      <div className="compatibility-stage">
        {result ? <CompatibilityResult report={result} aName={chart.profile.name} bName={partner.name} /> : <div className="compatibility-empty"><div className="empty-rings"><i /><i /><b>合</b></div><span>双人合盘</span><h2>两张命盘，一组关系结构</h2><p>比较双方日柱、夫妻宫、五行关系和未来五年的共同触发窗口。这里不上传资料，也不下“天生一对”之类的结论。</p></div>}
      </div>
    </div>
  );
}

export function RelationshipView({ chart }: { chart: FateChart }) {
  const [mode, setMode] = useState<RelationshipMode>("single");
  return (
    <div className="view-stack relationship-view">
      <section className="page-intro relationship-intro">
        <div><span className="eyebrow">关系专题</span><h1>姻缘观测</h1><p>从夫妻宫、配偶星和流年看关系线索。</p></div>
        <div className="relationship-mode" role="tablist" aria-label="姻缘分析方式">
          <button role="tab" aria-selected={mode === "single"} className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}><b>单人姻缘</b><small>关系模式与时间</small></button>
          <button role="tab" aria-selected={mode === "compatibility"} className={mode === "compatibility" ? "active" : ""} onClick={() => setMode("compatibility")}><b>双人合盘</b><small>互动结构与差异</small></button>
        </div>
      </section>
      {mode === "single" ? <SingleReport chart={chart} /> : <CompatibilityView chart={chart} />}
      <p className="source-note relationship-disclaimer">传统命理缺少现代科学验证。本页用于文化研究与关系自我观察，不应代替双方沟通或重要人生决定。</p>
    </div>
  );
}
