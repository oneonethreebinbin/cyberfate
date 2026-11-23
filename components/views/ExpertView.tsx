"use client";

import { getDayBranchRelations, flyPalaceTransformations, getZiweiPeriods } from "@/lib/insights";
import type { FateChart } from "@/lib/types";
import { Icon } from "@/components/shared/Icon";
import { ElementBars, BaziTable, BaziMobileCards, PalaceCard } from "@/components/shared/chart-parts";
import { ReadingGuide, ZiweiMobileBrowser } from "@/components/shared/reading-parts";
import { TerminologyPanel } from "@/components/TerminologyPanel";
import { ALGORITHM_VERSION } from "@/lib/product";
import { handleTabArrow, type ExpertMode } from "@/components/types";

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

export function ExpertView({ chart, mode, onModeChange }: { chart: FateChart; mode: ExpertMode; onModeChange: (mode: ExpertMode) => void }) {
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
