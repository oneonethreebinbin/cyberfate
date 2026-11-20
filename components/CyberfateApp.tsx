"use client";

import { useEffect, useMemo, useState } from "react";
import { correctSolarTime, createFateChart, getTimeBranch } from "@/lib/engines";
import type { BirthProfile, FateChart, Gender, ZiweiPalace } from "@/lib/types";
import { RelationshipView } from "@/components/RelationshipView";
import { DateTimeField } from "@/components/DateTimeField";

type Tab = "overview" | "relationship" | "ziwei" | "bazi" | "modules";

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
  { id: "overview", label: "总览", hint: "双盘摘要" },
  { id: "relationship", label: "姻缘", hint: "单人 · 合盘" },
  { id: "ziwei", label: "紫微", hint: "十二宫盘" },
  { id: "bazi", label: "八字", hint: "四柱结构" },
  { id: "modules", label: "术数台", hint: "引擎路线" },
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

function PalaceCard({ palace, compact = false }: { palace: ZiweiPalace; compact?: boolean }) {
  const major = palace.stars.filter((star) => star.type === "major");
  const minor = palace.stars.filter((star) => star.type === "minor").slice(0, 4);
  return (
    <article className={`palace-card ${compact ? "compact" : ""}`} data-index={palace.index}>
      <header>
        <div>
          <span className="palace-ganzhi">{palace.ganZhi}</span>
          <strong>{palace.name}</strong>
        </div>
        <div className="palace-flags">
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
          <div><i style={{ width: `${Math.max(7, count * 25)}%`, background: ELEMENT_COLORS[element] }} /></div>
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

function Overview({ chart, onNavigate }: { chart: FateChart; onNavigate: (tab: Tab) => void }) {
  const lifePalace = chart.ziwei.palaces.find((p) => p.name === "命宫") ?? chart.ziwei.palaces[0];
  const majorStars = lifePalace.stars.filter((s) => s.type === "major").map((s) => s.name);
  const strongest = Object.entries(chart.bazi.elementCounts).sort((a, b) => b[1] - a[1])[0];
  const weakest = Object.entries(chart.bazi.elementCounts).sort((a, b) => a[1] - b[1])[0];

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

      <section className="panel reading-panel">
        <div className="section-heading">
          <div><span>两盘参看</span><h2>结构观察</h2></div>
          <span className="method-badge">规则生成 · 非 AI</span>
        </div>
        <div className="reading-grid">
          <article><b>壹</b><div><h3>日主锚点</h3><p>日主为{chart.bazi.dayMaster}。四柱是观察时序与五行关系的坐标，不直接等同于性格定论。</p></div></article>
          <article><b>贰</b><div><h3>五行分布</h3><p>盘面计数中{strongest[0]}较显（{strongest[1]}），{weakest[0]}较少（{weakest[1]}）。这是基础数量统计，强弱仍需结合月令与根气。</p></div></article>
          <article><b>叁</b><div><h3>紫微命宫</h3><p>命宫落{lifePalace.ganZhi}，主星{majorStars.length ? majorStars.join("、") : "为空宫，需借对宫综合观察"}。完整判断应连同三方四正。</p></div></article>
        </div>
      </section>
    </div>
  );
}

function ZiweiView({ chart }: { chart: FateChart }) {
  return (
    <div className="view-stack">
      <section className="page-intro">
        <div><span className="eyebrow">本命 · 十二宫</span><h1>紫微十二宫</h1><p>本命盘 · {chart.ziwei.lunarDate} · {chart.ziwei.timeRange}</p></div>
        <div className="legend"><span><i className="major-dot" />主星</span><span><i className="body-dot" />身宫</span><span><i className="cause-dot" />来因宫</span></div>
      </section>
      <section className="astrolabe-shell">
        <div className="astrolabe-grid">
          {chart.ziwei.palaces.map((palace) => <PalaceCard key={`${palace.name}-${palace.index}`} palace={palace} />)}
          <div className="chart-center">
            <span>本命盘</span>
            <h2>{chart.profile.name || "本命盘"}</h2>
            <div><b>{chart.ziwei.soul}</b><small>命主</small><i /><b>{chart.ziwei.body}</b><small>身主</small></div>
            <p>{chart.ziwei.fiveElementsClass}</p>
            <small>{chart.correctedDateTime}</small>
          </div>
        </div>
      </section>
      <p className="source-note"><Icon name="info" size={15} /> 星曜与宫位由 iztro 开源算法生成。当前展示本命盘；大限、流年和流月接口已由底层库支持，将在时间线模块开放。</p>
    </div>
  );
}

function BaziView({ chart }: { chart: FateChart }) {
  return (
    <div className="view-stack">
      <section className="page-intro">
        <div><span className="eyebrow">子平 · 四柱</span><h1>子平四柱</h1><p>{chart.bazi.lunarText} · 日主 {chart.bazi.dayMaster}</p></div>
        <div className="bazi-stamp"><span>八</span><span>字</span></div>
      </section>
      <section className="panel bazi-detail"><BaziTable chart={chart} /></section>
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
      <p className="source-note"><Icon name="info" size={15} /> 四柱按节气定月，晚子时采用 sect 2 规则；数据由 lunar-javascript 计算。命理解读仅供文化研究与自我观察。</p>
    </div>
  );
}

const MODULES = [
  { key: "ZW", title: "紫微斗数", desc: "本命十二宫、主辅杂曜、命身主、五行局", status: "可用", live: true },
  { key: "BZ", title: "子平八字", desc: "四柱、藏干、十神、纳音、十二长生", status: "可用", live: true },
  { key: "YL", title: "运限时间线", desc: "大限、流年、流月的统一时间轴", status: "下一阶段", live: false },
  { key: "LY", title: "六爻纳甲", desc: "起卦、装卦、六亲世应与动变爻", status: "规划中", live: false },
  { key: "QM", title: "奇门遁甲", desc: "阴阳遁、九宫、八门九星八神", status: "规划中", live: false },
  { key: "FS", title: "风水罗盘", desc: "八宅、坐向、二十四山与空间标注", status: "研究中", live: false },
];

function ModulesView() {
  return (
    <div className="view-stack">
      <section className="page-intro"><div><span className="eyebrow">术数引擎</span><h1>术数工作台</h1><p>共享一份出生档案，各引擎独立计算、标注版本、可追溯来源。</p></div></section>
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
        <p>排盘层只负责可复现的历法与术数计算；解读层必须说明规则来源或 AI 模型。未完成的模块不会生成随机结论。</p>
      </section>
    </div>
  );
}

export function CyberfateApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<BirthProfile>(DEFAULT_PROFILE);
  const [chart, setChart] = useState<FateChart>(() => createFateChart(DEFAULT_PROFILE));
  const [history, setHistory] = useState<BirthProfile[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("cyberfate-history") ?? "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  const timeBranch = useMemo(() => getTimeBranch(profile.time), [profile.time]);
  const previewCorrection = useMemo(() => correctSolarTime(profile).detail, [profile]);

  function updateProfile<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function generate() {
    try {
      const next: BirthProfile = { ...profile, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      const result = createFateChart(next);
      setChart(result);
      setProfile(next);
      const records = [next, ...history.filter((item) => !(item.date === next.date && item.time === next.time && item.gender === next.gender))].slice(0, 8);
      setHistory(records);
      localStorage.setItem("cyberfate-history", JSON.stringify(records));
      setTab("overview");
      setNotice("命盘已按当前参数重新生成");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "排盘失败，请检查输入");
    }
  }

  function loadProfile(item: BirthProfile) {
    setProfile(item);
    setChart(createFateChart(item));
    setHistoryOpen(false);
    setTab("overview");
  }

  function exportChart() {
    const blob = new Blob([JSON.stringify(chart, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cyberfate-${chart.profile.name || chart.profile.date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("overview")} aria-label="返回总览">
          <span className="brand-mark"><i /><b>命</b></span>
          <span><strong>CYBERFATE</strong><small>数字命理观星台</small></span>
        </button>
        <div className="top-actions">
          <button onClick={() => setHistoryOpen((value) => !value)}><Icon name="history" />档案</button>
          <button onClick={exportChart}><Icon name="download" />导出</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-rail">
          <div className="rail-heading"><span>排盘资料</span><h2>出生坐标</h2><p>所有计算仅在当前浏览器完成。</p></div>
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
            <small>{timeBranch}时 · 基准东经 120°</small>
          </div>
          <button className="generate-button" onClick={generate}><Icon name="spark" /><span>生成综合命盘<small>按校正时间排盘</small></span><Icon name="arrow" /></button>
          <p className="privacy-note"><Icon name="compass" size={15} /> 本地计算，不上传出生资料</p>
        </aside>

        <section className="content-stage">
          <nav className="tabbar" aria-label="命盘视图">
            {TAB_ITEMS.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}
          </nav>
          <div className="view-container">
            {tab === "overview" && <Overview chart={chart} onNavigate={setTab} />}
            {tab === "relationship" && <RelationshipView chart={chart} />}
            {tab === "ziwei" && <ZiweiView chart={chart} />}
            {tab === "bazi" && <BaziView chart={chart} />}
            {tab === "modules" && <ModulesView />}
          </div>
        </section>
      </div>

      {historyOpen && <div className="history-popover">
        <header><div><span>LOCAL ARCHIVE</span><h2>本地档案</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></header>
        {history.length ? <div className="history-list">{history.map((item) => <button key={item.id} onClick={() => loadProfile(item)}><span><b>{item.name || "未命名"}</b><small>{item.date} · {item.time} · {item.gender}命</small></span><Icon name="arrow" /></button>)}</div> : <div className="empty-history"><Icon name="history" size={28} /><p>生成命盘后会自动保存在此浏览器。</p></div>}
      </div>}
      {historyOpen && <button className="popover-backdrop" aria-label="关闭档案" onClick={() => setHistoryOpen(false)} />}
      {notice && <div className="toast"><Icon name="spark" size={15} />{notice}</div>}
      <footer className="site-footer"><span>CYBERFATE MVP · OPEN ALGORITHMS</span><p>命理结果仅供传统文化研究与娱乐，不构成医疗、法律、财务或人生决策建议。</p></footer>
    </main>
  );
}
