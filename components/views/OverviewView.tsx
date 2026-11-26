"use client";

import { useMemo } from "react";
import { buildChartReading, type ChartInsight } from "@/lib/insights";
import type { FateChart } from "@/lib/types";
import type { ObservationDraft, ObservationRecord } from "@/lib/observations";
import { PalaceCard, ElementBars } from "@/components/shared/chart-parts";
import { Icon } from "@/components/shared/Icon";
import { EvidenceCard, TimeUncertaintyNotice } from "@/components/shared/reading-parts";
import { GuidedReadingPanel } from "@/components/GuidedReadingPanel";
import { buildGuidedReport } from "@/lib/guided-reading";
import type { ExploreMode, ObservationIntent, ReadingDepth, Tab, ViewMode } from "@/components/types";

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

export function Overview({ chart, intent, records, readingDepth, onReadingDepthChange, onSaveInsight, onSaveGuidedObservation, onNavigate }: {
  chart: FateChart;
  intent: ObservationIntent;
  records: ObservationRecord[];
  readingDepth: ReadingDepth;
  onReadingDepthChange: (depth: ReadingDepth) => void;
  onSaveInsight: (insight: ChartInsight) => void;
  onSaveGuidedObservation: (draft: ObservationDraft) => void;
  onNavigate: (tab: Tab, mode?: ViewMode) => void;
}) {
  const lifePalace = chart.ziwei.palaces.find((p) => p.name === "命宫") ?? chart.ziwei.palaces[0];
  const majorStars = lifePalace.stars.filter((s) => s.type === "major").map((s) => s.name);
  const reading = useMemo(() => buildChartReading(chart), [chart]);
  // 导读融合三套推演，计算较重；只在命盘或视角变化时重算。
  const guidedReport = useMemo(() => buildGuidedReport(chart, intent), [chart, intent]);
  const sortedInsights = [...reading.insights].sort((a, b) => Number(a.index) - Number(b.index));
  const additionalInsights = sortedInsights.slice(3);
  const nextStep = intent === "timing"
    ? { eyebrow: "接下来", title: "把观察放进时间", detail: "查看当前大运、流年与未来六年的支持和变动信号。", tab: "explore" as Tab, mode: "timing" as ExploreMode }
    : intent === "relationship"
      ? { eyebrow: "接下来", title: "继续看关系结构", detail: "先理解自己的关系模式，再按需加入另一人的资料。", tab: "explore" as Tab, mode: "relationship" as ExploreMode }
      : { eyebrow: "接下来", title: "继续探索自己", detail: "展开全部观察，再决定哪些问题值得带回现实。", tab: "explore" as Tab, mode: "self" as ExploreMode };

  return (
    <div className="view-stack">
      <GuidedReadingPanel
        report={guidedReport}
        records={records}
        profileId={chart.profile.id}
        depth={readingDepth}
        onDepthChange={onReadingDepthChange}
        onExplore={(mode) => onNavigate("explore", mode)}
        onValidate={onSaveGuidedObservation}
        onOpenObservations={() => onNavigate("observations")}
      />

      <details className="chart-coordinates-panel">
        <summary><span>盘面坐标</span><b>查看出生档案、四柱与命宫骨架</b><small>专业信息按需展开</small></summary>
      <section className="hero-dashboard">
        <div className="identity-block">
          <span className="eyebrow">本命档案</span>
          <h2>{chart.profile.name || "未命名命盘"}</h2>
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
      </details>

      <section className="next-step-panel">
        <div><span>{nextStep.eyebrow}</span><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></div>
        <button onClick={() => onNavigate(nextStep.tab, nextStep.mode)}>继续观察 <Icon name="arrow" /></button>
      </section>

      {additionalInsights.length > 0 && <details className="additional-insights">
        <summary><span>更多盘面线索</span><b>展开其余 {additionalInsights.length} 条观察</b><small>不会重复上面的三条核心线索</small></summary>
        <section className="reading-panel">
          <div className="section-heading"><div><span>两盘参看 · 可留下问题</span><h2>补充观察</h2></div><span className="method-badge">规则推演 · 不作妄断</span></div>
          <div className="evidence-grid">{additionalInsights.map((insight) => <EvidenceCard key={insight.id} insight={insight} onNavigate={onNavigate} onSave={onSaveInsight} saved={records.some((record) => record.profileId === chart.profile.id && record.sourceId === insight.id)} />)}</div>
        </section>
      </details>}
    </div>
  );
}

export { UnknownTimeOverview };
