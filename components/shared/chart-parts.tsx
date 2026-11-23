import type { FateChart, ZiweiPalace } from "@/lib/types";

const ELEMENT_COLORS: Record<string, string> = {
  木: "#64b28b",
  火: "#d7674d",
  土: "#b69b63",
  金: "#d4d0bd",
  水: "#5a91ac",
};

export function PalaceCard({ palace, compact = false, highlight }: { palace: ZiweiPalace; compact?: boolean; highlight?: "daxian" | "liunian" }) {
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

export function ElementBars({ counts }: { counts: Record<string, number> }) {
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

export function BaziTable({ chart }: { chart: FateChart }) {
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

export function BaziMobileCards({ chart }: { chart: FateChart }) {
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
