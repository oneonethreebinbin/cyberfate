import { FORTUNE_STATE_META, buildFortuneReport, type FortuneState } from "@/lib/fortune";
import type { FateChart } from "@/lib/types";
import { TerminologyPanel } from "@/components/TerminologyPanel";

const STATE_ORDER: FortuneState[] = ["favorable", "caution", "change", "limited", "mixed", "quiet"];

function ScoreStrip({ scores }: { scores: { support: number; pressure: number; movement: number; depletion: number } }) {
  return (
    <div className="fortune-score-strip" aria-label="规则信号计数">
      <span><small>助势</small><b>{scores.support}</b></span>
      <span><small>制约</small><b>{scores.pressure}</b></span>
      <span><small>动象</small><b>{scores.movement}</b></span>
      <span><small>耗势</small><b>{scores.depletion}</b></span>
    </div>
  );
}

export function FortuneView({ chart }: { chart: FateChart }) {
  const report = buildFortuneReport(chart);
  const currentMeta = FORTUNE_STATE_META[report.current.state];

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
