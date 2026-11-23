"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { correctSolarTime, getTimeBranch } from "@/lib/solar-time";
import { buildChartReading, flyPalaceTransformations, getDayBranchRelations, getZiweiPeriods, type ChartInsight, type ChartReading } from "@/lib/insights";
import type { BirthProfile, FateChart, Gender, ZiweiPalace } from "@/lib/types";
import { DateTimeField } from "@/components/DateTimeField";
import { CITY_OPTIONS, cityIdForLongitude } from "@/lib/locations";
import { GLOSSARY, type GlossaryScope } from "@/lib/glossary";
import {
  createObservationRecord,
  questionForInsight,
  readObservationRecords,
  writeObservationRecords,
  type ObservationRecord,
  type ObservationSource,
} from "@/lib/observations";
import { ALGORITHM_VERSION, trackLocalEvent } from "@/lib/product";

const FeatureLoading = () => <section className="feature-loading" role="status">正在准备这一部分…</section>;
const RelationshipView = dynamic(() => import("@/components/RelationshipView").then((mod) => mod.RelationshipView), { loading: FeatureLoading });
const FortuneView = dynamic(() => import("@/components/FortuneView").then((mod) => mod.FortuneView), { loading: FeatureLoading });
const ObservationView = dynamic(() => import("@/components/ObservationView").then((mod) => mod.ObservationView), { loading: FeatureLoading });
const TerminologyPanel = dynamic(() => import("@/components/TerminologyPanel").then((mod) => mod.TerminologyPanel), { loading: FeatureLoading });

type Tab = "overview" | "explore" | "observations" | "expert";
type ExpertMode = "bazi" | "ziwei";
type ExploreMode = "self" | "timing" | "relationship";
type ViewMode = ExpertMode | ExploreMode;
type ObservationIntent = "self" | "timing" | "relationship";

function handleTabArrow<T extends string>(event: React.KeyboardEvent<HTMLButtonElement>, items: readonly T[], current: T, select: (item: T) => void, idPrefix: string) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = items.indexOf(current);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  const next = items[nextIndex];
  select(next);
  window.requestAnimationFrame(() => document.getElementById(`${idPrefix}${next}`)?.focus());
}

const INITIAL_PROFILE: BirthProfile = {
  id: "draft",
  name: "",
  date: "",
  time: "",
  timeKnown: true,
  gender: "男",
  longitude: 116.4,
  useTrueSolarTime: true,
  createdAt: new Date().toISOString(),
};

const SAMPLE_PROFILE: BirthProfile = {
  ...INITIAL_PROFILE,
  id: "sample",
  name: "示例命盘",
  date: "1990-01-27",
  time: "08:30",
  gender: "男",
};

const TAB_ITEMS: { id: Tab; label: string; hint: string }[] = [
  { id: "overview", label: "先看结论", hint: "一分钟读懂" },
  { id: "explore", label: "按问题看", hint: "自己·时间·关系" },
  { id: "observations", label: "我的验证", hint: "记录与复盘" },
  { id: "expert", label: "专业盘", hint: "八字与紫微" },
];

const INTENT_OPTIONS: Array<{ id: ObservationIntent; label: string; title: string; detail: string }> = [
  { id: "self", label: "了解自己", title: "我想先看自己", detail: "从命盘主轴与结构开始，不急着下结论。" },
  { id: "timing", label: "阶段变化", title: "我正经历变化", detail: "观察未来六年的支持、制约与变动信号。" },
  { id: "relationship", label: "关系议题", title: "我关心一段关系", detail: "先看自己的关系结构，也可以继续做双人合盘。" },
];

const ELEMENT_COLORS: Record<string, string> = {
  木: "#64b28b",
  火: "#d7674d",
  土: "#b69b63",
  金: "#d4d0bd",
  水: "#5a91ac",
};

function Icon({ name, size = 18 }: { name: "spark" | "history" | "download" | "compass" | "info" | "arrow"; size?: number }) {
  const paths = {
    spark: <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Zm-6.5 12 .9 2.6L9 17.5l-2.6.9L5.5 21l-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === "spark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PalaceCard({ palace, compact = false, highlight }: { palace: ZiweiPalace; compact?: boolean; highlight?: "daxian" | "liunian" }) {
  const major = palace.stars.filter((star) => star.type === "major");
  const minor = palace.stars.filter((star) => star.type === "minor").slice(0, 4);
  return (
    <article className={`palace-card ${compact ? "compact" : ""} ${highlight ?? ""}`} data-index={palace.index}>
      <header>
        <div>
          <span className="palace-ganzhi">{palace.ganZhi}</span>
          <strong>{palace.name}</strong>
        </div>
        <div className="palace-flags">
          {highlight === "daxian" && <span title="现行大限">限</span>}
          {highlight === "liunian" && <span title="流年宫">流</span>}
          {palace.isBodyPalace && <span>身</span>}
          {palace.isOriginalPalace && <span>因</span>}
        </div>
      </header>
      <div className="major-stars">
        {major.length ? major.map((star) => (
          <span key={star.name} title={[star.brightness, star.mutagen].filter(Boolean).join(" · ")}>
            {star.name}{star.mutagen && <i>{star.mutagen}</i>}
          </span>
        )) : <em>借星安宫</em>}
      </div>
      {!compact && <div className="minor-stars">{minor.map((star) => <span key={star.name}>{star.name}</span>)}</div>}
      <footer><span>{palace.changsheng}</span><span>{palace.decadal[0]}–{palace.decadal[1]}</span></footer>
    </article>
  );
}

function ElementBars({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="element-bars">
      {Object.entries(counts).map(([element, count]) => (
        <div className="element-row" key={element}>
          <span>{element}</span>
          <div><i style={{ width: `${Math.max(7, count * 12.5)}%`, background: ELEMENT_COLORS[element] }} /></div>
          <b>{count}</b>
        </div>
      ))}
    </div>
  );
}

function BaziTable({ chart }: { chart: FateChart }) {
  return (
    <div className="bazi-table" role="table" aria-label="八字四柱">
      <div className="bazi-labels" role="row">
        <span>项目</span>{chart.bazi.pillars.map((p) => <strong key={p.label}>{p.label}</strong>)}
      </div>
      <div className="bazi-row pillars" role="row">
        <span>天干</span>{chart.bazi.pillars.map((p) => <div key={p.label}><b>{p.gan}</b><small>{p.shiShenGan}</small></div>)}
      </div>
      <div className="bazi-row pillars" role="row">
        <span>地支</span>{chart.bazi.pillars.map((p) => <div key={p.label}><b>{p.zhi}</b><small>{p.diShi}</small></div>)}
      </div>
      <div className="bazi-row" role="row">
        <span>藏干</span>{chart.bazi.pillars.map((p) => <div key={p.label}>{p.hidden.join(" · ")}</div>)}
      </div>
      <div className="bazi-row" role="row">
        <span>纳音</span>{chart.bazi.pillars.map((p) => <div key={p.label}>{p.naYin}</div>)}
      </div>
      <div className="bazi-row" role="row">
        <span>五行</span>{chart.bazi.pillars.map((p) => <div key={p.label}>{p.wuXing}</div>)}
      </div>
    </div>
  );
}

function BaziMobileCards({ chart }: { chart: FateChart }) {
  return (
    <div className="bazi-mobile-cards" aria-label="八字四柱移动版">
      {chart.bazi.pillars.map((pillar, index) => (
        <details key={pillar.label} open={index === 2}>
          <summary>
            <span><small>{pillar.label}</small><b>{pillar.shiShenGan}</b></span>
            <strong>{pillar.gan}{pillar.zhi}</strong>
            <em>查看细节</em>
          </summary>
          <div className="mobile-pillar-detail">
            <span><small>天干 / 地支</small><b>{pillar.gan} · {pillar.zhi}</b></span>
            <span><small>藏干</small><b>{pillar.hidden.join(" · ") || "—"}</b></span>
            <span><small>十二长生</small><b>{pillar.diShi}</b></span>
            <span><small>纳音</small><b>{pillar.naYin}</b></span>
            <span><small>五行</small><b>{pillar.wuXing}</b></span>
            <span><small>地支十神</small><b>{pillar.shiShenZhi.join(" · ") || "—"}</b></span>
          </div>
        </details>
      ))}
    </div>
  );
}

function TermHint({ scope, term, open, onToggle }: { scope: GlossaryScope; term: string; open: boolean; onToggle: () => void }) {
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

function QuickReading({ reading }: { reading: ChartReading }) {
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

function EvidenceCard({ insight, onNavigate, onSave, saved = false }: {
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

function ReadingGuide({ chart, mode }: { chart: FateChart; mode: "bazi" | "ziwei" }) {
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

function ZiweiMobileBrowser({ chart }: { chart: FateChart }) {
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

function OnboardingView({ intent, onIntentChange, onStart, onSample }: {
  intent: ObservationIntent;
  onIntentChange: (intent: ObservationIntent) => void;
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <div className="onboarding-view">
      <section className="onboarding-hero">
        <div className="onboarding-copy">
          <span className="eyebrow">CYBERFATE · 初次观测</span>
          <h1>从一个问题，<br />开始观照</h1>
          <p>先说此刻关心的事。复杂盘面会收束成三条可核对的观察，依据与边界留在深处，等你需要时再展开。</p>
          <div className="intent-grid" role="radiogroup" aria-label="选择观察主题">
            {INTENT_OPTIONS.map((option, index) => (
              <button
                type="button"
                role="radio"
                aria-checked={intent === option.id}
                className={intent === option.id ? "intent-card active" : "intent-card"}
                key={option.id}
                onClick={() => onIntentChange(option.id)}
              >
                <small>0{index + 1} · {option.label}</small>
                <strong>{option.title}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
          <div className="onboarding-actions">
            <button className="onboarding-primary" onClick={onStart}>填写出生资料 <Icon name="arrow" /></button>
            <button className="onboarding-secondary" onClick={onSample}>先看示例结果</button>
          </div>
          <p className="onboarding-privacy"><Icon name="compass" size={15} /> 所有排盘都在你的浏览器内完成，生辰不会上传。</p>
        </div>
        <div className="onboarding-symbol" aria-hidden="true">
          <div className="symbol-orbit orbit-a"><i /></div>
          <div className="symbol-orbit orbit-b"><i /></div>
          <span>问</span>
          <small>所问不同<br />看盘次序也不同</small>
        </div>
      </section>
      <div className="onboarding-footline" aria-label="产品原则">
        <span><b>本地</b> 生辰不上传</span><i />
        <span><b>可查</b> 判断有依据</span><i />
        <span><b>可复盘</b> 现实会回答</span>
      </div>
    </div>
  );
}

function TimeUncertaintyNotice({ onAddTime }: { onAddTime: () => void }) {
  return <section className="time-uncertainty-notice"><div><span>当前为未知时辰模式</span><h2>只展示不依赖时辰的部分</h2><p>系统以正午作为临时计算坐标。年、月、日三柱可以查看；时柱、紫微十二宫、旺衰、大运起运与精细时间判断均不作为结论。</p></div><button onClick={onAddTime}>补充准确时间</button></section>;
}

function UnknownTimeOverview({ chart, records, onSave, onAddTime }: {
  chart: FateChart;
  records: ObservationRecord[];
  onSave: (sourceId: string, title: string, question: string) => void;
  onAddTime: () => void;
}) {
  const stablePillars = chart.bazi.pillars.slice(0, 3);
  const counts = stablePillars.reduce<Record<string, number>>((result, pillar) => {
    [...pillar.wuXing].forEach((element) => { if (element in result) result[element] += 1; });
    return result;
  }, { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 });
  const safeObservations = [
    { id: "unknown-day", label: "可确定 · 日柱", title: `日主为 ${chart.bazi.dayMaster}`, detail: `公历日期对应的日柱为 ${stablePillars[2].gan}${stablePillars[2].zhi}。不知道时辰时，不进一步判断旺衰与喜忌。`, question: "你是否能从现实经历中找到支持或反驳传统日主描述的具体例子？" },
    { id: "unknown-month", label: "可确定 · 月令", title: `月柱为 ${stablePillars[1].gan}${stablePillars[1].zhi}`, detail: `月柱按节气确定，不受出生时辰影响；但它仍不能独自概括性格或人生阶段。`, question: "同一季节出生的人差异很大，你认为哪些现实环境更能解释自己的选择？" },
    { id: "unknown-elements", label: "可确定 · 三柱", title: "先看三柱的表层分布", detail: Object.entries(counts).map(([element, count]) => `${element}${count}`).join(" · "), question: "这只是三柱计数。它与你的现实体验有哪些对应，又有哪些明显反例？" },
  ];
  return <div className="view-stack unknown-time-view">
    <TimeUncertaintyNotice onAddTime={onAddTime} />
    <section className="unknown-pillar-hero"><div><span className="eyebrow">三柱临时档案</span><h1>{chart.profile.name || "未命名档案"}</h1><p>{chart.profile.date} · 时辰未知 · {chart.profile.gender}命</p></div><div className="stable-pillars">{stablePillars.map((pillar) => <span key={pillar.label}><small>{pillar.label}</small><b>{pillar.gan}{pillar.zhi}</b></span>)}</div></section>
    <section className="safe-observation-section"><header><span>当前可读</span><h2>三条有限观察</h2><p>不拿临时午时盘冒充完整命盘。</p></header><div className="safe-observation-grid">{safeObservations.map((item, index) => {
      const saved = records.some((record) => record.profileId === chart.profile.id && record.sourceId === item.id);
      return <article key={item.id}><header><span>0{index + 1}</span><small>{item.label}</small></header><h3>{item.title}</h3><p>{item.detail}</p><blockquote>{item.question}</blockquote><button disabled={saved} className={saved ? "saved" : ""} onClick={() => onSave(item.id, item.title, item.question)}>{saved ? "已加入观测簿" : "留下这个问题"}</button></article>;
    })}</div></section>
    <section className="unknown-boundaries"><div><span>暂不判断</span><h2>这些内容会随时辰改变</h2></div><p><b>时柱与旺衰</b><small>时干支、藏干、强弱权重与大运起运</small></p><p><b>紫微十二宫</b><small>命宫、身宫、星曜与四化落宫</small></p><p><b>精细时间窗口</b><small>流年叠盘、关系触发与专业盘面</small></p></section>
  </div>;
}

function Overview({ chart, intent, records, onSaveInsight, onNavigate }: {
  chart: FateChart;
  intent: ObservationIntent;
  records: ObservationRecord[];
  onSaveInsight: (insight: ChartInsight) => void;
  onNavigate: (tab: Tab, mode?: ViewMode) => void;
}) {
  const lifePalace = chart.ziwei.palaces.find((p) => p.name === "命宫") ?? chart.ziwei.palaces[0];
  const majorStars = lifePalace.stars.filter((s) => s.type === "major").map((s) => s.name);
  const reading = buildChartReading(chart);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const sortedInsights = [...reading.insights].sort((a, b) => Number(a.index) - Number(b.index));
  const visibleInsights = showAllInsights ? sortedInsights : sortedInsights.slice(0, 3);
  const nextStep = intent === "timing"
    ? { eyebrow: "接下来", title: "把观察放进时间", detail: "查看当前大运、流年与未来六年的支持和变动信号。", tab: "explore" as Tab, mode: "timing" as ExploreMode }
    : intent === "relationship"
      ? { eyebrow: "接下来", title: "继续看关系结构", detail: "先理解自己的关系模式，再按需加入另一人的资料。", tab: "explore" as Tab, mode: "relationship" as ExploreMode }
      : { eyebrow: "接下来", title: "继续探索自己", detail: "展开全部观察，再决定哪些问题值得带回现实。", tab: "explore" as Tab, mode: "self" as ExploreMode };

  return (
    <div className="view-stack">
      <section className="hero-dashboard">
        <div className="identity-block">
          <span className="eyebrow">本命档案</span>
          <h1>{chart.profile.name || "未命名命盘"}</h1>
          <div className="calendar-coordinates">
            <span><small>紫微农历干支</small>{chart.ziwei.chineseDate}</span>
            <span><small>子平节气四柱</small>{chart.bazi.pillars.map((pillar) => `${pillar.gan}${pillar.zhi}`).join(" ")}</span>
            <span><small>时辰 · 排盘口径</small>{chart.ziwei.time} · {chart.profile.gender}命</span>
          </div>
          <details className="calendar-boundary-note">
            <summary>为什么两套干支可能不同？</summary>
            <p>紫微按农历年月显示，子平八字按立春与节气划分年、月。临近春节或节气时，两套结果不同是计算口径差异，并非重复计算出错。</p>
          </details>
          <div className="identity-seals">
            <span><small>命主</small>{chart.ziwei.soul}</span>
            <span><small>身主</small>{chart.ziwei.body}</span>
            <span><small>五行局</small>{chart.ziwei.fiveElementsClass}</span>
            <span><small>日主</small>{chart.bazi.dayMaster}</span>
          </div>
        </div>
        <div className="orbital-mark" aria-hidden="true">
          <div className="orbit orbit-one"><i /></div>
          <div className="orbit orbit-two"><i /></div>
          <div className="orbit-core"><span>{lifePalace.ganZhi}</span><b>命</b><small>{majorStars.join(" · ") || "空宫"}</small></div>
          {"子丑寅卯辰巳午未申酉戌亥".split("").map((branch, index) => <em key={branch} style={{ "--i": index } as React.CSSProperties}>{branch}</em>)}
        </div>
      </section>

      <QuickReading reading={reading} />

      <section className="orientation-panel">
        <div className="orientation-copy">
          <span className="eyebrow">命盘导读 · 从这里开始</span>
          <h2>{reading.headline}</h2>
          <p>{reading.summary}</p>
        </div>
        <div className="coverage-ledger">
          <div><small>本次已纳入</small><p>{reading.included.map((item) => <span key={item}>{item}</span>)}</p></div>
          <div><small>尚待纳入</small><p>{reading.missing.map((item) => <span key={item}>{item}</span>)}</p></div>
        </div>
      </section>

      <div className="overview-grid">
        <section className="panel bazi-preview">
          <div className="section-heading">
            <div><span>八字 · 四柱</span><h2>四柱骨架</h2></div>
            <button onClick={() => onNavigate("expert", "bazi")}>展开八字 <Icon name="arrow" size={15} /></button>
          </div>
          <div className="mini-pillars">
            {chart.bazi.pillars.map((pillar) => (
              <div key={pillar.label}>
                <small>{pillar.label}</small>
                <b>{pillar.gan}</b><b>{pillar.zhi}</b>
                <span>{pillar.naYin}</span>
              </div>
            ))}
          </div>
          <ElementBars counts={chart.bazi.elementCounts} />
        </section>

        <section className="panel ziwei-preview">
          <div className="section-heading">
            <div><span>紫微 · 命宫</span><h2>命宫主轴</h2></div>
            <button onClick={() => onNavigate("expert", "ziwei")}>查看十二宫 <Icon name="arrow" size={15} /></button>
          </div>
          <PalaceCard palace={lifePalace} />
          <div className="metric-strip">
            <span><small>命宫</small>{chart.ziwei.soulPalace}</span>
            <span><small>身宫</small>{chart.ziwei.bodyPalace}</span>
            <span><small>生肖</small>{chart.ziwei.zodiac}</span>
            <span><small>星座</small>{chart.ziwei.sign}</span>
          </div>
        </section>
      </div>

      <section className="next-step-panel">
        <div><span>{nextStep.eyebrow}</span><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></div>
        <button onClick={() => onNavigate(nextStep.tab, nextStep.mode)}>继续观察 <Icon name="arrow" /></button>
      </section>

      <section className="reading-panel">
        <div className="section-heading">
          <div><span>两盘参看 · 可展开证据</span><h2>{showAllInsights ? "完整观察" : "三条核心观察"}</h2></div>
          <span className="method-badge">规则推演 · 不作妄断</span>
        </div>
        <div className="evidence-grid">
          {visibleInsights.map((insight) => <EvidenceCard key={insight.id} insight={insight} onNavigate={onNavigate} onSave={onSaveInsight} saved={records.some((record) => record.profileId === chart.profile.id && record.sourceId === insight.id)} />)}
        </div>
        {sortedInsights.length > 3 && <button className="reading-more" onClick={() => setShowAllInsights((value) => !value)}>{showAllInsights ? "收起其余观察" : `展开其余 ${sortedInsights.length - 3} 条观察`} <Icon name="arrow" size={15} /></button>}
      </section>
    </div>
  );
}

function ExplorationView({ chart, mode, records, onModeChange, onSaveInsight, onSaveObservation, onNavigate }: {
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

function ZiweiView({ chart }: { chart: FateChart }) {
  const periods = getZiweiPeriods(chart);
  return (
    <div className="view-stack">
      <section className="page-intro">
        <div><span className="eyebrow">本命 · 十二宫</span><h1>紫微十二宫</h1><p>本命盘 · {chart.ziwei.lunarDate} · {chart.ziwei.timeRange}</p></div>
        <div className="legend"><span><i className="major-dot" />主星</span><span><i className="body-dot" />身宫</span><span><i className="cause-dot" />来因宫</span><span><i className="daxian-dot" />现行大限</span><span><i className="liunian-dot" />流年宫</span></div>
      </section>
      <ReadingGuide chart={chart} mode="ziwei" />
      <TerminologyPanel scope="ziwei" />
      <section className="astrolabe-shell">
        <div className="astrolabe-grid">
          {chart.ziwei.palaces.map((palace) => (
            <PalaceCard
              key={`${palace.name}-${palace.index}`}
              palace={palace}
              highlight={palace.index === periods.daXian?.index ? "daxian" : palace.index === periods.liuNian?.index ? "liunian" : undefined}
            />
          ))}
          <div className="chart-center">
            <span>本命盘</span>
            <h2>{chart.profile.name || "本命盘"}</h2>
            <div><b>{chart.ziwei.soul}</b><small>命主</small><i /><b>{chart.ziwei.body}</b><small>身主</small></div>
            <p>{chart.ziwei.fiveElementsClass}</p>
            <small>{chart.correctedDateTime}</small>
            <small>虚岁 {periods.virtualAge} · 大限{periods.daXian?.name ?? "未定"} · 流年宫{periods.liuNian?.name ?? "未定"}</small>
          </div>
        </div>
      </section>
      <section className="panel sihua-trace">
        <div className="section-heading"><div><span>宫干四化 · 飞星追迹</span><h2>四化追宫</h2></div></div>
        <div className="sihua-grid">
          {["命宫", "夫妻宫"].map((name) => {
            const { stem, flies } = flyPalaceTransformations(chart, name);
            return (
              <div className="sihua-item" key={name}>
                <b>{name}干{stem}</b>
                <p>{flies.map((fly) => `${fly.star}化${fly.mutagen}入${fly.toPalace ?? "盘内不见"}`).join("、")}</p>
              </div>
            );
          })}
        </div>
        <p className="fine-print">四化表取中州派口径（庚干太阴化科、壬干左辅化科）；飞化只追本命落宫，自化与大限流年四化叠盘未纳入。</p>
      </section>
      <ZiweiMobileBrowser chart={chart} />
      <p className="source-note"><Icon name="info" size={15} /> 星曜与宫位由 iztro 开源算法生成。大限宫按虚岁标注，流年宫随流年地支；大限、流年叠盘将在时间线模块开放。</p>
    </div>
  );
}

function BaziView({ chart }: { chart: FateChart }) {
  const relations = getDayBranchRelations(chart);
  const startYearSafe = new Date().getFullYear();
  return (
    <div className="view-stack">
      <section className="page-intro">
        <div><span className="eyebrow">子平 · 四柱</span><h1>子平四柱</h1><p>{chart.bazi.lunarText} · 日主 {chart.bazi.dayMaster}</p></div>
        <div className="bazi-stamp"><span>八</span><span>字</span></div>
      </section>
      <ReadingGuide chart={chart} mode="bazi" />
      <TerminologyPanel scope="bazi" />
      <section className="bazi-relation-strip" aria-label="日支关系摘要">
        <div><small>日支坐标</small><b>{relations.dayPillar.zhi}</b></div>
        <div><small>六合 · 化神</small><b>{relations.combined.length ? relations.combined.map((pillar) => {
          const he = relations.heTransforms.find((item) => item.pillar === pillar);
          return `${pillar.zhi}${he ? (he.transformed ? `化${he.element}` : "绊") : ""}`;
        }).join("、") : "未见"}</b></div>
        <div><small>三合局</small><b>{relations.trines.length ? relations.trines.map((trine) => `${trine.members.join("")}${trine.full ? "全" : "半"}${trine.element}`).join("、") : "未见"}</b></div>
        <div><small>直接六冲</small><b>{relations.clashed.length ? relations.clashed.map((pillar) => pillar.zhi).join("、") : "未见"}</b></div>
        <div><small>刑 · 害 · 破</small><b>{[
          ...relations.fullXing.map((group) => `三刑${group.join("")}`),
          ...relations.punished.map((pillar) => `刑${pillar.zhi}`),
          relations.selfXing ? `自刑${relations.dayPillar.zhi}` : "",
          ...relations.harmed.map((pillar) => `害${pillar.zhi}`),
          ...relations.broken.map((pillar) => `破${pillar.zhi}`),
        ].filter(Boolean).join("、") || "未见"}</b></div>
        <p>合有化与不化之别：化神透干或得令则论化，否则为绊。冲主动荡，刑主磨砺，害主暗损，破主小耗。流月触发未纳入。</p>
      </section>
      <section className="panel bazi-detail"><BaziTable chart={chart} /></section>
      <BaziMobileCards chart={chart} />
      <section className="panel bazi-mastery">
        <div className="section-heading">
          <div><span>月令为本 · 藏干为根</span><h2>日主旺衰</h2></div>
          <b className={`strength-verdict ${chart.bazi.strength.verdict === "身强" ? "strong" : chart.bazi.strength.verdict === "身弱" ? "weak" : "neutral"}`}>{chart.bazi.strength.verdict}</b>
        </div>
        <p className="mastery-command">{chart.bazi.strength.commandNote}，表层近似判定为{chart.bazi.strength.verdict}。</p>
        <div className="favor-strip">
          {chart.bazi.strength.favorable.length ? <>
            <div><small>喜（可用）</small>{chart.bazi.strength.favorable.map((item) => <b key={item}>{item}</b>)}</div>
            <div><small>忌（受制）</small>{chart.bazi.strength.unfavorable.map((item) => <b key={item}>{item}</b>)}</div>
          </> : <p className="fine-print">日主中和，喜忌随岁运具体组合，不作单向判断。</p>}
        </div>
        <details>
          <summary><span>查看判定依据</span><i /></summary>
          <ul className="mastery-evidence">{chart.bazi.strength.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="fine-print">未纳入合化、调候、格局取用与藏干精确权重；判定结果只用于给生克信号定喜忌方向。</p>
        </details>
      </section>

      <section className="panel dayun-panel">
        <div className="section-heading"><div><span>命好不如运好 · 十年一步</span><h2>大运流转</h2></div></div>
        <div className="dayun-strip">
          {chart.bazi.daYun.map((item) => {
            const isCurrent = startYearSafe >= item.startYear && startYearSafe <= item.endYear;
            return (
              <div key={item.startYear} className={isCurrent ? "dayun-item current" : "dayun-item"}>
                <small>{item.startYear}–{item.endYear}</small>
                <b>{item.ganZhi}</b>
                <span>{item.startAge}–{item.startAge + 9} 岁{isCurrent ? " · 现行" : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="fine-print">大运顺逆由阴阳年与性别而定，与流年叠加观察；此处展示九步大运。大运参与时运六象的推演。</p>
      </section>

      <div className="bazi-lower-grid">
        <section className="panel">
          <div className="section-heading"><div><span>四柱表层统计</span><h2>五行数量</h2></div></div>
          <ElementBars counts={chart.bazi.elementCounts} />
          <p className="fine-print">此处只统计四柱天干与地支共八字的表层五行，不含藏干权重、月令旺衰与合冲刑害。</p>
        </section>
        <section className="panel auxiliary-grid">
          <div><small>命宫</small><strong>{chart.bazi.mingGong}</strong></div>
          <div><small>身宫</small><strong>{chart.bazi.shenGong}</strong></div>
          <div><small>胎元</small><strong>{chart.bazi.taiYuan}</strong></div>
          <div><small>旬空</small><strong>{chart.bazi.xunKong}</strong></div>
        </section>
      </div>
      <p className="source-note"><Icon name="info" size={15} /> 四柱按节气定月，晚子时采用 sect 2 规则；1986–1991 年夏令时出生已自动还原。旺衰以月令为本、藏干为根，大运顺逆由阴阳年与性别推得。命理解读仅供文化研究与自我观察。</p>
    </div>
  );
}

function ExpertView({ chart, mode, onModeChange }: { chart: FateChart; mode: ExpertMode; onModeChange: (mode: ExpertMode) => void }) {
  return (
    <div className="expert-view">
      {chart.profile.timeKnown === false && <section className="expert-uncertain"><span>临时盘面 · 不作为结论</span><p>以下专业盘按正午临时坐标生成，只用于了解盘面结构。时柱、旺衰、紫微诸宫与运限都可能在补充时辰后改变。</p></section>}
      <div className="professional-switcher" role="tablist" aria-label="专业盘面">
        <div><span>专业盘面 · {ALGORITHM_VERSION}</span><small>保留全部盘面、口径与判断依据</small></div>
        <div>
          <button id="expert-tab-bazi" aria-controls="expert-panel" tabIndex={mode === "bazi" ? 0 : -1} role="tab" aria-selected={mode === "bazi"} className={mode === "bazi" ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, ["bazi", "ziwei"] as const, mode, onModeChange, "expert-tab-")} onClick={() => onModeChange("bazi")}>子平八字</button>
          <button id="expert-tab-ziwei" aria-controls="expert-panel" tabIndex={mode === "ziwei" ? 0 : -1} role="tab" aria-selected={mode === "ziwei"} className={mode === "ziwei" ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, ["bazi", "ziwei"] as const, mode, onModeChange, "expert-tab-")} onClick={() => onModeChange("ziwei")}>紫微斗数</button>
        </div>
      </div>
      <div id="expert-panel" role="tabpanel" aria-labelledby={`expert-tab-${mode}`}>{mode === "bazi" ? <BaziView chart={chart} /> : <ZiweiView chart={chart} />}</div>
      <section className="algorithm-ledger"><div><span>算法口径</span><h2>本次计算如何得到</h2></div><dl><div><dt>历法</dt><dd>节气定月 · 晚子时 sect 2 · 1986–1991 夏令时还原</dd></div><div><dt>时间</dt><dd>{chart.profile.useTrueSolarTime ? "真太阳时：经度差 + 均时差" : "未启用真太阳时校正"}</dd></div><div><dt>八字</dt><dd>lunar-javascript · 旺衰为规则近似，不代替格局调候</dd></div><div><dt>紫微</dt><dd>iztro · 中州派四化口径 · 当前未做完整运限叠盘</dd></div></dl></section>
    </div>
  );
}

function localDateValue(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

function localDateAfter(days: number) {
  return localDateValue(new Date(Date.now() + days * 86_400_000));
}

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > localDateValue()) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isBirthProfile(value: unknown): value is BirthProfile {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BirthProfile>;
  return typeof item.id === "string" && typeof item.name === "string" && isValidBirthDate(item.date ?? "") && isValidTime(item.time ?? "") && (item.gender === "男" || item.gender === "女") && typeof item.longitude === "number" && item.longitude >= 73 && item.longitude <= 135 && typeof item.useTrueSolarTime === "boolean";
}

function isObservationRecord(value: unknown): value is ObservationRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ObservationRecord>;
  return typeof item.id === "string" && typeof item.profileId === "string" && typeof item.title === "string" && typeof item.question === "string" && typeof item.observedOn === "string";
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function CyberfateApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [expertMode, setExpertMode] = useState<ExpertMode>("bazi");
  const [exploreMode, setExploreMode] = useState<ExploreMode>("self");
  const [intent, setIntent] = useState<ObservationIntent>("self");
  const [hasResult, setHasResult] = useState(false);
  const [cityId, setCityId] = useState("");
  const [genderSelected, setGenderSelected] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [profile, setProfile] = useState<BirthProfile>(INITIAL_PROFILE);
  const [chart, setChart] = useState<FateChart | null>(null);
  const [history, setHistory] = useState<BirthProfile[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("cyberfate-history") ?? "[]");
      setHistory(Array.isArray(stored) ? stored.filter(isBirthProfile).slice(0, 8) : []);
    } catch {
      setHistory([]);
    }
    setObservations(readObservationRecords());
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  function flashNotice(message: string, duration = 2600) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, duration);
  }

  function holdNotice(message: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice(message);
  }

  const draftHasDateTime = isValidBirthDate(profile.date) && (profile.timeKnown === false || isValidTime(profile.time));
  const draftReady = draftHasDateTime && genderSelected && Boolean(cityId);
  const timeBranch = useMemo(() => getTimeBranch(profile.time), [profile.time]);
  const preview = useMemo(() => draftHasDateTime ? correctSolarTime({ ...profile, time: profile.timeKnown === false ? "12:00" : profile.time }) : null, [draftHasDateTime, profile]);
  const previewCorrection = preview?.detail;
  const previewBranch = useMemo(() => preview ? getTimeBranch(`${preview.date.getHours()}:00`) : "", [preview]);

  function updateProfile<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function navigateToTab(nextTab: Tab, nextMode?: ViewMode) {
    if (nextTab === "expert" && (nextMode === "bazi" || nextMode === "ziwei")) setExpertMode(nextMode);
    if (nextTab === "explore" && (nextMode === "self" || nextMode === "timing" || nextMode === "relationship")) setExploreMode(nextMode);
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const stage = document.querySelector<HTMLElement>(".content-stage");
      const topbar = document.querySelector<HTMLElement>(".topbar");
      if (stage) {
        const top = stage.getBoundingClientRect().top + window.scrollY - (topbar?.offsetHeight ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      }
      const heading = stage?.querySelector<HTMLElement>("h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  }

  function updateCity(nextCityId: string) {
    setCityId(nextCityId);
    const city = CITY_OPTIONS.find((item) => item.id === nextCityId);
    if (city) updateProfile("longitude", city.longitude);
  }

  function startInput() {
    setRailCollapsed(false);
    setMobileControlsOpen(true);
    window.requestAnimationFrame(() => {
      const firstField = document.querySelector<HTMLElement>("#birth-controls .picker-trigger");
      firstField?.focus({ preventScroll: true });
      document.querySelector<HTMLElement>(".control-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startPersonalInput() {
    setProfile({ ...INITIAL_PROFILE, createdAt: new Date().toISOString() });
    setCityId("");
    setGenderSelected(false);
    setChart(null);
    setHasResult(false);
    setTab("overview");
    startInput();
  }

  async function showSample() {
    setIsCalculating(true);
    try {
      const { createFateChart } = await import("@/lib/engines");
      setProfile(SAMPLE_PROFILE);
      setChart(createFateChart(SAMPLE_PROFILE));
      setCityId("beijing");
      setGenderSelected(true);
      setHasResult(true);
      setRailCollapsed(true);
      setMobileControlsOpen(false);
      navigateToTab("overview");
      trackLocalEvent("sample_opened");
      flashNotice("当前展示的是示例数据，不是你的命盘", 3200);
    } catch {
      holdNotice("示例命盘加载失败，请刷新后重试");
    } finally {
      setIsCalculating(false);
    }
  }

  async function generate() {
    try {
      if (!isValidBirthDate(profile.date) || (profile.timeKnown !== false && !isValidTime(profile.time))) {
        throw new Error(profile.timeKnown === false ? "请填写有效的出生日期，且不能晚于今天" : "请填写有效的出生日期和时间；出生日期不能晚于今天");
      }
      if (!genderSelected) throw new Error("请选择传统排盘使用的男命或女命口径");
      if (!cityId) throw new Error("请选择出生城市；当前仅支持中国标准时间（UTC+8）");
      if (!Number.isFinite(profile.longitude) || profile.longitude < 73 || profile.longitude > 135) {
        throw new Error("出生地经度请输入 73°–135° 之间的数值");
      }
      setIsCalculating(true);
      const next: BirthProfile = { ...profile, time: profile.timeKnown === false ? "12:00" : profile.time, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      const { createFateChart } = await import("@/lib/engines");
      const result = createFateChart(next);
      setChart(result);
      setProfile(next);
      setHasResult(true);
      const records = [next, ...history.filter((item) => !(item.date === next.date && item.time === next.time && item.gender === next.gender))].slice(0, 8);
      setHistory(records);
      try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可使用 */ }
      setExploreMode(intent);
      navigateToTab(next.timeKnown === false ? "overview" : intent === "self" ? "overview" : "explore", intent);
      setMobileControlsOpen(false);
      setRailCollapsed(true);
      trackLocalEvent("chart_generated", { intent, timeKnown: next.timeKnown !== false });
      flashNotice(next.timeKnown === false ? "已生成三柱有限观察；补充时辰可展开完整盘面" : "已根据你的资料生成命盘", 3200);
    } catch (error) {
      holdNotice(error instanceof Error ? error.message : "生成失败，请检查出生资料");
    } finally {
      setIsCalculating(false);
    }
  }

  async function loadProfile(item: BirthProfile) {
    setIsCalculating(true);
    try {
      const { createFateChart } = await import("@/lib/engines");
      setProfile(item);
      setChart(createFateChart(item));
      setHasResult(true);
      setGenderSelected(true);
      setCityId(cityIdForLongitude(item.longitude));
      setHistoryOpen(false);
      setPendingDeleteId(null);
      setConfirmClear(false);
      setRailCollapsed(true);
      navigateToTab("overview");
      setMobileControlsOpen(false);
    } catch {
      holdNotice("此档案无法读取，请检查备份版本或出生资料");
    } finally {
      setIsCalculating(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setPendingDeleteId(null);
    setConfirmClear(false);
  }

  function removeProfile(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setConfirmClear(false);
      return;
    }
    const records = history.filter((item) => item.id !== id);
    setHistory(records);
    try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可删除 */ }
    setPendingDeleteId(null);
    flashNotice("档案已删除", 2200);
  }

  function clearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      setPendingDeleteId(null);
      return;
    }
    localStorage.removeItem("cyberfate-history");
    setHistory([]);
    setConfirmClear(false);
    flashNotice("已清空全部档案", 2200);
  }

  function exportChart() {
    if (!hasResult || !chart) return;
    downloadJson(`cyberfate-${chart.profile.name || chart.profile.date}.json`, {
      format: "cyberfate-chart",
      version: 1,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      chart,
      observations: observations.filter((record) => record.profileId === chart.profile.id),
    });
    flashNotice("已导出当前命盘 JSON，请妥善保存", 2800);
  }

  function exportBackup() {
    downloadJson(`cyberfate-backup-${localDateValue()}.json`, {
      format: "cyberfate-backup",
      version: 1,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      profiles: history,
      observations,
    });
    flashNotice("已导出全部档案与观测记录", 2600);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件超过 5MB，请检查是否选择了正确文件");
      const value = JSON.parse(await file.text()) as { format?: string; version?: number; profiles?: unknown[]; observations?: unknown[] };
      if (value.format !== "cyberfate-backup" || value.version !== 1 || !Array.isArray(value.profiles) || !Array.isArray(value.observations)) {
        throw new Error("请选择由本应用导出的完整备份文件");
      }
      const importedProfiles = value.profiles.filter(isBirthProfile);
      const importedObservations = value.observations.filter(isObservationRecord);
      if (!importedProfiles.length && !importedObservations.length) throw new Error("备份中没有可恢复的档案或观测记录");
      const mergedProfiles = [...importedProfiles, ...history.filter((item) => !importedProfiles.some((incoming) => incoming.id === item.id))].slice(0, 8);
      const mergedObservations = [...importedObservations, ...observations.filter((item) => !importedObservations.some((incoming) => incoming.id === item.id))];
      setHistory(mergedProfiles);
      updateObservations(mergedObservations);
      localStorage.setItem("cyberfate-history", JSON.stringify(mergedProfiles));
      flashNotice(`已恢复 ${importedProfiles.length} 个档案与 ${importedObservations.length} 条观测`, 3400);
    } catch (error) {
      holdNotice(error instanceof Error ? error.message : "备份读取失败，请检查文件格式");
    }
  }

  function updateObservations(records: ObservationRecord[]) {
    setObservations(records);
    writeObservationRecords(records);
  }

  function saveInsight(insight: ChartInsight) {
    saveProductObservation("insight", insight.id, insight.title, questionForInsight(insight.id));
  }

  function saveProductObservation(source: ObservationSource, sourceId: string, title: string, question: string, observedOn = new Date().toISOString().slice(0, 10)) {
    if (!chart) return;
    if (observations.some((record) => record.profileId === chart.profile.id && record.sourceId === sourceId)) return;
    const record = createObservationRecord({
      profileId: chart.profile.id,
      profileName: chart.profile.name || "未命名命盘",
      source,
      sourceId,
      title,
      question,
      observedOn,
      reviewOn: localDateAfter(30),
    });
    updateObservations([record, ...observations]);
    trackLocalEvent("observation_saved", { source });
    flashNotice("问题已加入观测簿，日后可回来核对", 2600);
  }

  function saveLimitedObservation(sourceId: string, title: string, question: string) {
    saveProductObservation("insight", sourceId, title, question);
  }

  function requestKnownTime() {
    updateProfile("timeKnown", true);
    updateProfile("time", "");
    setRailCollapsed(false);
    setMobileControlsOpen(true);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".control-rail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => hasResult && navigateToTab("overview")} aria-label={hasResult ? "返回总览" : "Cyberfate 首页"}>
          <span className="brand-mark"><i /><b>命</b></span>
          <span><strong>CYBERFATE</strong><small>数字命理观星台</small></span>
        </button>
        <div className="top-actions">
          <button onClick={() => historyOpen ? closeHistory() : setHistoryOpen(true)}><Icon name="history" />档案</button>
          <button onClick={exportChart} disabled={!hasResult} title={hasResult ? "导出当前命盘" : "生成命盘后可导出"}><Icon name="download" />导出</button>
        </div>
      </header>

      <div className={`workspace ${hasResult ? "has-result" : ""} ${railCollapsed ? "rail-collapsed" : ""}`}>
        <aside className="control-rail">
          {hasResult && railCollapsed && <button className="desktop-rail-toggle" aria-expanded="false" aria-controls="birth-controls" onClick={() => setRailCollapsed(false)}><Icon name="compass" /><span>资料</span></button>}
          <button className="mobile-rail-toggle" aria-expanded={mobileControlsOpen} aria-controls="birth-controls" onClick={() => setMobileControlsOpen((value) => !value)}>
            <span><small>{hasResult ? "当前档案" : "准备起盘"}</small><strong>{hasResult ? (chart?.profile.name || "未命名命盘") : (profile.name || "填写出生资料")}</strong><em>{hasResult ? chart?.profile.date : (profile.date || "尚未选择日期")} · {(hasResult ? chart?.profile.timeKnown : profile.timeKnown) === false ? "时辰未知" : (hasResult ? chart?.profile.time : (profile.time || "尚未选择时间"))}</em></span>
            <b>{mobileControlsOpen ? "收起资料" : hasResult ? "修改资料" : "开始填写"}</b>
          </button>
          <div className={`rail-body ${mobileControlsOpen ? "mobile-open" : ""}`} id="birth-controls">
            <div className="rail-heading"><div><span>出生资料</span><h2>生成观察</h2></div>{hasResult && <button className="rail-collapse-button" onClick={() => setRailCollapsed(true)} aria-label="收起出生资料">收起</button>}<p>只在浏览器本地计算，不上传生辰。</p></div>
            <div className="form-stack">
              <label><span>档案名称 <small>选填</small></span><input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} placeholder="例如：我的命盘" /></label>
              <div className="field-pair">
                <DateTimeField label="公历日期" type="date" value={profile.date} max={localDateValue()} onChange={(value) => updateProfile("date", value)} />
                {profile.timeKnown !== false ? <DateTimeField label="出生时间" type="time" value={profile.time} onChange={(value) => updateProfile("time", value)} /> : <div className="unknown-time-placeholder"><span>出生时间</span><b>暂不知道</b><small>先按正午生成有限观察</small></div>}
              </div>
              <button
                type="button"
                className={`time-known-link ${profile.timeKnown === false ? "active" : ""}`}
                onClick={() => {
                  if (profile.timeKnown === false) { updateProfile("timeKnown", true); updateProfile("time", ""); }
                  else {
                    updateProfile("timeKnown", false);
                    updateProfile("time", "12:00");
                  }
                }}
              >
                <span>{profile.timeKnown === false ? "时辰暂未知" : "不知道准确时间？"}</span>
                <small>{profile.timeKnown === false ? "点击补充准确时间" : "先按年、月、日三柱观察"}</small>
              </button>
              <fieldset><legend>传统排盘口径 <small>用于大运顺逆</small></legend><div className="segmented">{(["男", "女"] as Gender[]).map((gender) => <button type="button" aria-pressed={genderSelected && profile.gender === gender} className={genderSelected && profile.gender === gender ? "active" : ""} key={gender} onClick={() => { updateProfile("gender", gender); setGenderSelected(true); }}>{gender}命</button>)}</div></fieldset>
              <label><span>出生城市</span><select className="place-select" value={cityId} onChange={(event) => updateCity(event.target.value)}><option value="" disabled>请选择城市</option>{CITY_OPTIONS.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}<option value="custom">其他 / 手动经度</option></select></label>
              <p className="timezone-scope" role="note"><Icon name="info" size={14} /> 当前仅支持按中国标准时间（UTC+8）记录的出生时间；海外时区暂不适用。</p>
              <details className="advanced-location" open={cityId === "custom"}>
                <summary>高级：手动输入经度</summary>
                <label><span>出生地经度 <small>东经</small></span><div className="longitude-input"><input type="number" min="73" max="135" step="0.1" value={profile.longitude} onChange={(event) => { setCityId("custom"); updateProfile("longitude", Number(event.target.value)); }} /><b>°</b></div></label>
              </details>
              {profile.timeKnown !== false && <label className="toggle-row"><span><b>真太阳时校正</b><small>经度差 + 均时差</small></span><input type="checkbox" checked={profile.useTrueSolarTime} onChange={(event) => updateProfile("useTrueSolarTime", event.target.checked)} /><i /></label>}
            </div>
            <div className={`correction-readout ${profile.timeKnown === false ? "unknown" : ""}`}>
              <span>{profile.timeKnown === false ? "当前精度" : "校正预览"}</span><b>{profile.timeKnown === false && draftHasDateTime ? "三柱" : !previewCorrection ? "待填写" : profile.useTrueSolarTime ? `${previewCorrection.minutes >= 0 ? "+" : ""}${previewCorrection.minutes} min` : "OFF"}</b>
              <small>{!draftHasDateTime ? "填写日期与时间后显示校正结果" : profile.timeKnown === false ? "时柱与紫微盘暂不作为结论" : profile.useTrueSolarTime ? `校正后 ${previewBranch}时` : `${timeBranch}时`} {profile.timeKnown !== false && previewCorrection && `· 基准东经 120°${previewCorrection.dstMinutes !== 0 ? ` · 夏令时还原 ${previewCorrection.dstMinutes} min` : ""}`}</small>
            </div>
            <button className="generate-button" disabled={!draftReady || isCalculating} onClick={generate}><Icon name="spark" /><span>{isCalculating ? "正在计算" : "生成我的观察"}<small>{draftReady ? "依当前资料起盘" : "请先完成必填资料"}</small></span><Icon name="arrow" /></button>
            <p className="privacy-note"><Icon name="compass" size={15} /> 本地计算 · 生辰不会上传</p>
          </div>
        </aside>

        <section className="content-stage">
          {hasResult && chart?.profile.id === "sample" && <div className="sample-mode-banner" role="status"><b>示例数据</b><span>当前内容用于体验功能，不代表你的命盘。</span><button onClick={startPersonalInput}>填写我的资料</button></div>}
          {hasResult && <nav className="tabbar" role="tablist" aria-label="命盘视图">
            {TAB_ITEMS.map((item) => <button id={`view-tab-${item.id}`} aria-controls="view-panel" tabIndex={tab === item.id ? 0 : -1} role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, TAB_ITEMS.map((entry) => entry.id), tab, navigateToTab, "view-tab-")} onClick={() => navigateToTab(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}
          </nav>}
          <div className="view-container" id="view-panel" role={hasResult ? "tabpanel" : undefined} aria-labelledby={hasResult ? `view-tab-${tab}` : undefined}>
            {!hasResult && <OnboardingView intent={intent} onIntentChange={setIntent} onStart={startInput} onSample={showSample} />}
            {hasResult && chart && tab === "overview" && (chart.profile.timeKnown === false ? <UnknownTimeOverview chart={chart} records={observations} onSave={saveLimitedObservation} onAddTime={requestKnownTime} /> : <Overview chart={chart} intent={intent} records={observations} onSaveInsight={saveInsight} onNavigate={navigateToTab} />)}
            {hasResult && chart && tab === "explore" && <ExplorationView chart={chart} mode={exploreMode} records={observations} onModeChange={setExploreMode} onSaveInsight={saveInsight} onSaveObservation={saveProductObservation} onNavigate={navigateToTab} />}
            {hasResult && chart && tab === "observations" && <ObservationView chart={chart} records={observations} onChange={updateObservations} onExplore={() => navigateToTab("overview")} />}
            {hasResult && chart && tab === "expert" && <ExpertView chart={chart} mode={expertMode} onModeChange={setExpertMode} />}
            {isCalculating && !chart && <FeatureLoading />}
          </div>
        </section>
      </div>

      {historyOpen && <div className="history-popover">
        <header><div><span>LOCAL ARCHIVE · {history.length}/8</span><h2>本地档案</h2></div><button onClick={closeHistory} aria-label="关闭本地档案">×</button></header>
        <div className="history-backup-actions">
          <button onClick={exportBackup} disabled={!history.length && !observations.length}>备份全部</button>
          <button onClick={() => importInputRef.current?.click()}>恢复备份</button>
          <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} />
          <p>备份包含全部本地档案与观测记录；恢复时会按记录编号合并，不覆盖同编号数据。</p>
        </div>
        {history.length ? <>
          <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
            <button className="history-load" onClick={() => loadProfile(item)}><span><b>{item.name || "未命名"}</b><small>{item.date} · {item.timeKnown === false ? "时辰未知" : item.time} · {item.gender}命</small></span><Icon name="arrow" /></button>
            <button className={`history-delete ${pendingDeleteId === item.id ? "confirm" : ""}`} onClick={() => removeProfile(item.id)} aria-label={`${pendingDeleteId === item.id ? "确认删除" : "删除"}${item.name || "未命名档案"}`}>{pendingDeleteId === item.id ? "确认" : "删除"}</button>
          </div>)}</div>
          <div className="history-footer"><p>档案仅保存在当前浏览器，请定期备份。</p><button className={confirmClear ? "confirm" : ""} onClick={clearHistory}>{confirmClear ? "再次点击确认清空" : "清空全部"}</button></div>
        </> : <div className="empty-history"><Icon name="history" size={28} /><p>生成命盘后会自动保存在这里，也可以从备份恢复。</p></div>}
      </div>}
      {historyOpen && <button className="popover-backdrop" aria-label="关闭档案" onClick={closeHistory} />}
      {notice && <div className="toast" role="status" aria-live="polite"><Icon name="spark" size={15} />{notice}</div>}
      <footer className="site-footer"><span>{ALGORITHM_VERSION} · LOCAL-FIRST</span><p>观星台上无神通，只有历法与规则。所示皆传统之学，供文化研究与自我省察，不构成医疗、法律、财务或人生重大决策之依据。</p></footer>
    </main>
  );
}
