import type { BaziPillar } from "@/lib/types";

const ELEMENTS: Record<string, string> = {
  子: "水", 亥: "水", 寅: "木", 卯: "木", 巳: "火", 午: "火",
  申: "金", 酉: "金", 辰: "土", 戌: "土", 丑: "土", 未: "土",
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土",
  庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

// 六合与化神：子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土（一说化火，此处取土）。
export const LIU_HE_TRANSFORM: Record<string, string> = {
  子丑: "土", 寅亥: "木", 卯戌: "火", 辰酉: "金", 巳申: "水", 午未: "土",
};

// 天干五合与化神。
export const GAN_HE_TRANSFORM: Record<string, string> = {
  甲己: "土", 乙庚: "金", 丙辛: "水", 丁壬: "木", 戊癸: "火",
};

// 三合局：申子辰水、寅午戌火、巳酉丑金、亥卯未木。
const SAN_HE: Array<{ members: string[]; element: string }> = [
  { members: ["申", "子", "辰"], element: "水" },
  { members: ["寅", "午", "戌"], element: "火" },
  { members: ["巳", "酉", "丑"], element: "金" },
  { members: ["亥", "卯", "未"], element: "木" },
];

// 相刑：子卯互刑；寅巳申三刑（寅刑巳、巳刑申、申刑寅）；丑戌未三刑（丑刑戌、戌刑未、未刑丑）。
// 寅申、丑未既在刑组亦为六冲，逢之刑冲并见，两处信号俱计。
export const LIU_XING = ["子卯", "寅巳", "巳申", "寅申", "丑戌", "戌未", "丑未"];
// 自刑：辰午酉亥见同支。
const SELF_XING = ["辰", "午", "酉", "亥"];

// 三刑全象：寅巳申（无恩）、丑戌未（恃势）三支齐见。
const SAN_XING_GROUPS: string[][] = [
  ["寅", "巳", "申"],
  ["丑", "戌", "未"],
];

export function findFullXing(branches: string[]): string[][] {
  return SAN_XING_GROUPS.filter((group) => group.every((member) => branches.includes(member))).map((group) => [...group]);
}

// 六害：子未、丑午、寅巳、卯辰、申亥、酉戌。
export const LIU_HAI = ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"];

// 六破：子酉、午卯、申巳、寅亥、辰丑、戌未。
export const LIU_PO = ["子酉", "午卯", "申巳", "寅亥", "辰丑", "戌未"];

export function pairIn(pairs: string[], a: string, b: string) {
  return pairs.includes(`${a}${b}`) || pairs.includes(`${b}${a}`);
}

/**
 * 化神得力与否的简化判断：化神在天干透出，或月令主气即为化神（得令），则合可论化；
 * 否则合而不化，论「绊」。
 */
export function canTransform(transformElement: string, pillars: BaziPillar[]): boolean {
  const stemsTransparent = pillars.some((pillar) => ELEMENTS[pillar.gan] === transformElement);
  const monthCommand = ELEMENTS[pillars[1].hidden[0] ?? pillars[1].zhi] === transformElement;
  return stemsTransparent || monthCommand;
}

/**
 * 地支六合的化与不化。返回 null 表示不成六合。
 */
export function branchHeTransform(a: string, b: string, pillars: BaziPillar[]): {
  element: string;
  transformed: boolean;
} | null {
  const element = LIU_HE_TRANSFORM[`${a}${b}`] ?? LIU_HE_TRANSFORM[`${b}${a}`];
  if (!element) return null;
  return { element, transformed: canTransform(element, pillars) };
}

/**
 * 天干五合的化与不化。返回 null 表示不成五合。
 */
export function stemHeTransform(a: string, b: string, pillars: BaziPillar[]): {
  element: string;
  transformed: boolean;
} | null {
  const element = GAN_HE_TRANSFORM[`${a}${b}`] ?? GAN_HE_TRANSFORM[`${b}${a}`];
  if (!element) return null;
  return { element, transformed: canTransform(element, pillars) };
}

/**
 * 三合局：检查给定地支集合里各三合组的成员数。三员成局（full），两员为半合（half）。
 */
export function findTrines(branches: string[]): Array<{
  element: string;
  members: string[];
  full: boolean;
}> {
  return SAN_HE.flatMap((group) => {
    const members = group.members.filter((member) => branches.includes(member));
    if (members.length < 2) return [];
    return [{ element: group.element, members, full: members.length === 3 }];
  });
}

export function isXingPair(a: string, b: string) {
  return pairIn(LIU_XING, a, b);
}

export function isSelfXing(branch: string) {
  return SELF_XING.includes(branch);
}

export function isHaiPair(a: string, b: string) {
  return pairIn(LIU_HAI, a, b);
}

export function isPoPair(a: string, b: string) {
  return pairIn(LIU_PO, a, b);
}

export const BRANCH_ELEMENT = ELEMENTS;
