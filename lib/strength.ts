import type { BaziPillar, DayMasterStrength, StrengthVerdict } from "@/lib/types";

const ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  子: "水", 亥: "水", 寅: "木", 卯: "木", 巳: "火", 午: "火", 申: "金", 酉: "金", 辰: "土", 戌: "土", 丑: "土", 未: "土",
};
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const TEN_GOD_NAME: Record<string, string> = {
  same: "比劫", generate: "印", generated: "食伤", control: "财", controlled: "官杀",
};

// 地支藏干权重：本气最强，中气次之，余气最弱（传统简法）。
const HIDDEN_WEIGHT = [15, 8, 5];

function relationToDayMaster(element: string, dayElement: string): keyof typeof TEN_GOD_NAME {
  if (element === dayElement) return "same";
  if (GENERATES[element] === dayElement) return "generate";
  if (GENERATES[dayElement] === element) return "generated";
  if (CONTROLS[element] === dayElement) return "controlled";
  return "control";
}

function godName(relation: keyof typeof TEN_GOD_NAME) {
  return TEN_GOD_NAME[relation];
}

/**
 * 以月令为本、地支藏干为根、天干为势，作日主旺衰的表层近似判定。
 * 这是简化的扶抑参考，未纳入合化、调候与格局取用，结果只用于给生克信号定喜忌方向。
 */
export function analyzeDayMasterStrength(pillars: BaziPillar[]): DayMasterStrength {
  const dayPillar = pillars[2];
  const dayElement = ELEMENTS[dayPillar.gan];
  const monthBranch = pillars[1].zhi;
  const monthMainElement = ELEMENTS[monthBranch];
  const monthRelation = relationToDayMaster(monthMainElement, dayElement);

  let score = 0;
  const evidence: string[] = [];

  const commandScores: Record<keyof typeof TEN_GOD_NAME, { score: number; note: string }> = {
    same: { score: 40, note: `月令${monthBranch}（${monthMainElement}）与日主同气，日主得令` },
    generate: { score: 30, note: `月令${monthBranch}（${monthMainElement}）生日主，得令相生` },
    generated: { score: 8, note: `日主生月令${monthBranch}（${monthMainElement}），失令泄气` },
    control: { score: 10, note: `日主克月令${monthBranch}（${monthMainElement}），失令耗身` },
    controlled: { score: 5, note: `月令${monthBranch}（${monthMainElement}）克日主，失令受制` },
  };
  const command = commandScores[monthRelation];
  score += command.score;
  evidence.push(`${command.note}（旺衰权重 ${command.score}）`);

  let mainRoots = 0;
  let minorRoots = 0;
  for (const pillar of pillars) {
    pillar.hidden.forEach((hiddenGan, index) => {
      if (ELEMENTS[hiddenGan] !== dayElement) return;
      const weight = HIDDEN_WEIGHT[index] ?? 5;
      score += weight;
      evidence.push(`${pillar.label}${pillar.zhi}藏干${hiddenGan}为日主${index === 0 ? "本气强根" : index === 1 ? "中气根" : "余气根"}（+${weight}）`);
      if (index === 0) mainRoots += 1;
      else minorRoots += 1;
    });
  }
  if (!mainRoots && !minorRoots) evidence.push(`四支藏干未见日主${dayElement}之根，日主无根`); 

  const others = pillars.filter((_, index) => index !== 2);
  const supportTally: Record<string, number> = { 比劫: 0, 印: 0, 食伤: 0, 财: 0, 官杀: 0 };
  for (const pillar of others) {
    const relation = relationToDayMaster(ELEMENTS[pillar.gan], dayElement);
    const name = godName(relation);
    supportTally[name] += 1;
    if (relation === "same") score += 8;
    if (relation === "generate") score += 6;
  }
  if (supportTally.比劫 || supportTally.印) {
    evidence.push(`年月时三干见比劫 ${supportTally.比劫} 位、印 ${supportTally.印} 位帮扶日主`);
  } else {
    evidence.push("年月时三干无比劫与印帮扶，天干不得势");
  }

  const verdict: StrengthVerdict = score >= 70 ? "身强" : score <= 40 ? "身弱" : "中和";
  const commandNote = command.note.split("（")[0];

  // 扶抑取用（简化）：身强喜克泄耗，身弱喜生扶，中和不作单向判断。
  const favorableByVerdict: Record<StrengthVerdict, string[]> = {
    身强: [godName("control") + "（我克）", godName("generated") + "（我生）", godName("controlled") + "（克我）"],
    身弱: [godName("generate") + "（生我）", godName("same") + "（同气）"],
    中和: [],
  };
  const unfavorableByVerdict: Record<StrengthVerdict, string[]> = {
    身强: [godName("generate") + "（生我）", godName("same") + "（同气）"],
    身弱: [godName("control") + "（我克）", godName("generated") + "（我生）", godName("controlled") + "（克我）"],
    中和: [],
  };

  return {
    verdict,
    score,
    commandNote,
    evidence,
    favorable: favorableByVerdict[verdict],
    unfavorable: unfavorableByVerdict[verdict],
  };
}

/**
 * 十神定名：任一五行相对日主的十神类别，用于给流年/大运信号定喜忌方向。
 */
export function tenGodOf(element: string, dayElement: string): string {
  return godName(relationToDayMaster(element, dayElement));
}

/**
 * 依旺衰判定给某五行定喜忌方向。
 */
export function favorDirection(strength: DayMasterStrength, element: string, dayElement: string): "喜" | "忌" | "平" {
  if (strength.verdict === "中和") return "平";
  const god = tenGodOf(element, dayElement);
  const isFavorable = strength.favorable.some((item) => item.startsWith(god));
  const isUnfavorable = strength.unfavorable.some((item) => item.startsWith(god));
  if (isFavorable) return "喜";
  if (isUnfavorable) return "忌";
  return "平";
}
