import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY, type GlossaryScope } from "@/lib/glossary";
import { ALGORITHM_VERSION } from "@/lib/product";

export const metadata: Metadata = {
  title: "术语词典",
  description: "八字、紫微斗数与关系合盘的核心术语释义：日主、月令、十神、命宫、身宫、四化、夫妻宫、桃花、合盘等，含每条术语的使用边界说明。",
};

const SCOPES: Array<{ id: GlossaryScope; title: string; intro: string }> = [
  { id: "bazi", title: "子平八字", intro: "以日主为参照、月令为时令背景的四柱体系。以下为四柱页面中随文出现的术语。" },
  { id: "ziwei", title: "紫微斗数", intro: "以十二宫与星曜落宫为骨架的传统体系。以下为紫微页面中随文出现的术语。" },
  { id: "relationship", title: "关系与合盘", intro: "姻缘结构、双人比较中涉及的术语。合盘只并列结构，不打分。" },
  { id: "fortune", title: "时运六象", intro: "流年取象使用的时间与结构语言。" },
];

export default function TermsPage() {
  return (
    <main className="terms-page">
      <header className="terms-hero">
        <span className="eyebrow">CYBERFATE · 术语词典</span>
        <h1>术语词典</h1>
        <p>本词典收录应用内出现的八字、紫微与关系术语，每条均附使用边界。术语是观察坐标，不是结论；命理解读仅供文化研究与自我省察。</p>
        <div className="terms-hero-actions">
          <Link href="/">进入观星台</Link>
          <span>{ALGORITHM_VERSION}</span>
        </div>
      </header>
      {SCOPES.map((scope) => (
        <section key={scope.id} className="terms-section" aria-labelledby={`terms-${scope.id}`}>
          <h2 id={`terms-${scope.id}`}>{scope.title}</h2>
          <p className="terms-intro">{scope.intro}</p>
          <div className="terms-grid">
            {GLOSSARY[scope.id].map((entry) => (
              <article key={entry.term} className="terms-card">
                <h3>{entry.term}</h3>
                <p>{entry.detail}</p>
                <small><b>使用边界</b>{entry.caution}</small>
              </article>
            ))}
          </div>
        </section>
      ))}
      <footer className="terms-footer">
        <p>所有排盘与解读均在浏览器内本地完成，生辰资料不会上传。术语释义为传统规则的现代转述，不代表科学预测效力。</p>
        <Link href="/">返回观星台</Link>
      </footer>
    </main>
  );
}
