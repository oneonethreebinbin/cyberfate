"use client";

import dynamic from "next/dynamic";
import { buildChartReading, type ChartInsight } from "@/lib/insights";
import type { FateChart } from "@/lib/types";
import type { ObservationRecord, ObservationSource } from "@/lib/observations";
import { Icon } from "@/components/shared/Icon";
import { EvidenceCard, TimeUncertaintyNotice } from "@/components/shared/reading-parts";
import { handleTabArrow, type ExploreMode, type Tab, type ViewMode } from "@/components/types";

const FeatureLoading = () => <section className="feature-loading" role="status">正在准备这一部分…</section>;
const FortuneView = dynamic(() => import("@/components/FortuneView").then((mod) => mod.FortuneView), { loading: FeatureLoading });
const RelationshipView = dynamic(() => import("@/components/RelationshipView").then((mod) => mod.RelationshipView), { loading: FeatureLoading });

export function ExplorationView({ chart, mode, records, onModeChange, onSaveInsight, onSaveObservation, onNavigate }: {
  chart: FateChart;
  mode: ExploreMode;
  records: ObservationRecord[];
  onModeChange: (mode: ExploreMode) => void;
  onSaveInsight: (insight: ChartInsight) => void;
  onSaveObservation: (source: ObservationSource, sourceId: string, title: string, question: string, observedOn?: string) => void;
  onNavigate: (tab: Tab, mode?: ViewMode) => void;
}) {
  const reading = buildChartReading(chart);
  return <div className="exploration-view">
    <section className="explore-header"><div><span className="eyebrow">按问题探索</span><h1>你现在想看什么</h1><p>方法藏在证据层，先从现实任务进入。</p></div><div className="explore-switcher" role="tablist" aria-label="探索主题">
      <button id="explore-tab-self" aria-controls="explore-panel" tabIndex={mode === "self" ? 0 : -1} role="tab" aria-selected={mode === "self"} className={mode === "self" ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, ["self", "timing", "relationship"] as const, mode, onModeChange, "explore-tab-")} onClick={() => onModeChange("self")}><b>自己</b><small>完整观察</small></button>
      <button id="explore-tab-timing" aria-controls="explore-panel" tabIndex={mode === "timing" ? 0 : -1} role="tab" aria-selected={mode === "timing"} className={mode === "timing" ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, ["self", "timing", "relationship"] as const, mode, onModeChange, "explore-tab-")} onClick={() => onModeChange("timing")}><b>时间</b><small>阶段与流年</small></button>
      <button id="explore-tab-relationship" aria-controls="explore-panel" tabIndex={mode === "relationship" ? 0 : -1} role="tab" aria-selected={mode === "relationship"} className={mode === "relationship" ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, ["self", "timing", "relationship"] as const, mode, onModeChange, "explore-tab-")} onClick={() => onModeChange("relationship")}><b>关系</b><small>一己与二人</small></button>
    </div></section>
    <div id="explore-panel" role="tabpanel" aria-labelledby={`explore-tab-${mode}`}>
    {chart.profile.timeKnown === false && <TimeUncertaintyNotice onAddTime={() => onNavigate("overview")} />}
    {mode === "self" && <div className="view-stack explore-self"><section className="orientation-panel"><div className="orientation-copy"><span className="eyebrow">完整观察</span><h2>{chart.profile.timeKnown === false ? "时辰未定，完整观察暂不展开" : reading.headline}</h2><p>{chart.profile.timeKnown === false ? "补充准确出生时间后，才会展开旺衰、紫微与完整盘面关系。" : "按自己的节奏展开证据，并把真正有用的问题留到观测簿。"}</p></div>{chart.profile.timeKnown !== false && <button className="evidence-link" onClick={() => onNavigate("expert", "bazi")}>查看专业盘依据 <Icon name="arrow" /></button>}</section>{chart.profile.timeKnown !== false && <div className="evidence-grid">{[...reading.insights].sort((a,b) => Number(a.index) - Number(b.index)).map((insight) => <EvidenceCard key={insight.id} insight={insight} onNavigate={onNavigate} onSave={onSaveInsight} saved={records.some((record) => record.profileId === chart.profile.id && record.sourceId === insight.id)} />)}</div>}</div>}
    {mode === "timing" && (chart.profile.timeKnown === false ? <section className="limited-feature"><span>需要准确时辰</span><h2>时间推演暂未展开</h2><p>时辰会影响时柱、旺衰、大运起运和紫微盘面。这里不使用临时午时结果替代你的真实盘面。</p></section> : <FortuneView chart={chart} savedSourceIds={records.filter((record) => record.profileId === chart.profile.id).map((record) => record.sourceId)} onSaveObservation={(sourceId, title, question, observedOn) => onSaveObservation("time", sourceId, title, question, observedOn)} />)}
    {mode === "relationship" && (chart.profile.timeKnown === false ? <section className="limited-feature"><span>先看有限部分</span><h2>关系专题需要补充时辰</h2><p>日支可以确定，但配偶星强弱、紫微夫妻宫与时间窗口依赖完整时辰。为避免混合可靠与不可靠信号，暂不生成专题报告。</p></section> : <RelationshipView chart={chart} savedSourceIds={records.filter((record) => record.profileId === chart.profile.id).map((record) => record.sourceId)} onSaveObservation={(sourceId, title, question) => onSaveObservation("relationship", sourceId, title, question)} />)}
    </div>
  </div>;
}
