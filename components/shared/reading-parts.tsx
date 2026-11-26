"use client";

import { useEffect, useRef, useState } from "react";
import { buildChartReading, type ChartInsight, type ChartReading } from "@/lib/insights";
import type { FateChart } from "@/lib/types";
import { GLOSSARY, type GlossaryScope } from "@/lib/glossary";
import { questionForInsight } from "@/lib/observations";
import { Icon } from "@/components/shared/Icon";
import type { ExpertMode, Tab, ViewMode } from "@/components/types";

export function ScoreStrip({ scores }: { scores: { support: number; pressure: number; movement: number; depletion: number } }) {
  return (
    <div className="fortune-score-strip" aria-label="规则信号计数">
      <span><small>助势</small><b>{scores.support}</b></span>
      <span><small>制约</small><b>{scores.pressure}</b></span>
      <span><small>动象</small><b>{scores.movement}</b></span>
      <span><small>耗势</small><b>{scores.depletion}</b></span>
    </div>
  );
}

export function TermHint({ scope, term, open, onToggle }: { scope: GlossaryScope; term: string; open: boolean; onToggle: () => void }) {
  const entry = GLOSSARY[scope].find((item) => item.term === term);
  if (!entry) return null;
  const popoverId = `term-hint-${scope}-${GLOSSARY[scope].indexOf(entry)}`;
  return (
    <div className={`term-hint ${open ? "open" : ""}`}>
      <button type="button" className="term-hint-trigger" aria-expanded={open} aria-controls={popoverId} onClick={onToggle}><b>{entry.term}</b><span>{entry.short}</span><i aria-hidden="true" /></button>
      {open && <div className="term-hint-popover" id={popoverId} role="region" aria-label={`${entry.term}释义`}><p>{entry.detail}</p><small><b>使用边界</b>{entry.caution}</small></div>}
    </div>
  );
}

export function QuickReading({ reading }: { reading: ChartReading }) {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const termRailRef = useRef<HTMLDivElement>(null);
  const terms: Array<{ scope: GlossaryScope; term: string }> = [
    { scope: "bazi", term: "日主" },
    { scope: "bazi", term: "月令" },
    { scope: "bazi", term: "六合 / 六冲" },
    { scope: "ziwei", term: "命宫" },
    { scope: "ziwei", term: "身宫" },
    { scope: "ziwei", term: "四化" },
  ];
  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (!termRailRef.current?.contains(event.target as Node)) setOpenTerm(null);
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenTerm(null);
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, []);
  return (
    <section className="quick-reading" aria-labelledby="quick-reading-title">
      <header>
        <div><span>壹分钟导读</span><h2 id="quick-reading-title">先把盘面译成人话</h2></div>
        <p>以下不是给你贴标签，而是把专业结构翻成三条现实线索。先读懂，再决定是否查看古法原句和完整依据。</p>
      </header>
      <div className="quick-reading-grid">
        {reading.quickRead.map((item, index) => (
          <article key={item.label}>
            <span>0{index + 1}</span>
            <div><small>{item.label}</small><h3>{item.title}</h3><p>{item.detail}</p></div>
          </article>
        ))}
      </div>
      <div className="term-hint-rail" ref={termRailRef}>
        <div><span>随文小注</span><p>遇到术语不用离开本页，点开即可看白话与使用边界。</p></div>
        {terms.map((item) => {
          const key = `${item.scope}-${item.term}`;
          return <TermHint key={key} {...item} open={openTerm === key} onToggle={() => setOpenTerm((current) => current === key ? null : key)} />;
        })}
      </div>
    </section>
  );
}

export function EvidenceCard({ insight, onNavigate, onSave, saved = false }: {
  insight: ChartInsight;
  onNavigate?: (tab: Tab, mode?: ViewMode) => void;
  onSave?: (insight: ChartInsight) => void;
  saved?: boolean;
}) {
  const destination: ExpertMode = insight.id === "life-body-axis" || insight.id === "mutagen-paths" ? "ziwei" : "bazi";
  const question = questionForInsight(insight.id);
  return (
    <article className={`evidence-card ${insight.tone}`}>
      <header><span>{insight.index}</span><small>{insight.label}</small></header>
      <h3>{insight.title}</h3>
      <p className="insight-classical"><small>古法原句</small>{insight.summary}</p>
      <section className="insight-translation"><small>白话批注</small><p>{insight.plain}</p></section>
      <section className="insight-manifestations"><small>回到现实</small><ul>{insight.manifestations.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <details>
        <summary><span>展开盘面依据与使用边界</span><i /></summary>
        <div className="evidence-detail">
          <section><b>盘面依据</b><ul>{insight.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><b>另一种理解</b><p>{insight.alternative}</p></section>
          <section className="evidence-limit"><b>当前未纳入</b><p>{insight.limits}</p></section>
          {onSave && <section className="insight-reflection"><small>带回现实的问题</small><p>{question}</p><button className={saved ? "saved" : ""} disabled={saved} onClick={() => onSave(insight)}>{saved ? "已加入观测簿" : "留下这个问题"}</button></section>}
          {onNavigate && <button onClick={() => onNavigate("expert", destination)}>前往{destination === "ziwei" ? "紫微十二宫" : "八字四柱"}<Icon name="arrow" size={14} /></button>}
        </div>
      </details>
    </article>
  );
}

export function ReadingGuide({ chart, mode }: { chart: FateChart; mode: "bazi" | "ziwei" }) {
  const reading = buildChartReading(chart);
  const selected = mode === "bazi"
    ? reading.insights.filter((insight) => insight.id !== "life-body-axis")
        .filter((insight) => insight.id !== "mutagen-paths")
    : reading.insights.filter((insight) => insight.id === "life-body-axis" || insight.id === "mutagen-paths");

  return (
    <section className="reading-guide">
      <header>
        <div><span>{mode === "bazi" ? "阅读顺序 · 四柱" : "阅读顺序 · 十二宫"}</span><h2>{mode === "bazi" ? "先定位，再看关系" : "先看命身，再读各宫"}</h2></div>
        <p>{mode === "bazi" ? "日主 → 地支关系 → 表层分布" : "命宫 → 身宫 → 四化与宫位"}</p>
      </header>
      <div className="guide-grid">
        {selected.map((insight) => <EvidenceCard key={insight.id} insight={insight} />)}
      </div>
    </section>
  );
}

export function ZiweiMobileBrowser({ chart }: { chart: FateChart }) {
  return (
    <section className="ziwei-mobile-browser">
      <header><span>掌上观盘</span><h2>十二宫逐宫细看</h2><p>点开一宫，便见星曜、四化与大限岁限。</p></header>
      <div className="mobile-palace-list">
        {chart.ziwei.palaces.map((palace) => {
          const major = palace.stars.filter((star) => star.type === "major");
          const supporting = palace.stars.filter((star) => star.type !== "major");
          return (
            <details className={palace.name === "命宫" || palace.isBodyPalace ? "focus" : ""} key={`${palace.name}-${palace.index}`} open={palace.name === "命宫"}>
              <summary>
                <span><small>{palace.ganZhi}</small><strong>{palace.name}</strong></span>
                <b>{major.map((star) => star.name).join(" · ") || "空宫"}</b>
                <i>{palace.isBodyPalace ? "身宫" : palace.isOriginalPalace ? "来因" : "展开"}</i>
              </summary>
              <div className="mobile-palace-detail">
                <div className="mobile-star-group">
                  <small>主星</small>
                  <p>{major.length ? major.map((star) => <span key={`${star.type}-${star.name}`}>{star.name}{star.brightness && <em>{star.brightness}</em>}{star.mutagen && <b>化{star.mutagen}</b>}</span>) : <span>空宫 · 需借对宫并结合三方四正</span>}</p>
                </div>
                <div className="mobile-star-group">
                  <small>辅曜与杂曜</small>
                  <p>{supporting.length ? supporting.map((star) => <span key={`${star.type}-${star.name}`}>{star.name}{star.mutagen && <b>化{star.mutagen}</b>}</span>) : <span>当前无返回星曜</span>}</p>
                </div>
                <footer><span>十二长生 · {palace.changsheng}</span><span>大限 · {palace.decadal[0]}–{palace.decadal[1]} 岁</span></footer>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function TimeUncertaintyNotice({ onAddTime }: { onAddTime: () => void }) {
  return <section className="time-uncertainty-notice"><div><span>当前为未知时辰模式</span><h2>只展示不依赖时辰的部分</h2><p>系统以正午作为临时计算坐标。年、月、日三柱可以查看；时柱、紫微十二宫、旺衰、大运起运与精细时间判断均不作为结论。</p></div><button onClick={onAddTime}>补充准确时间</button></section>;
}
