import { FORTUNE_STATE_META, buildFortuneReport, type FortuneState } from "@/lib/fortune";
import { analyzeDaily, DAILY_STATE_META } from "@/lib/daily";
import { buildFortuneCalendar } from "@/lib/calendar-export";
import { trackLocalEvent } from "@/lib/product";
import type { FateChart } from "@/lib/types";
import { TerminologyPanel } from "@/components/TerminologyPanel";
import { ScoreStrip } from "@/components/shared/reading-parts";
import { FortuneCalendar } from "@/components/FortuneCalendar";

const STATE_ORDER: FortuneState[] = ["favorable", "caution", "change", "limited", "mixed", "quiet"];

export function FortuneView({ chart, savedSourceIds = [], onSaveObservation }: {
  chart: FateChart;
  savedSourceIds?: string[];
  onSaveObservation?: (sourceId: string, title: string, question: string, observedOn: string) => void;
}) {
  const report = buildFortuneReport(chart);
  const currentMeta = FORTUNE_STATE_META[report.current.state];
  const daily = analyzeDaily(chart);
  const dailyMeta = DAILY_STATE_META[daily.state];
  const dailySourceId = `daily-${daily.date}`;
  const dailySaved = savedSourceIds.includes(dailySourceId);

  function exportCalendar() {
    try {
      const calendar = buildFortuneCalendar(chart);
      const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cyberfate-fortune-${chart.profile.name || chart.profile.date}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      trackLocalEvent("fortune_calendar_exported");
    } catch {
      trackLocalEvent("fortune_calendar_export_failed");
    }
  }

  return (
    <div className="view-stack fortune-view">
      <section className="page-intro fortune-intro">
        <div><span className="eyebrow">易理 · 流年取象</span><h1>时运六象</h1><p>以时、位、势、象四字，观未来六年流年之气数。</p></div>
        <div className="fortune-coordinate">
          <small>本命坐标</small><b>{report.dayMaster}</b><i />
          <small>日支</small><b>{report.dayBranch}</b><i />
          <small>旺衰</small><b>{report.strength.verdict}</b>
          {report.currentDaYun && <><i /><small>现行大运</small><b>{report.currentDaYun.ganZhi}</b></>}
        </div>
        <div className="fortune-calendar-export">
          <button onClick={exportCalendar} title="导出未来六个流年、十二个流月与六十个流日的全天事件">导出运势日历 <small>日 · 月 · 年 三层取象</small></button>
          <p>生成 .ics 文件，可导入手机或电脑日历逐日查看；不含生辰与姓名。</p>
        </div>
      </section>

      <section className={`fortune-hero state-${report.current.state}`}>
        <div className="fortune-orbit" aria-hidden="true">
          <i /><i /><span>{report.current.ganZhi}</span><b>{currentMeta.seal}</b><small>{report.current.year}</small>
        </div>
        <div className="fortune-current-copy">
          <span>今岁取象 · {report.current.year} {report.current.ganZhi}</span>
          <h2>{currentMeta.label}</h2>
          <p className="fortune-subtitle">{currentMeta.subtitle}</p>
          <p>{currentMeta.explanation}</p>
          <ScoreStrip scores={report.current.scores} />
        </div>
        <div className="fortune-current-evidence">
          <span>取象依据</span>
          <ul>{report.current.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          <p><b>反向提醒</b>{report.current.counterpoint}</p>
        </div>
      </section>

      <section className={`fortune-hero state-${daily.state} fortune-daily`}>
        <div className="fortune-orbit" aria-hidden="true">
          <i /><i /><span>{daily.ganZhi}</span><b>{dailyMeta.seal}</b><small>今日</small>
        </div>
        <div className="fortune-current-copy">
          <span>流日观察 · {daily.date} {daily.ganZhi}</span>
          <h2>{dailyMeta.label}</h2>
          <p className="fortune-subtitle">{dailyMeta.subtitle}</p>
          <p>{dailyMeta.explanation}</p>
          <ScoreStrip scores={daily.scores} />
        </div>
        <div className="fortune-current-evidence">
          <span>取象依据</span>
          <ul>{daily.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          <p><b>反向提醒</b>{daily.counterpoint}</p>
          <p className="fortune-daily-fine">流日只观当日表层信号，未纳入流时与当日真太阳时修正；一日之象不足以定事，宜与流年、大运同参。</p>
          {onSaveObservation && <button className={dailySaved ? "fortune-save saved" : "fortune-save"} disabled={dailySaved} onClick={() => onSaveObservation(dailySourceId, `流日 ${daily.ganZhi} · ${dailyMeta.label}`, daily.observation, daily.date)}>{dailySaved ? "已加入观测簿" : "记下今日"}</button>}
        </div>
      </section>

      <FortuneCalendar chart={chart} savedSourceIds={savedSourceIds} onSaveObservation={onSaveObservation} />

      <section className="fortune-method">
        <div><span>本次已观</span><p>{report.included.map((item) => <b key={item}>{item}</b>)}</p></div>
        <div><span>尚待纳入</span><p>{report.missing.map((item) => <b key={item}>{item}</b>)}</p></div>
        <aside><strong>六象不是吉凶等级</strong><p>「动」不为凶，「静」亦不为吉。六象只述规则信号之组合，不预断人间之事。</p></aside>
      </section>

      <section className="fortune-section">
        <header className="fortune-heading"><div><span>六年流转 · 逐年可展开</span><h2>岁序观象</h2></div><p>自立春为界的当前流年起，顺看六年岁运</p></header>
        <div className="fortune-year-grid">
          {report.years.map((item) => {
            const meta = FORTUNE_STATE_META[item.state];
            const sourceId = `fortune-${item.year}`;
            const saved = savedSourceIds.includes(sourceId);
            return (
              <article className={`fortune-year-card state-${item.state}`} key={item.year}>
                <header><span>{item.year}</span><b>{item.ganZhi}</b><i>{meta.seal}</i></header>
                <h3>{meta.label}</h3><p>{meta.subtitle}</p>
                <ScoreStrip scores={item.scores} />
                <details>
                  <summary><span>查看取象依据</span><i aria-hidden="true" /></summary>
                  <div>
                    <section><b>盘面信号</b><ul>{item.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></section>
                    <section><b>反向提醒</b><p>{item.counterpoint}</p></section>
                    <section className="fortune-observation"><b>现实观测</b><p>{item.observation}</p></section>
                  </div>
                </details>
                {onSaveObservation && <button className={saved ? "fortune-save saved" : "fortune-save"} disabled={saved} onClick={() => onSaveObservation(sourceId, `${item.year} ${item.ganZhi} · ${meta.label}`, item.observation, `${item.year}-01-01`)}>{saved ? "已加入观测簿" : "留下这一年"}</button>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="fortune-six-states">
        <header><span>六象释义</span><h2>不以一字定祸福</h2><p>六象各留余地：既指可行之途，也留核对之尺。</p></header>
        <div>{STATE_ORDER.map((state) => {
          const meta = FORTUNE_STATE_META[state];
          return <article className={`state-${state}`} key={state}><i>{meta.seal}</i><span><b>{meta.label}</b><small>{meta.subtitle}</small></span></article>;
        })}</div>
      </section>

      <TerminologyPanel scope="fortune" />
      <p className="source-note fortune-disclaimer">六象乃古法结构之推演，未经验科之证；大事之决，还凭诸君自断，莫以此代医、代讼、代筹。</p>
    </div>
  );
}
