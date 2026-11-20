import { GLOSSARY, type GlossaryScope } from "@/lib/glossary";

const TITLES: Record<GlossaryScope, { eyebrow: string; title: string; intro: string }> = {
  bazi: { eyebrow: "阅读辅助 · 子平", title: "先识这些名目", intro: "术语用来定位盘面，不为贴标签；点开一词，便见其义与边界。" },
  ziwei: { eyebrow: "阅读辅助 · 紫微", title: "十二宫术语小注", intro: "先识宫位之网，再读星曜之性；莫执一宫，便断一生。" },
  relationship: { eyebrow: "阅读辅助 · 关系", title: "关系分析在说什么", intro: "此处术语只述盘面之则，条条还须回到真实相处中印证。" },
  fortune: { eyebrow: "阅读辅助 · 时运", title: "时、位、势、象", intro: "六象由规则组合而来，非命运之六等；先明其义，再逐年看依据。" },
};

export function TerminologyPanel({ scope }: { scope: GlossaryScope }) {
  const heading = TITLES[scope];

  return (
    <section className="terminology-panel">
      <header>
        <div><span>{heading.eyebrow}</span><h2>{heading.title}</h2></div>
        <p>{heading.intro}</p>
      </header>
      <div className="terminology-grid">
        {GLOSSARY[scope].map((entry) => (
          <details key={entry.term}>
            <summary><span>{entry.term}</span><small>{entry.short}</small><i aria-hidden="true" /></summary>
            <div><p>{entry.detail}</p><em><b>使用边界</b>{entry.caution}</em></div>
          </details>
        ))}
      </div>
    </section>
  );
}
