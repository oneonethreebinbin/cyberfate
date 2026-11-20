"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { correctSolarTime, createFateChart, getTimeBranch } from "@/lib/engines";
import { getFlowStartYear } from "@/lib/fortune";
import { buildChartReading, flyPalaceTransformations, getDayBranchRelations, getZiweiPeriods, type ChartInsight } from "@/lib/insights";
import type { BirthProfile, FateChart, Gender, ZiweiPalace } from "@/lib/types";
import { RelationshipView } from "@/components/RelationshipView";
import { DateTimeField } from "@/components/DateTimeField";
import { TerminologyPanel } from "@/components/TerminologyPanel";
import { FortuneView } from "@/components/FortuneView";

type Tab = "overview" | "fortune" | "relationship" | "ziwei" | "bazi" | "modules";

const DEFAULT_PROFILE: BirthProfile = {
  id: "sample",
  name: "示例命盘",
  date: "1990-01-27",
  time: "08:30",
  gender: "男",
  longitude: 116.4,
  useTrueSolarTime: true,
  createdAt: new Date().toISOString(),
};

const TAB_ITEMS: { id: Tab; label: string; hint: string }[] = [
  { id: "overview", label: "总览", hint: "两盘合参" },
  { id: "fortune", label: "时运", hint: "流年取象" },
  { id: "relationship", label: "姻缘", hint: "一己 · 二人" },
  { id: "ziwei", label: "紫微", hint: "十二宫盘" },
  { id: "bazi", label: "八字", hint: "四柱结构" },
  { id: "modules", label: "术数", hint: "诸法门径" },
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

function EvidenceCard({ insight, onNavigate }: { insight: ChartInsight; onNavigate?: (tab: Tab) => void }) {
  const destination: Tab = insight.id === "life-body-axis" || insight.id === "mutagen-paths" ? "ziwei" : "bazi";
  return (
    <article className={`evidence-card ${insight.tone}`}>
      <header><span>{insight.index}</span><small>{insight.label}</small></header>
      <h3>{insight.title}</h3>
      <p>{insight.summary}</p>
      <details>
        <summary><span>查看判断依据与边界</span><i /></summary>
        <div className="evidence-detail">
          <section><b>盘面依据</b><ul>{insight.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><b>另一种理解</b><p>{insight.alternative}</p></section>
          <section className="evidence-limit"><b>当前未纳入</b><p>{insight.limits}</p></section>
          {onNavigate && <button onClick={() => onNavigate(destination)}>前往{destination === "ziwei" ? "紫微十二宫" : "八字四柱"}<Icon name="arrow" size={14} /></button>}
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

function Overview({ chart, onNavigate }: { chart: FateChart; onNavigate: (tab: Tab) => void }) {
  const lifePalace = chart.ziwei.palaces.find((p) => p.name === "命宫") ?? chart.ziwei.palaces[0];
  const majorStars = lifePalace.stars.filter((s) => s.type === "major").map((s) => s.name);
  const reading = buildChartReading(chart);

  return (
    <div className="view-stack">
      <section className="hero-dashboard">
        <div className="identity-block">
          <span className="eyebrow">本命档案</span>
          <h1>{chart.profile.name || "未命名命盘"}</h1>
          <p>{chart.ziwei.chineseDate} · {chart.ziwei.time} · {chart.profile.gender}命</p>
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
            <button onClick={() => onNavigate("bazi")}>展开八字 <Icon name="arrow" size={15} /></button>
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
            <button onClick={() => onNavigate("ziwei")}>查看十二宫 <Icon name="arrow" size={15} /></button>
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

      <section className="reading-panel">
        <div className="section-heading">
          <div><span>两盘参看 · 可展开证据</span><h2>四处先观</h2></div>
          <span className="method-badge">规则推演 · 不作妄断</span>
        </div>
        <div className="evidence-grid">
          {[...reading.insights].sort((a, b) => Number(a.index) - Number(b.index)).map((insight) => <EvidenceCard key={insight.id} insight={insight} onNavigate={onNavigate} />)}
        </div>
      </section>
    </div>
  );
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
  const startYearSafe = getFlowStartYear();
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

const MODULES = [
  { key: "ZW", title: "紫微斗数", desc: "本命十二宫、主辅杂曜、命身主、五行局", status: "可用", live: true },
  { key: "BZ", title: "子平八字", desc: "四柱、藏干、十神、纳音、十二长生", status: "可用", live: true },
  { key: "YL", title: "时运六象", desc: "流年干支、日主生克、日支合冲与六象取义", status: "基础可用", live: true },
  { key: "LY", title: "六爻纳甲", desc: "起卦、装卦、六亲世应与动变爻", status: "规划中", live: false },
  { key: "QM", title: "奇门遁甲", desc: "阴阳遁、九宫、八门九星八神", status: "规划中", live: false },
  { key: "FS", title: "风水罗盘", desc: "八宅、坐向、二十四山与空间标注", status: "研究中", live: false },
];

function ModulesView() {
  return (
    <div className="view-stack">
      <section className="page-intro"><div><span className="eyebrow">术数引擎</span><h1>术数工作台</h1><p>一册生辰，诸法同参；各引擎独立推演，注明出处，可溯可查。</p></div></section>
      <section className="module-grid">
        {MODULES.map((module, index) => (
          <article className={module.live ? "live" : ""} data-key={module.key} key={module.key}>
            <header><span>{module.key}</span><small>{String(index + 1).padStart(2, "0")}</small></header>
            <h2>{module.title}</h2><p>{module.desc}</p>
            <footer><i />{module.status}</footer>
          </article>
        ))}
      </section>
      <section className="panel roadmap">
        <span>引擎原则</span>
        <h2>算法与解读分离</h2>
        <p>排盘只作可复现的历法推步；解读必注明规则所出。未成之法，不生臆断。</p>
      </section>
    </div>
  );
}

export function CyberfateApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [profile, setProfile] = useState<BirthProfile>(DEFAULT_PROFILE);
  const [chart, setChart] = useState<FateChart>(() => createFateChart(DEFAULT_PROFILE));
  const [history, setHistory] = useState<BirthProfile[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("cyberfate-history") ?? "[]"));
    } catch {
      setHistory([]);
    }
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

  const timeBranch = useMemo(() => getTimeBranch(profile.time), [profile.time]);
  const preview = useMemo(() => correctSolarTime(profile), [profile]);
  const previewCorrection = preview.detail;
  const previewBranch = useMemo(() => getTimeBranch(`${preview.date.getHours()}:00`), [preview]);

  function updateProfile<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function navigateToTab(nextTab: Tab) {
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const stage = document.querySelector<HTMLElement>(".content-stage");
      const topbar = document.querySelector<HTMLElement>(".topbar");
      if (stage) {
        const top = stage.getBoundingClientRect().top + window.scrollY - (topbar?.offsetHeight ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      }
    });
  }

  function generate() {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.date) || !/^\d{2}:\d{2}$/.test(profile.time)) {
        throw new Error("请填写完整的出生日期和时间");
      }
      if (!Number.isFinite(profile.longitude) || profile.longitude < 73 || profile.longitude > 135) {
        throw new Error("出生地经度请输入 73°–135° 之间的数值");
      }
      const next: BirthProfile = { ...profile, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      const result = createFateChart(next);
      setChart(result);
      setProfile(next);
      const records = [next, ...history.filter((item) => !(item.date === next.date && item.time === next.time && item.gender === next.gender))].slice(0, 8);
      setHistory(records);
      localStorage.setItem("cyberfate-history", JSON.stringify(records));
      navigateToTab("overview");
      setMobileControlsOpen(false);
      flashNotice("命盘已依新参数重排", 2600);
    } catch (error) {
      holdNotice(error instanceof Error ? error.message : "起盘未成，请复核生辰经度");
    }
  }

  function loadProfile(item: BirthProfile) {
    setProfile(item);
    setChart(createFateChart(item));
    setHistoryOpen(false);
    setPendingDeleteId(null);
    setConfirmClear(false);
    navigateToTab("overview");
    setMobileControlsOpen(false);
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
    localStorage.setItem("cyberfate-history", JSON.stringify(records));
    setPendingDeleteId(null);
    flashNotice("此档已除名", 2200);
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
    flashNotice("满架档案，俱已清空", 2200);
  }

  function exportChart() {
    const blob = new Blob([JSON.stringify(chart, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cyberfate-${chart.profile.name || chart.profile.date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    flashNotice("命盘已录为文书，生辰资料请善自收存", 2800);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigateToTab("overview")} aria-label="返回总览">
          <span className="brand-mark"><i /><b>命</b></span>
          <span><strong>CYBERFATE</strong><small>数字命理观星台</small></span>
        </button>
        <div className="top-actions">
          <button onClick={() => historyOpen ? closeHistory() : setHistoryOpen(true)}><Icon name="history" />档案</button>
          <button onClick={exportChart}><Icon name="download" />导出</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-rail">
          <button className="mobile-rail-toggle" aria-expanded={mobileControlsOpen} aria-controls="birth-controls" onClick={() => setMobileControlsOpen((value) => !value)}>
            <span><small>当前档案</small><strong>{chart.profile.name || "未命名命盘"}</strong><em>{chart.profile.date} · {chart.profile.time}</em></span>
            <b>{mobileControlsOpen ? "收起资料" : "修改资料"}</b>
          </button>
          <div className={`rail-body ${mobileControlsOpen ? "mobile-open" : ""}`} id="birth-controls">
            <div className="rail-heading"><span>起盘资料</span><h2>生辰坐标</h2><p>生辰只在阁下浏览器中推演，不赴云端。</p></div>
            <div className="form-stack">
              <label><span>档案名称</span><input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} placeholder="例如：我的命盘" /></label>
              <div className="field-pair">
                <DateTimeField label="公历日期" type="date" value={profile.date} onChange={(value) => updateProfile("date", value)} />
                <DateTimeField label="出生时间" type="time" value={profile.time} onChange={(value) => updateProfile("time", value)} />
              </div>
              <fieldset><legend>性别</legend><div className="segmented">{(["男", "女"] as Gender[]).map((gender) => <button type="button" className={profile.gender === gender ? "active" : ""} key={gender} onClick={() => updateProfile("gender", gender)}>{gender}命</button>)}</div></fieldset>
              <label><span>出生地经度 <small>东经</small></span><div className="longitude-input"><input type="number" min="73" max="135" step="0.1" value={profile.longitude} onChange={(event) => updateProfile("longitude", Number(event.target.value))} /><b>°</b></div></label>
              <label className="toggle-row"><span><b>真太阳时校正</b><small>经度差 + 均时差</small></span><input type="checkbox" checked={profile.useTrueSolarTime} onChange={(event) => updateProfile("useTrueSolarTime", event.target.checked)} /><i /></label>
            </div>
            <div className="correction-readout">
              <span>校正预览</span><b>{profile.useTrueSolarTime ? `${previewCorrection.minutes >= 0 ? "+" : ""}${previewCorrection.minutes} min` : "OFF"}</b>
              <small>{profile.useTrueSolarTime ? `校正后 ${previewBranch}时` : `${timeBranch}时`} · 基准东经 120°{previewCorrection.dstMinutes !== 0 ? ` · 夏令时还原 ${previewCorrection.dstMinutes} min` : ""}</small>
            </div>
            <button className="generate-button" onClick={generate}><Icon name="spark" /><span>落盘起例<small>依真太阳时校正起盘</small></span><Icon name="arrow" /></button>
            <p className="privacy-note"><Icon name="compass" size={15} /> 闭门起盘，生辰不出此机</p>
          </div>
        </aside>

        <section className="content-stage">
          <nav className="tabbar" aria-label="命盘视图">
            {TAB_ITEMS.map((item) => <button role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => navigateToTab(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}
          </nav>
          <div className="view-container">
            {tab === "overview" && <Overview chart={chart} onNavigate={navigateToTab} />}
            {tab === "fortune" && <FortuneView chart={chart} />}
            {tab === "relationship" && <RelationshipView chart={chart} />}
            {tab === "ziwei" && <ZiweiView chart={chart} />}
            {tab === "bazi" && <BaziView chart={chart} />}
            {tab === "modules" && <ModulesView />}
          </div>
        </section>
      </div>

      {historyOpen && <div className="history-popover">
        <header><div><span>LOCAL ARCHIVE · {history.length}/8</span><h2>本地档案</h2></div><button onClick={closeHistory} aria-label="关闭本地档案">×</button></header>
        {history.length ? <>
          <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
            <button className="history-load" onClick={() => loadProfile(item)}><span><b>{item.name || "未命名"}</b><small>{item.date} · {item.time} · {item.gender}命</small></span><Icon name="arrow" /></button>
            <button className={`history-delete ${pendingDeleteId === item.id ? "confirm" : ""}`} onClick={() => removeProfile(item.id)} aria-label={`${pendingDeleteId === item.id ? "确认删除" : "删除"}${item.name || "未命名档案"}`}>{pendingDeleteId === item.id ? "确认" : "删除"}</button>
          </div>)}</div>
          <div className="history-footer"><p>档案只存于此机，随取随用。</p><button className={confirmClear ? "confirm" : ""} onClick={clearHistory}>{confirmClear ? "再次点击，方作数" : "清空全部"}</button></div>
        </> : <div className="empty-history"><Icon name="history" size={28} /><p>落盘之后，档案自动收于此间。</p></div>}
      </div>}
      {historyOpen && <button className="popover-backdrop" aria-label="关闭档案" onClick={closeHistory} />}
      {notice && <div className="toast" role="status" aria-live="polite"><Icon name="spark" size={15} />{notice}</div>}
      <footer className="site-footer"><span>CYBERFATE V1.0 · LOCAL-FIRST</span><p>观星台上无神通，只有历法与规则。所示皆传统之学，供文化研究与自我省察，不构成医疗、法律、财务或人生重大决策之依据。</p></footer>
    </main>
  );
}
