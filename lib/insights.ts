import { Solar } from "lunar-javascript";
import type { BaziPillar, FateChart, ZiweiPalace } from "@/lib/types";
import {
  branchHeTransform, findFullXing, findTrines, isHaiPair, isPoPair, isSelfXing, isXingPair,
} from "@/lib/combinations";
import { getFlowStartYear, getYearPillarGanZhi } from "@/lib/fortune";

const LIU_HE = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const CHONG = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];

function pairIn(pairs: string[], a: string, b: string) {
  return pairs.includes(`${a}${b}`) || pairs.includes(`${b}${a}`);
}

/**
 * 宫位网络：本宫、对宫与三方（三合方）。iztro 宫位索引自寅宫起顺排，
 * 对宫 = (index + 6) % 12，三合方 = (index + 4) % 12 与 (index + 8) % 12。
 * 对宫用于空宫「借星安宫」，三方四正用于看会照。
 */
export function getPalaceNetwork(chart: FateChart, palaceName: string): {
  target: ZiweiPalace;
  opposite: ZiweiPalace | null;
  trine: ZiweiPalace[];
  borrowedMajors: string[];
  trineMajors: string[];
} {
  const target = chart.ziwei.palaces.find((palace) => palace.name === palaceName) ?? chart.ziwei.palaces[0];
  const opposite = chart.ziwei.palaces.find((palace) => palace.index === (target.index + 6) % 12) ?? null;
  const trine = [(target.index + 4) % 12, (target.index + 8) % 12]
    .map((index) => chart.ziwei.palaces.find((palace) => palace.index === index))
    .filter((palace): palace is ZiweiPalace => Boolean(palace));
  const targetMajors = target.stars.filter((star) => star.type === "major").map((star) => star.name);
  const oppositeMajors = opposite?.stars.filter((star) => star.type === "major").map((star) => star.name) ?? [];
  const trineMajors = trine.flatMap((palace) => palace.stars.filter((star) => star.type === "major").map((star) => star.name));
  return {
    target,
    opposite,
    trine,
    borrowedMajors: targetMajors.length ? [] : oppositeMajors,
    trineMajors,
  };
}

export interface ChartInsight {
  id: string;
  index: string;
  label: string;
  title: string;
  summary: string;
  plain: string;
  manifestations: string[];
  evidence: string[];
  alternative: string;
  limits: string;
  tone: "jade" | "gold" | "vermilion" | "neutral";
}

export interface QuickReadingItem {
  label: string;
  title: string;
  detail: string;
}

export interface ChartReading {
  headline: string;
  summary: string;
  included: string[];
  missing: string[];
  quickRead: QuickReadingItem[];
  insights: ChartInsight[];
}

export interface DayBranchRelations {
  dayPillar: BaziPillar;
  combined: BaziPillar[];
  heTransforms: Array<{ pillar: BaziPillar; element: string; transformed: boolean }>;
  clashed: BaziPillar[];
  trines: Array<{ element: string; members: string[]; full: boolean }>;
  punished: BaziPillar[];
  selfXing: boolean;
  fullXing: string[][];
  harmed: BaziPillar[];
  broken: BaziPillar[];
}

export function getDayBranchRelations(chart: FateChart): DayBranchRelations {
  const dayPillar = chart.bazi.pillars[2];
  const others = chart.bazi.pillars.filter((_, index) => index !== 2);
  const combined = others.filter((pillar) => pairIn(LIU_HE, dayPillar.zhi, pillar.zhi));
  const heTransforms = combined
    .map((pillar) => ({ pillar, he: branchHeTransform(dayPillar.zhi, pillar.zhi, chart.bazi.pillars) }))
    .filter((item): item is { pillar: BaziPillar; he: NonNullable<ReturnType<typeof branchHeTransform>> } => item.he !== null)
    .map((item) => ({ pillar: item.pillar, element: item.he.element, transformed: item.he.transformed }));
  const clashed = others.filter((pillar) => pairIn(CHONG, dayPillar.zhi, pillar.zhi));
  const trines = findTrines(chart.bazi.pillars.map((pillar) => pillar.zhi));
  const punished = others.filter((pillar) => isXingPair(dayPillar.zhi, pillar.zhi));
  const fullXing = findFullXing(chart.bazi.pillars.map((pillar) => pillar.zhi));
  const harmed = others.filter((pillar) => isHaiPair(dayPillar.zhi, pillar.zhi));
  const broken = others.filter((pillar) => isPoPair(dayPillar.zhi, pillar.zhi));
  return {
    dayPillar,
    combined,
    heTransforms,
    clashed,
    trines,
    punished,
    selfXing: isSelfXing(dayPillar.zhi) && others.some((pillar) => pillar.zhi === dayPillar.zhi),
    fullXing,
    harmed,
    broken,
  };
}

/**
 * 紫微大限与流年宫：大限按虚岁落宫，流年宫为流年地支所落之宫。
 * 虚岁以立春增岁：出生即一岁，此后每逢立春加一岁——1 月 1 日至立春之间不计新岁，
 * 与流年立春边界同一口径，避免跨年时大限宫提前一年切换。
 */
export function getZiweiPeriods(chart: FateChart, now = new Date()): {
  virtualAge: number;
  daXian: ZiweiPalace | null;
  liuNian: ZiweiPalace | null;
  liuNianZhi: string;
} {
  // 出生所在的传统流年（立春口径）：八字年柱若非出生公历年的年柱，则属上一流年。
  const calendarYear = Number(chart.profile.date.slice(0, 4));
  const birthPillar = `${chart.bazi.pillars[0].gan}${chart.bazi.pillars[0].zhi}`;
  const birthFlowYear = birthPillar === getYearPillarGanZhi(calendarYear) ? calendarYear : calendarYear - 1;
  const virtualAge = getFlowStartYear(now) - birthFlowYear + 1;
  const daXian = chart.ziwei.palaces.find((palace) => palace.decadal[0] <= virtualAge && virtualAge <= palace.decadal[1]) ?? null;
  const flowYear = getFlowStartYear(now);
  const flowEight = Solar.fromYmdHms(flowYear, 6, 15, 12, 0, 0).getLunar().getEightChar();
  const liuNianZhi = flowEight.getYearZhi();
  const liuNian = chart.ziwei.palaces.find((palace) => palace.ganZhi.endsWith(liuNianZhi)) ?? null;
  return { virtualAge, daXian, liuNian, liuNianZhi };
}

// 十干四化表（中州派口径：庚干太阴化科、壬干左辅化科）。
export const PALACE_STEM_SIHUA: Record<string, Array<{ star: string; mutagen: string }>> = {
  甲: [{ star: "廉贞", mutagen: "禄" }, { star: "破军", mutagen: "权" }, { star: "武曲", mutagen: "科" }, { star: "太阳", mutagen: "忌" }],
  乙: [{ star: "天机", mutagen: "禄" }, { star: "天梁", mutagen: "权" }, { star: "紫微", mutagen: "科" }, { star: "太阴", mutagen: "忌" }],
  丙: [{ star: "天同", mutagen: "禄" }, { star: "天机", mutagen: "权" }, { star: "文昌", mutagen: "科" }, { star: "廉贞", mutagen: "忌" }],
  丁: [{ star: "太阴", mutagen: "禄" }, { star: "天同", mutagen: "权" }, { star: "天机", mutagen: "科" }, { star: "巨门", mutagen: "忌" }],
  戊: [{ star: "贪狼", mutagen: "禄" }, { star: "太阴", mutagen: "权" }, { star: "右弼", mutagen: "科" }, { star: "天机", mutagen: "忌" }],
  己: [{ star: "武曲", mutagen: "禄" }, { star: "贪狼", mutagen: "权" }, { star: "天梁", mutagen: "科" }, { star: "文曲", mutagen: "忌" }],
  庚: [{ star: "太阳", mutagen: "禄" }, { star: "武曲", mutagen: "权" }, { star: "太阴", mutagen: "科" }, { star: "天同", mutagen: "忌" }],
  辛: [{ star: "巨门", mutagen: "禄" }, { star: "太阳", mutagen: "权" }, { star: "文曲", mutagen: "科" }, { star: "文昌", mutagen: "忌" }],
  壬: [{ star: "天梁", mutagen: "禄" }, { star: "紫微", mutagen: "权" }, { star: "左辅", mutagen: "科" }, { star: "武曲", mutagen: "忌" }],
  癸: [{ star: "破军", mutagen: "禄" }, { star: "巨门", mutagen: "权" }, { star: "太阴", mutagen: "科" }, { star: "贪狼", mutagen: "忌" }],
};

export interface FlownTransformation {
  mutagen: string;
  star: string;
  toPalace: string | null;
}

/**
 * 宫干四化飞星追宫：以指定宫位的天干起四化，追各化曜落宫。
 */
export function flyPalaceTransformations(chart: FateChart, palaceName: string): {
  stem: string;
  flies: FlownTransformation[];
} {
  const palace = chart.ziwei.palaces.find((item) => item.name === palaceName) ?? chart.ziwei.palaces[0];
  const stem = palace.ganZhi[0];
  const flies = (PALACE_STEM_SIHUA[stem] ?? []).map(({ star, mutagen }) => {
    const to = chart.ziwei.palaces.find((item) => item.stars.some((starItem) => starItem.name === star)) ?? null;
    return { mutagen, star, toPalace: to ? to.name : null };
  });
  return { stem, flies };
}

export function buildChartReading(chart: FateChart): ChartReading {
  const lifePalace = chart.ziwei.palaces.find((palace) => palace.name === "命宫") ?? chart.ziwei.palaces[0];
  const bodyPalace = chart.ziwei.palaces.find((palace) => palace.isBodyPalace) ?? lifePalace;
  const lifeMajor = lifePalace.stars.filter((star) => star.type === "major").map((star) => star.name);
  const bodyMajor = bodyPalace.stars.filter((star) => star.type === "major").map((star) => star.name);
  const elements = Object.entries(chart.bazi.elementCounts).sort((a, b) => b[1] - a[1]);
  const strongest = elements[0];
  const weakest = [...elements].sort((a, b) => a[1] - b[1])[0];
  const relations = getDayBranchRelations(chart);
  const transformed = chart.ziwei.palaces.flatMap((palace) =>
    palace.stars
      .filter((star) => star.mutagen)
      .map((star) => `${palace.name} · ${star.name}化${star.mutagen}`),
  );

  const relationNotes: string[] = [];
  if (relations.heTransforms.length) {
    relationNotes.push(relations.heTransforms.map((item) =>
      `与${item.pillar.label}${item.pillar.zhi}六合${item.transformed ? `，化神${item.element}得力，合而化${item.element}` : `，化神${item.element}不得力，合而不化论绊`}`).join("；"));
  } else if (relations.combined.length) {
    relationNotes.push(`与${relations.combined.map((pillar) => `${pillar.label}${pillar.zhi}`).join("、")}形成六合`);
  }
  if (relations.clashed.length) {
    relationNotes.push(`与${relations.clashed.map((pillar) => `${pillar.label}${pillar.zhi}`).join("、")}形成六冲`);
  }
  if (relations.trines.length) {
    relationNotes.push(relations.trines.map((trine) =>
      `${trine.members.join("")}${trine.full ? "三合成" : "半合"}${trine.element}局`).join("、"));
  }
  if (relations.punished.length || relations.selfXing || relations.fullXing.length) {
    relationNotes.push(`刑象见${[
      ...relations.fullXing.map((group) => `三刑全象${group.join("")}`),
      ...relations.punished.map((pillar) => `${relations.dayPillar.zhi}${pillar.zhi}`),
      relations.selfXing ? `${relations.dayPillar.zhi}自刑` : "",
    ].filter(Boolean).join("、")}`);
  }
  if (relations.harmed.length) relationNotes.push(`与${relations.harmed.map((pillar) => pillar.zhi).join("、")}相害`);
  if (relations.broken.length) relationNotes.push(`与${relations.broken.map((pillar) => pillar.zhi).join("、")}相破`);
  const relationSummary = relationNotes.length
    ? `日支${relations.dayPillar.zhi}${relationNotes.join("；")}。合有化与不化之别，化神得力则喜忌随化气，不得力则论绊；冲主动荡，刑主磨砺，害主暗损，破主小耗。`
    : `日支${relations.dayPillar.zhi}与其余三支未见直接合冲刑害破。`;

  const headline = relations.combined.length && relations.clashed.length
    ? "先看连接与变化如何同时出现"
    : bodyPalace.name !== lifePalace.name
      ? "先从命宫与身宫的双重主轴阅读"
      : "先从日主与命宫两条主轴阅读";

  const strengthPlain = chart.bazi.strength.verdict === "身强"
    ? "盘面中支持日主的力量相对充足。现实里更值得观察的是：你会怎样把已有能量用于输出、承担和兑现，以及是否容易同时接住太多事情。"
    : chart.bazi.strength.verdict === "身弱"
      ? "盘面中支持日主的力量相对有限。面对持续压力时，可以重点观察资源、协作与节奏缓冲是否会明显影响你的发挥，而不是把它理解成能力不足。"
      : "盘面中的支持与消耗暂未明显偏向一侧。比起寻找单一的“补什么”，更适合观察不同情境下，哪一种力量正在增加。";
  const strengthManifestations = chart.bazi.strength.verdict === "身强"
    ? ["资源充足时，可能更愿意主动接住任务，也要留意是否承担过量。", "真正需要核对的是输出、责任与休息能否保持平衡。"]
    : chart.bazi.strength.verdict === "身弱"
      ? ["连续独自承担、缺少反馈或支持时，消耗感可能更明显。", "有清晰协作、稳定资源或充分准备时，状态可能更容易展开。"]
      : ["不同环境下的表现可能差异较大，单一标签很难概括。", "可以留意支持增加与压力增加时，你的行动方式如何变化。"];
  const relationPlain = relations.combined.length && relations.clashed.length
    ? "盘内同时出现连接与变化信号。现实中可重点观察：一件事是否一边带来合作或靠近，一边又要求你调整原有节奏。"
    : relations.clashed.length || relations.punished.length || relations.selfXing
      ? "盘内的变化或磨合信号更醒目。它不等于事情一定不好，而是提醒你留意哪些关系、计划或习惯会反复要求调整。"
      : relations.combined.length
        ? "盘内的连接信号较醒目。它可能表现为合作、靠近或资源汇合，也可能形成牵绊，仍要看现实中是否保有清晰边界。"
        : "日支与其余三支未见直接的合冲刑害破，表示这一层没有特别集中的结构信号，不代表现实关系一定平静或没有变化。";
  const relationManifestations = relations.combined.length && relations.clashed.length
    ? ["靠近一个人或机会的同时，也可能需要改变原来的安排。", "同一件事里既有吸引，也有拉扯；适合分别记录两种感受。"]
    : relations.clashed.length || relations.punished.length || relations.selfXing
      ? ["计划被打断、节奏重排或同一矛盾反复出现时，这条线索更值得核对。", "变化也可能带来重新选择与建立边界的机会，不只代表损失。"]
      : relations.combined.length
        ? ["合作、关系靠近或资源汇合时，可能更容易感到这股力量。", "若连接逐渐变成迁就或纠缠，需要回到现实边界重新判断。"]
        : ["没有集中信号时，不必勉强寻找对应事件。", "现实经历若更强烈，应优先保留现实反例，再检查其他盘面层次。"];
  const lifeBodyPlain = bodyPalace.name === lifePalace.name
    ? "命宫与身宫落在同一位置，传统上会把内在关注与实际投入视为较集中；具体如何表现，仍要结合主星与相关宫位。"
    : "命宫与身宫落在不同位置，传统上会把“最初如何理解自己”和“后来把力气投向哪里”分开观察。两者不是矛盾，而是两种视角。";
  const lifeBodyManifestations = bodyPalace.name === lifePalace.name
    ? ["想法与行动方向可能更容易围绕同一类主题集中。", "集中不等于单一，仍要看不同场景是否出现明显反例。"]
    : ["心里最在意的事，未必就是现实中投入最多的事。", "当两种方向拉开时，可以观察自己是在适应环境，还是主动调整重心。"];
  const visiblePlain = "表层五行分布只是盘面的出现频率，不等同于能力、性格或吉凶。它更适合帮助你决定下一步查看哪些关系，而不是直接得出“缺什么”的结论。";
  const mutagenPlain = transformed.length
    ? "四化可以理解为星曜作用方向的四种标记，用来追踪哪些生活主题更容易得到资源、承担责任、形成表达或出现牵挂；它们不是四个简单的好坏等级。"
    : "当前数据没有返回可用的四化标记，因此这一层暂不延伸解释，也不从缺失字段推断吉凶。";

  return {
    headline,
    summary: `此导读只合已算之盘面为序，助君按次第观盘；古法之构，不作性格与祸福之断。`,
    included: ["四柱与藏干", "表层五行", "月令旺衰与身强身弱", "合化与刑害破（含三刑全象）", "本命十二宫", "命身主与四化字段", "大限宫与流年宫", "宫干飞化落宫"],
    missing: ["化气后的旺衰重估", "大限流年四化叠盘", "大运与流月", "完整三方四正会照权重", "现实经历"],
    quickRead: [
      { label: "核心锚点", title: `日主${chart.bazi.strength.verdict}`, detail: strengthPlain },
      { label: "结构张力", title: relations.combined.length && relations.clashed.length ? "连接与变化同时出现" : relationNotes.length ? "盘内关系需要核对" : "未见集中关系信号", detail: relationPlain },
      { label: "行动落点", title: bodyPalace.name === lifePalace.name ? "命身主轴相合" : "命身两处参看", detail: lifeBodyPlain },
    ],
    insights: [
      {
        id: "day-master",
        index: "01",
        label: "八字主轴",
        title: `日主${chart.bazi.strength.verdict}，以${chart.bazi.dayMaster}为观察锚点`,
        summary: `月令为本、藏干为根：${chart.bazi.strength.commandNote}，表层近似判定为${chart.bazi.strength.verdict}。身强者喜克泄耗，身弱者喜生扶，此后生克信号才有喜忌方向。`,
        plain: strengthPlain,
        manifestations: strengthManifestations,
        evidence: [
          `日柱：${relations.dayPillar.gan}${relations.dayPillar.zhi}`,
          `日干十神：${relations.dayPillar.shiShenGan}`,
          `日支藏干：${relations.dayPillar.hidden.join("、") || "未提供"}`,
          `旺衰判定：${chart.bazi.strength.verdict}（权重 ${chart.bazi.strength.score}）`,
          ...chart.bazi.strength.evidence,
        ],
        alternative: "旺衰只是近似判定；相同日主会因月令、根气、透干与大运不同而呈现不同结构，不能只按五行名称套用性格描述。",
        limits: "未纳入合化、调候、格局取用与藏干精确权重，判定结果只用于给生克信号定喜忌方向。",
        tone: "jade",
      },
      {
        id: "branch-network",
        index: "02",
        label: "地支关系",
        title: relationNotes.length ? "盘内存在可继续追踪的合冲刑破关系" : "盘内未见日支直接合冲刑害破",
        summary: relationSummary,
        plain: relationPlain,
        manifestations: relationManifestations,
        evidence: [
          `四支：${chart.bazi.pillars.map((pillar) => `${pillar.label}${pillar.zhi}`).join(" · ")}`,
          `六合：${relations.heTransforms.length ? relations.heTransforms.map((item) => `${relations.dayPillar.zhi}${item.pillar.zhi}${item.transformed ? `化${item.element}` : "（绊）"}`).join("、") : "未见"}`,
          `六冲：${relations.clashed.length ? relations.clashed.map((pillar) => `${relations.dayPillar.zhi}${pillar.zhi}`).join("、") : "未见"}`,
          `三合：${relations.trines.length ? relations.trines.map((trine) => `${trine.members.join("")}${trine.full ? "全" : "半"}${trine.element}`).join("、") : "未见"}`,
          `刑害破：${[
            ...relations.fullXing.map((group) => `三刑${group.join("")}`),
            ...relations.punished.map((pillar) => `刑${relations.dayPillar.zhi}${pillar.zhi}`),
            relations.selfXing ? `自刑${relations.dayPillar.zhi}` : "",
            ...relations.harmed.map((pillar) => `害${relations.dayPillar.zhi}${pillar.zhi}`),
            ...relations.broken.map((pillar) => `破${relations.dayPillar.zhi}${pillar.zhi}`),
          ].filter(Boolean).join("、") || "未见"}`,
        ],
        alternative: "合不必然代表顺利，冲也不必然代表负面；化神得力则喜忌随化气走，绊主纠缠，刑主磨砺，害主暗损，破主小耗，各自也需要回到现实经历里核对。",
        limits: "已纳入六合合化（化神透干或得令的简化判断）、三合全半、两两相刑与三刑全象、害、破；未纳入化气后的旺衰重估与流月触发。",
        tone: relations.clashed.length || relations.punished.length ? "vermilion" : relations.combined.length ? "gold" : "neutral",
      },
      {
        id: "life-body-axis",
        index: "04",
        label: "紫微主轴",
        title: bodyPalace.name === lifePalace.name ? `命身同落${lifePalace.name}` : `${lifePalace.name}与${bodyPalace.name}构成双重观察点`,
        summary: `命宫落${lifePalace.ganZhi}，主星${lifeMajor.join("、") || "为空宫"}；身宫落在${bodyPalace.ganZhi}${bodyPalace.name}，主星${bodyMajor.join("、") || "为空宫"}。`,
        plain: lifeBodyPlain,
        manifestations: lifeBodyManifestations,
        evidence: [
          `命宫：${lifePalace.ganZhi} · ${lifeMajor.join("、") || "空宫"}`,
          `身宫：${bodyPalace.ganZhi} · ${bodyPalace.name} · ${bodyMajor.join("、") || "空宫"}`,
          `命主 / 身主：${chart.ziwei.soul} / ${chart.ziwei.body}`,
        ],
        alternative: "命宫与身宫只是全盘入口；空宫需要借对宫，非空宫也不能脱离三方四正单独下结论。",
        limits: "当前导读尚未计算完整三方四正、会照关系与运限叠盘。",
        tone: "gold",
      },
      {
        id: "visible-patterns",
        index: "03",
        label: "已见与未决",
        title: `${strongest[0]}在表层计数较多，${weakest[0]}较少`,
        summary: `八个表层干支中，${strongest[0]}出现 ${strongest[1]} 次，${weakest[0]}出现 ${weakest[1]} 次。这个计数用于描述分布，不直接判断强弱或喜忌。`,
        plain: visiblePlain,
        manifestations: ["某个元素出现较多，只表示它在表层坐标中更常见。", "若现实感受与计数不一致，应优先保留现实反例，再检查月令、藏干与合化。"],
        evidence: [
          `五行表层计数：${elements.map(([element, count]) => `${element}${count}`).join(" · ")}`,
          `采用时间：${chart.correctedDateTime}`,
        ],
        alternative: "数量较多不等于力量一定较强，数量为零也不等于现实中“缺少”某种能力或经历。",
        limits: "未纳入月令、藏干权重、透干、根气、合化与调候，因此不能据此判断喜忌。",
        tone: "neutral",
      },
      {
        id: "mutagen-paths",
        index: "05",
        label: "紫微四化",
        title: transformed.length ? `本命盘记录到 ${transformed.length} 处四化标记` : "当前返回盘面未见四化标记",
        summary: transformed.length ? `四化分布在${transformed.map((item) => item.split(" · ")[0]).join("、")}等宫位，可作为后续追踪宫位联动的入口。` : "四化需要结合天干、星曜落宫与宫位关系理解，不以数量多少判定吉凶。",
        plain: mutagenPlain,
        manifestations: ["先看四化落在哪个生活主题，再观察现实中是否反复出现。", "化禄、化权、化科、化忌都可能同时带来机会与负担，不宜直接排成吉凶顺序。"],
        evidence: transformed.length ? transformed : ["当前标准化数据未返回四化字段"],
        alternative: "化禄、化权、化科、化忌不是简单的好坏标签，同一四化在不同宫位与会照结构中会有不同讨论重点。",
        limits: "当前只展示本命四化字段，尚未展开飞化路径、自化与大限流年四化。",
        tone: transformed.some((item) => item.endsWith("化忌")) ? "vermilion" : "gold",
      },
    ],
  };
}
