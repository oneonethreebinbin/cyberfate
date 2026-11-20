import { Solar } from "lunar-javascript";
import type { DaYunItem, DayMasterStrength, FateChart } from "@/lib/types";
import { favorDirection, tenGodOf } from "@/lib/strength";
import { branchHeTransform, findFullXing, findTrines, isHaiPair, isPoPair, isSelfXing, isXingPair, pairIn } from "@/lib/combinations";

const ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  子: "水", 亥: "水", 寅: "木", 卯: "木", 巳: "火", 午: "火", 申: "金", 酉: "金", 辰: "土", 戌: "土", 丑: "土", 未: "土",
};
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const LIU_HE = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const CHONG = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];

export type FortuneState = "favorable" | "caution" | "change" | "limited" | "mixed" | "quiet";

export const FORTUNE_STATE_META: Record<FortuneState, {
  seal: string;
  label: string;
  subtitle: string;
  explanation: string;
}> = {
  favorable: { seal: "势", label: "得时乘势", subtitle: "时位相应，助力渐聚。", explanation: "支持性规则较集中，适合观察已经准备成熟的事项是否更容易推进。" },
  caution: { seal: "慎", label: "守正慎行", subtitle: "阻力显现，宜审势而后动。", explanation: "制约性规则较明显，适合分阶段验证并保留调整余地。" },
  change: { seal: "动", label: "动象已彰", subtitle: "变动之象较强，宜预留转圜。", explanation: "合冲或重复信号使变化主题突出，但变化本身并不等于吉或凶。" },
  limited: { seal: "待", label: "气弱待时", subtitle: "资源与助力不足，宜蓄势养机。", explanation: "盘面承接或投入成本偏高，适合先补足信息、时间与现实资源。" },
  mixed: { seal: "参", label: "吉凶相参", subtitle: "诸象互有牵制，不宜执一而断。", explanation: "支持与制约同时出现，需要把不同规则分开核对，避免只取其中一面。" },
  quiet: { seal: "静", label: "象静无征", subtitle: "暂无明显触发，宜守常观察。", explanation: "表层规则没有形成集中信号，日常选择与长期积累仍然有效。" },
};

export interface FortuneYear {
  year: number;
  ganZhi: string;
  state: FortuneState;
  scores: {
    support: number;
    pressure: number;
    movement: number;
    depletion: number;
  };
  evidence: string[];
  counterpoint: string;
  observation: string;
}

export interface FortuneReport {
  current: FortuneYear;
  years: FortuneYear[];
  dayMaster: string;
  dayBranch: string;
  strength: DayMasterStrength;
  currentDaYun: DaYunItem | null;
  included: string[];
  missing: string[];
}

function classify(scores: FortuneYear["scores"]): FortuneState {
  if (scores.support >= 2 && scores.pressure >= 2) return "mixed";
  if (scores.movement >= 3) return "change";
  if (scores.pressure >= 3) return "caution";
  if (scores.depletion >= 2 && scores.support < 3) return "limited";
  if (scores.support >= 3 && scores.pressure < 2) return "favorable";
  return "quiet";
}

function stateGuidance(state: FortuneState) {
  const guidance: Record<FortuneState, { counterpoint: string; observation: string }> = {
    favorable: { counterpoint: "得势不等于无需准备；助力也可能伴随责任与投入增加。", observation: "可观察已筹备事项是否更易获得回应，并继续核对现实成本。" },
    caution: { counterpoint: "受制不必然是灾祸，也可能表现为规则、责任或专业要求提高。", observation: "重大决定宜分阶段推进，提前准备备选方案与求助资源。" },
    change: { counterpoint: "动象不等于坏事，也可能对应迁移、转型、关系推进或边界重建。", observation: "留意工作、关系和居所节奏的改变，为不可逆决定设置缓冲期。" },
    limited: { counterpoint: "待时并非停滞；补足能力、休息和信息本身也是有效行动。", observation: "先确认真正缺少的是时间、资金、支持还是判断依据，再决定投入顺序。" },
    mixed: { counterpoint: "同年存在方向相反的规则，任何单一结论都会遗漏另一部分证据。", observation: "把助力与阻力分别列出，优先选择可试错、可回退的行动。" },
    quiet: { counterpoint: "无强触发不代表没有事件，只表示当前规则没有形成集中信号。", observation: "维持正常节奏，并记录实际变化，避免为了符合标签而过度解释。" },
  };
  return guidance[state];
}

// 流年以立春为界：每年 1 月 1 日至立春之间，当前流年仍属上一个公历年份。
// 通过对比当日八字年柱与基准年柱（取该年 6 月 15 日，必然在立春之后）判断。
function yearPillarGanZhi(year: number) {
  const eight = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getEightChar();
  return `${eight.getYearGan()}${eight.getYearZhi()}`;
}

export function getFlowStartYear(now = new Date()): number {
  const calendarYear = now.getFullYear();
  const todayEight = Solar.fromDate(now).getLunar().getEightChar();
  const todayGanZhi = `${todayEight.getYearGan()}${todayEight.getYearZhi()}`;
  if (todayGanZhi === yearPillarGanZhi(calendarYear)) return calendarYear;
  if (todayGanZhi === yearPillarGanZhi(calendarYear - 1)) return calendarYear - 1;
  return calendarYear;
}

function analyzeYear(chart: FateChart, year: number): FortuneYear {
  const eight = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getEightChar();
  const gan = eight.getYearGan();
  const zhi = eight.getYearZhi();
  const ganElement = ELEMENTS[gan];
  const dayPillar = chart.bazi.pillars[2];
  const dayElement = ELEMENTS[dayPillar.gan];
  const strength = chart.bazi.strength;
  const branches = chart.bazi.pillars.map((pillar) => pillar.zhi);
  const scores = { support: 0, pressure: 0, movement: 0, depletion: 0 };
  const evidence: string[] = [];

  const ganGod = tenGodOf(ganElement, dayElement);
  const ganDirection = favorDirection(strength, ganElement, dayElement);
  if (ganElement === dayElement) {
    scores.support += 1;
    evidence.push(`流年天干${gan}${ganElement}与日主${dayPillar.gan}${dayElement}同气（${ganGod}）`);
  } else if (GENERATES[ganElement] === dayElement) {
    scores.support += 2;
    evidence.push(`流年天干${ganElement}生扶日主${dayElement}（${ganGod}）`);
  } else if (GENERATES[dayElement] === ganElement) {
    scores.depletion += 2;
    evidence.push(`日主${dayElement}生流年${ganElement}，输出与耗泄并见（${ganGod}）`);
  } else if (CONTROLS[ganElement] === dayElement) {
    scores.pressure += 2;
    evidence.push(`流年${ganElement}制日主${dayElement}，外部约束信号增加（${ganGod}）`);
  } else if (CONTROLS[dayElement] === ganElement) {
    scores.support += 1;
    scores.depletion += 1;
    evidence.push(`日主${dayElement}所克之${ganElement}出现，机会伴随投入（${ganGod}）`);
  }
  // 以月令旺衰定喜忌方向：身强喜克泄耗、身弱喜生扶。喜用加助势，忌神加阻力。
  if (ganDirection === "喜") {
    scores.support += 1;
    evidence.push(`日主${strength.verdict}，流年${ganGod}为喜用方向`);
  } else if (ganDirection === "忌") {
    scores.pressure += 1;
    evidence.push(`日主${strength.verdict}，流年${ganGod}为忌神方向，宜预留调整余地`);
  }

  const daYun = chart.bazi.daYun.find((item) => year >= item.startYear && year <= item.endYear) ?? null;
  if (daYun) {
    const yunGanElement = ELEMENTS[daYun.ganZhi[0]];
    const yunZhi = daYun.ganZhi[1];
    const yunGod = tenGodOf(yunGanElement, dayElement);
    const yunDirection = favorDirection(strength, yunGanElement, dayElement);
    scores.support += yunDirection === "喜" ? 2 : 0;
    scores.pressure += yunDirection === "忌" ? 2 : 0;
    evidence.push(`现行大运 ${daYun.ganZhi}（${daYun.startYear}–${daYun.endYear} 岁${daYun.startAge}起），大运天干属${yunGod}，${yunDirection === "平" ? "喜忌随具体组合" : `为${yunDirection}用方向`}`);
    if (pairIn(LIU_HE, dayPillar.zhi, yunZhi)) {
      scores.support += 1;
      scores.movement += 1;
      evidence.push(`大运${yunZhi}与日支${dayPillar.zhi}六合，十年基调偏向连接与协同`);
    }
    if (pairIn(CHONG, dayPillar.zhi, yunZhi)) {
      scores.pressure += 1;
      scores.movement += 2;
      evidence.push(`大运${yunZhi}与日支${dayPillar.zhi}六冲，十年基调带有变动主题`);
    }
    if (pairIn(CHONG, yunZhi, zhi)) {
      scores.movement += 2;
      scores.pressure += 1;
      evidence.push(`流年${zhi}冲动大运${yunZhi}，岁运交战，变动信号叠加`);
    } else if (pairIn(LIU_HE, yunZhi, zhi)) {
      scores.support += 1;
      evidence.push(`流年${zhi}合大运${yunZhi}，岁运相得`);
    }
  }

  const yearHe = branchHeTransform(zhi, dayPillar.zhi, chart.bazi.pillars);
  if (yearHe) {
    const heDirection = favorDirection(strength, yearHe.element, dayElement);
    if (yearHe.transformed) {
      scores.support += 2;
      scores.movement += 1;
      evidence.push(`流年${zhi}与日支${dayPillar.zhi}六合，化神${yearHe.element}得力，合而化${yearHe.element}${heDirection === "喜" ? "，化神为喜用，主题顺势" : heDirection === "忌" ? "，化神为忌，喜忌随化气方向" : ""}`);
      if (heDirection === "喜") scores.support += 1;
      if (heDirection === "忌") scores.pressure += 1;
    } else {
      scores.support += 1;
      scores.movement += 1;
      evidence.push(`流年${zhi}与日支${dayPillar.zhi}六合，化神${yearHe.element}不得力，合而不化论绊，连接中带纠缠`);
    }
  }
  if (pairIn(CHONG, dayPillar.zhi, zhi)) {
    scores.pressure += 1;
    scores.movement += 3;
    evidence.push(`流年${zhi}与日支${dayPillar.zhi}六冲，变动信号较强`);
  }
  if (zhi === dayPillar.zhi) {
    scores.movement += 1;
    scores.pressure += 1;
    if (isSelfXing(zhi)) evidence.push(`流年${zhi}与日支同位且属自刑（${zhi}${zhi}），相关主题容易重复并自我消耗`);
    else evidence.push(`流年地支与日支同位，相关主题容易重复显现`);
  }
  if (isXingPair(zhi, dayPillar.zhi)) {
    scores.pressure += 1;
    scores.movement += 1;
    evidence.push(`流年${zhi}刑日支${dayPillar.zhi}，磨砺与规则类信号增加`);
  }
  if (isHaiPair(zhi, dayPillar.zhi)) {
    scores.pressure += 1;
    evidence.push(`流年${zhi}害日支${dayPillar.zhi}，暗损与琐碎摩擦留意`);
  }
  if (isPoPair(zhi, dayPillar.zhi)) {
    scores.movement += 1;
    evidence.push(`流年${zhi}破日支${dayPillar.zhi}，小耗与节奏扰动留意`);
  }

  const otherBranches = branches.filter((_, index) => index !== 2);
  const combinations = otherBranches.filter((branch) => pairIn(LIU_HE, branch, zhi));
  const clashes = otherBranches.filter((branch) => pairIn(CHONG, branch, zhi));
  const punishments = otherBranches.filter((branch) => isXingPair(branch, zhi));
  if (combinations.length) {
    scores.support += Math.min(2, combinations.length);
    evidence.push(`流年与原局另有 ${combinations.length} 处六合联系`);
  }
  if (clashes.length) {
    scores.pressure += Math.min(2, clashes.length);
    scores.movement += Math.min(2, clashes.length);
    evidence.push(`流年与原局另有 ${clashes.length} 处六冲联系`);
  }
  if (punishments.length) {
    scores.pressure += Math.min(2, punishments.length);
    scores.movement += Math.min(1, punishments.length);
    evidence.push(`流年与原局另有 ${punishments.length} 处相刑联系`);
  }

  const fullXing = findFullXing([...branches, zhi]).filter((group) => group.includes(zhi));
  for (const group of fullXing) {
    scores.pressure += 2;
    scores.movement += 1;
    evidence.push(`流年${zhi}与原局${group.filter((member) => member !== zhi).join("")}凑成三刑全象（${group.join("")}），规则与磨砺类信号集中`);
  }

  const yearTrines = findTrines([...branches, zhi]).filter((trine) => trine.members.includes(zhi));
  for (const trine of yearTrines) {
    const trineDirection = favorDirection(strength, trine.element, dayElement);
    scores.support += trine.full ? 2 : 1;
    scores.movement += 1;
    evidence.push(`流年${zhi}与原局${trine.members.filter((member) => member !== zhi).join("")}成${trine.full ? "三合" : "半合"}${trine.element}局${trineDirection === "喜" ? "，局神为喜用" : trineDirection === "忌" ? "，局神为忌" : ""}`);
    if (trineDirection === "喜") scores.support += 1;
    if (trineDirection === "忌") scores.pressure += 1;
  }

  if ((chart.bazi.elementCounts[ganElement] ?? 0) === 0) {
    scores.depletion += 1;
    evidence.push(`原局表层未见${ganElement}，对该气的承接需继续核对`);
  }
  if (!evidence.length) evidence.push("未见表层强生克合冲，保持常态观察");

  const state = classify(scores);
  return { year, ganZhi: `${gan}${zhi}`, state, scores, evidence, ...stateGuidance(state) };
}

export function buildFortuneReport(chart: FateChart, startYear = getFlowStartYear()): FortuneReport {
  const years = Array.from({ length: 6 }, (_, index) => analyzeYear(chart, startYear + index));
  const currentDaYun = chart.bazi.daYun.find((item) => startYear >= item.startYear && startYear <= item.endYear) ?? null;
  return {
    current: years[0],
    years,
    dayMaster: chart.bazi.dayMaster,
    dayBranch: chart.bazi.pillars[2].zhi,
    strength: chart.bazi.strength,
    currentDaYun,
    included: ["流年干支", "月令旺衰定喜忌", "现行大运与岁运关系", "日主五行生克", "六合合化（化神透干/得令简判）", "三合全半", "日支刑害破与三刑全象", "原局表层合冲刑"],
    missing: ["化气后的旺衰重估", "大运藏干透出", "流月流日", "藏干权重（表层近似）", "大限流年四化叠盘", "调候用神与格局"],
  };
}
