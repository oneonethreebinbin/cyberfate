import { Solar } from "lunar-javascript";
import type { FateChart } from "@/lib/types";
import { favorDirection, tenGodOf } from "@/lib/strength";
import { branchHeTransform, findFullXing, findTrines, isHaiPair, isPoPair, isSelfXing, isXingPair, pairIn } from "@/lib/combinations";
import { classify, stateGuidance, type FortuneState, type FortuneYear } from "@/lib/fortune";

const ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  子: "水", 亥: "水", 寅: "木", 卯: "木", 巳: "火", 午: "火", 申: "金", 酉: "金", 辰: "土", 戌: "土", 丑: "土", 未: "土",
};
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const LIU_HE = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const CHONG = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];

export type MonthlyState = FortuneState;
export type MonthlyReport = Omit<FortuneYear, "year"> & {
  /** 公历月份起点 YYYY-MM-01。 */
  monthStart: string;
};

/** 某公历日期所在节气月的月柱干支。 */
export function getMonthlyGanZhi(date = new Date()): { gan: string; zhi: string } {
  const eight = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12, 0, 0).getLunar().getEightChar();
  return { gan: eight.getMonthGan(), zhi: eight.getMonthZhi() };
}

/**
 * 流月观察：当月月柱与本命盘的表层关系，取象与时运六象同一口径。
 * 月柱以节气为界；此处以给定日期所在的节气月为准。
 */
export function analyzeMonthly(chart: FateChart, date = new Date()): MonthlyReport {
  const { gan, zhi } = getMonthlyGanZhi(date);
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
    evidence.push(`流月天干${gan}${ganElement}与日主${dayPillar.gan}${dayElement}同气（${ganGod}）`);
  } else if (GENERATES[ganElement] === dayElement) {
    scores.support += 1;
    evidence.push(`流月天干${ganElement}生扶日主${dayElement}（${ganGod}）`);
  } else if (GENERATES[dayElement] === ganElement) {
    scores.depletion += 1;
    evidence.push(`日主${dayElement}生流月${ganElement}，输出与耗泄并见（${ganGod}）`);
  } else if (CONTROLS[ganElement] === dayElement) {
    scores.pressure += 1;
    evidence.push(`流月${ganElement}制日主${dayElement}，约束与规则类信号增加（${ganGod}）`);
  } else if (CONTROLS[dayElement] === ganElement) {
    scores.support += 1;
    scores.depletion += 1;
    evidence.push(`日主${dayElement}所克之${ganElement}出现，机会伴随投入（${ganGod}）`);
  }
  if (ganDirection === "喜") {
    scores.support += 1;
    evidence.push(`日主${strength.verdict}，流月${ganGod}为喜用方向`);
  } else if (ganDirection === "忌") {
    scores.pressure += 1;
    evidence.push(`日主${strength.verdict}，流月${ganGod}为忌神方向，宜预留调整余地`);
  }

  const he = branchHeTransform(zhi, dayPillar.zhi, chart.bazi.pillars);
  if (he) {
    const heDirection = favorDirection(strength, he.element, dayElement);
    scores.support += 1;
    scores.movement += 1;
    evidence.push(`流月${zhi}与日支${dayPillar.zhi}六合${he.transformed ? `，化神${he.element}得力，合而化${he.element}` : `，化神${he.element}不得力，合而不化论绊`}${heDirection === "喜" ? "，化神为喜用" : heDirection === "忌" ? "，化神为忌" : ""}`);
  }
  if (pairIn(CHONG, dayPillar.zhi, zhi)) {
    scores.pressure += 1;
    scores.movement += 2;
    evidence.push(`流月${zhi}与日支${dayPillar.zhi}六冲，月内变动信号较显`);
  }
  if (zhi === dayPillar.zhi) {
    scores.movement += 1;
    scores.pressure += 1;
    if (isSelfXing(zhi)) evidence.push(`流月与日支同位且属自刑（${zhi}${zhi}），同类主题易重复`);
    else evidence.push(`流月地支与日支同位，相关主题易重复显现`);
  }
  if (isXingPair(zhi, dayPillar.zhi)) {
    scores.pressure += 1;
    scores.movement += 1;
    evidence.push(`流月${zhi}刑日支${dayPillar.zhi}，磨砺与规则类信号增加`);
  }
  if (isHaiPair(zhi, dayPillar.zhi)) {
    scores.pressure += 1;
    evidence.push(`流月${zhi}害日支${dayPillar.zhi}，暗损与琐碎摩擦留意`);
  }
  if (isPoPair(zhi, dayPillar.zhi)) {
    scores.movement += 1;
    evidence.push(`流月${zhi}破日支${dayPillar.zhi}，小耗与节奏扰动留意`);
  }

  const otherBranches = branches.filter((_, index) => index !== 2);
  const combinations = otherBranches.filter((branch) => pairIn(LIU_HE, branch, zhi));
  const clashes = otherBranches.filter((branch) => pairIn(CHONG, branch, zhi));
  const punishments = otherBranches.filter((branch) => isXingPair(branch, zhi));
  if (combinations.length) {
    scores.support += Math.min(1, combinations.length);
    evidence.push(`流月与原局另有 ${combinations.length} 处六合联系`);
  }
  if (clashes.length) {
    scores.pressure += Math.min(1, clashes.length);
    scores.movement += Math.min(1, clashes.length);
    evidence.push(`流月与原局另有 ${clashes.length} 处六冲联系`);
  }
  if (punishments.length) {
    scores.pressure += Math.min(1, punishments.length);
    evidence.push(`流月与原局另有 ${punishments.length} 处相刑联系`);
  }

  const fullXing = findFullXing([...branches, zhi]).filter((group) => group.includes(zhi));
  for (const group of fullXing) {
    scores.pressure += 1;
    scores.movement += 1;
    evidence.push(`流月${zhi}与原局${group.filter((member) => member !== zhi).join("")}凑成三刑全象（${group.join("")}）`);
  }

  const trines = findTrines([...branches, zhi]).filter((trine) => trine.members.includes(zhi));
  for (const trine of trines) {
    const trineDirection = favorDirection(strength, trine.element, dayElement);
    scores.support += trine.full ? 1 : 0.5;
    scores.movement += 1;
    evidence.push(`流月${zhi}与原局${trine.members.filter((member) => member !== zhi).join("")}成${trine.full ? "三合" : "半合"}${trine.element}局${trineDirection === "喜" ? "，局神为喜用" : trineDirection === "忌" ? "，局神为忌" : ""}`);
  }

  if (!evidence.length) evidence.push("流月与原局未见表层强生克合冲，保持常态观察");

  const state = classify(scores);
  const monthStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  return { monthStart, ganZhi: `${gan}${zhi}`, state, scores, evidence, ...stateGuidance(state) };
}

/** 未来 count 个公历月的流月报告；每月取月中（15 日）所在节气月为该月主口径。 */
export function buildMonthlyReports(chart: FateChart, count = 12, from = new Date()): MonthlyReport[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth() + index, 15);
    return analyzeMonthly(chart, date);
  });
}
