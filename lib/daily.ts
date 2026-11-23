import { Solar } from "lunar-javascript";
import type { FateChart } from "@/lib/types";
import { favorDirection, tenGodOf } from "@/lib/strength";
import { branchHeTransform, findFullXing, findTrines, isHaiPair, isPoPair, isSelfXing, isXingPair, pairIn } from "@/lib/combinations";
import { classify, FORTUNE_STATE_META, stateGuidance, type FortuneState, type FortuneYear } from "@/lib/fortune";

const ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  子: "水", 亥: "水", 寅: "木", 卯: "木", 巳: "火", 午: "火", 申: "金", 酉: "金", 辰: "土", 戌: "土", 丑: "土", 未: "土",
};
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const LIU_HE = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const CHONG = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];

export type DailyState = FortuneState;
export const DAILY_STATE_META = FORTUNE_STATE_META;

export interface DailyReport extends Omit<FortuneYear, "year"> {
  date: string;
}

/** 当日日柱干支：取当日正午历元，避开晚子时归属歧义。 */
export function getDailyGanZhi(date = new Date()): { gan: string; zhi: string } {
  const eight = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12, 0, 0).getLunar().getEightChar();
  return { gan: eight.getDayGan(), zhi: eight.getDayZhi() };
}

/**
 * 流日观察：当日干支与本命盘的表层关系，取象与时运六象同一口径。
 * 只观一日，权重较流年更轻；未纳入流时、真太阳时当日修正与调候。
 */
export function analyzeDaily(chart: FateChart, date = new Date()): DailyReport {
  const { gan, zhi } = getDailyGanZhi(date);
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
    evidence.push(`流日天干${gan}${ganElement}与日主${dayPillar.gan}${dayElement}同气（${ganGod}）`);
  } else if (GENERATES[ganElement] === dayElement) {
    scores.support += 1;
    evidence.push(`流日天干${ganElement}生扶日主${dayElement}（${ganGod}）`);
  } else if (GENERATES[dayElement] === ganElement) {
    scores.depletion += 1;
    evidence.push(`日主${dayElement}生流日${ganElement}，输出与耗泄并见（${ganGod}）`);
  } else if (CONTROLS[ganElement] === dayElement) {
    scores.pressure += 1;
    evidence.push(`流日${ganElement}制日主${dayElement}，约束与规则类信号略增（${ganGod}）`);
  } else if (CONTROLS[dayElement] === ganElement) {
    scores.support += 1;
    scores.depletion += 1;
    evidence.push(`日主${dayElement}所克之${ganElement}出现，机会伴随投入（${ganGod}）`);
  }
  if (ganDirection === "喜") {
    scores.support += 1;
    evidence.push(`日主${strength.verdict}，流日${ganGod}为喜用方向`);
  } else if (ganDirection === "忌") {
    scores.pressure += 1;
    evidence.push(`日主${strength.verdict}，流日${ganGod}为忌神方向，宜预留调整余地`);
  }

  const he = branchHeTransform(zhi, dayPillar.zhi, chart.bazi.pillars);
  if (he) {
    const heDirection = favorDirection(strength, he.element, dayElement);
    scores.support += he.transformed ? 1 : 0.5;
    scores.movement += 0.5;
    evidence.push(`流日${zhi}与日支${dayPillar.zhi}六合${he.transformed ? `，化神${he.element}得力，合而化${he.element}` : `，化神${he.element}不得力，合而不化论绊`}${heDirection === "喜" ? "，化神为喜用" : heDirection === "忌" ? "，化神为忌" : ""}`);
  }
  if (pairIn(CHONG, dayPillar.zhi, zhi)) {
    scores.pressure += 1;
    scores.movement += 2;
    evidence.push(`流日${zhi}与日支${dayPillar.zhi}六冲，当日变动信号较显`);
  }
  if (zhi === dayPillar.zhi) {
    scores.movement += 0.5;
    scores.pressure += 0.5;
    if (isSelfXing(zhi)) evidence.push(`流日与日支同位且属自刑（${zhi}${zhi}），同类主题易重复`);
    else evidence.push(`流日地支与日支同位，相关主题易重复显现`);
  }
  if (isXingPair(zhi, dayPillar.zhi)) {
    scores.pressure += 1;
    scores.movement += 0.5;
    evidence.push(`流日${zhi}刑日支${dayPillar.zhi}，磨砺与规则类信号略增`);
  }
  if (isHaiPair(zhi, dayPillar.zhi)) {
    scores.pressure += 0.5;
    evidence.push(`流日${zhi}害日支${dayPillar.zhi}，琐碎摩擦留意`);
  }
  if (isPoPair(zhi, dayPillar.zhi)) {
    scores.movement += 0.5;
    evidence.push(`流日${zhi}破日支${dayPillar.zhi}，小耗与节奏扰动留意`);
  }

  const otherBranches = branches.filter((_, index) => index !== 2);
  const combinations = otherBranches.filter((branch) => pairIn(LIU_HE, branch, zhi));
  const clashes = otherBranches.filter((branch) => pairIn(CHONG, branch, zhi));
  if (combinations.length) {
    scores.support += Math.min(1, combinations.length * 0.5);
    evidence.push(`流日与原局另有 ${combinations.length} 处六合联系`);
  }
  if (clashes.length) {
    scores.pressure += Math.min(1, clashes.length * 0.5);
    scores.movement += Math.min(1, clashes.length * 0.5);
    evidence.push(`流日与原局另有 ${clashes.length} 处六冲联系`);
  }

  const fullXing = findFullXing([...branches, zhi]).filter((group) => group.includes(zhi));
  for (const group of fullXing) {
    scores.pressure += 1;
    scores.movement += 0.5;
    evidence.push(`流日${zhi}与原局${group.filter((member) => member !== zhi).join("")}凑成三刑全象（${group.join("")}）`);
  }

  const trines = findTrines([...branches, zhi]).filter((trine) => trine.members.includes(zhi));
  for (const trine of trines) {
    const trineDirection = favorDirection(strength, trine.element, dayElement);
    scores.support += trine.full ? 1 : 0.5;
    scores.movement += 0.5;
    evidence.push(`流日${zhi}与原局${trine.members.filter((member) => member !== zhi).join("")}成${trine.full ? "三合" : "半合"}${trine.element}局${trineDirection === "喜" ? "，局神为喜用" : trineDirection === "忌" ? "，局神为忌" : ""}`);
  }

  if (!evidence.length) evidence.push("流日与原局未见表层强生克合冲，保持常态观察");

  const scoresWhole = {
    support: Math.floor(scores.support),
    pressure: Math.floor(scores.pressure),
    movement: Math.floor(scores.movement),
    depletion: Math.floor(scores.depletion),
  };
  const state = classify(scoresWhole);
  const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { date: dateValue, ganZhi: `${gan}${zhi}`, state, scores: scoresWhole, evidence, ...stateGuidance(state) };
}
