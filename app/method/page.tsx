import type { Metadata } from "next";
import Link from "next/link";
import { ALGORITHM_VERSION } from "@/lib/product";
import { METHOD_REFERENCES } from "@/lib/references";
import styles from "./method.module.css";

export const metadata: Metadata = {
  title: "方法与来源",
  description: "Cyberfate 的计算来源、传统文本依据、解释边界和科学验证状态。",
};

const GROUPS = [
  { id: "calculation" as const, index: "01", title: "计算坐标", intro: "回答日期、时间、四柱和盘面是怎样算出的。这里追求可复现，而不是把可复现误写成预测有效。" },
  { id: "tradition" as const, index: "02", title: "传统规则", intro: "回答术语和论法从哪里来。古籍与流派是文化来源，需要注明版本、口径和分歧。" },
  { id: "boundary" as const, index: "03", title: "证据边界", intro: "回答产品为何保持克制，以及未来引入 AI 或保存数据时必须遵守什么约束。" },
];

export default function MethodPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span>CYBERFATE · 方法账本</span>
        <h1>每一句话，属于哪一种证据</h1>
        <p>本页把“计算可复现”“传统文本有记载”和“现代科学已验证”分开。它们不是同一件事，也不应互相冒充。</p>
        <div><Link href="/">返回观星台</Link><b>{ALGORITHM_VERSION}</b></div>
      </header>

      <section className={styles.levels} aria-label="证据层级">
        <article><b>事实坐标</b><p>出生资料、历法转换、四柱、星曜和宫位等程序计算结果。</p></article>
        <article><b>传统解释</b><p>根据公开规则生成的文化性观察，需注明流派、条件与未纳入项。</p></article>
        <article><b>现实核对</b><p>用户自己的经历、反例和长期记录；它不会回流修改算法结论。</p></article>
      </section>

      {GROUPS.map((group) => (
        <section className={styles.group} key={group.id}>
          <header><span>{group.index}</span><div><h2>{group.title}</h2><p>{group.intro}</p></div></header>
          <div className={styles.sourceGrid}>
            {METHOD_REFERENCES.filter((item) => item.group === group.id).map((item) => (
              <article key={item.id} id={`source-${item.id}`}>
                <small>{item.publisher}</small>
                <h3>{item.title}</h3>
                <dl>
                  <div><dt>支持什么</dt><dd>{item.supports}</dd></div>
                  <div><dt>不能推出什么</dt><dd>{item.doesNotSupport}</dd></div>
                </dl>
                <a href={item.url} target="_blank" rel="noreferrer">查看原始来源 ↗</a>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.commitment}>
        <span>产品承诺</span>
        <h2>没有证据覆盖的问题，不用漂亮话补齐</h2>
        <ul>
          <li>算法只输出结构化盘面，表达层不能新增不存在的星曜、关系或年份事件。</li>
          <li>每条个性化观察至少能回到一项盘面依据，并同时展示另一种理解和当前边界。</li>
          <li>不以术数替代医疗、法律、投资、招聘、婚育或其他高影响决定。</li>
          <li>出生资料与观测记录默认留在当前浏览器，导出文件由用户自行保管。</li>
        </ul>
        <div><Link href="/terms">查看术语词典</Link><Link href="/">生成我的观察</Link></div>
      </section>
    </main>
  );
}
