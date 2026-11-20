import { Solar } from "lunar-javascript";
import type { FateChart } from "@/lib/types";

const STEM_ELEMENT: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const LIU_HE = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const CHONG = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
const GAN_HE = ["甲己", "乙庚", "丙辛", "丁壬", "戊癸"];

function pairIn(pairs: string[], a: string, b: string) {
  return pairs.includes(`${a}${b}`) || pairs.includes(`${b}${a}`);
}

function peachBlossom(branch: string) {
  if ("申子辰".includes(branch)) return "酉";
  if ("寅午戌".includes(branch)) return "卯";
  if ("亥卯未".includes(branch)) return "子";
  return "午";
}

function spouseElement(chart: FateChart) {
  const dayElement = STEM_ELEMENT[chart.bazi.pillars[2].gan];
  if (chart.profile.gender === "男") return CONTROLS[dayElement];
  return Object.keys(CONTROLS).find((element) => CONTROLS[element] === dayElement) ?? "";
}

export interface RelationshipSignal {
  title: string;
  value: string;
  detail: string;
  evidence: string;
  tone: "jade" | "gold" | "vermilion" | "neutral";
}

export interface RelationshipYear {
  year: number;
  ganZhi: string;
  level: "活跃" | "转折" | "平稳";
  reasons: string[];
}

export interface SingleRelationshipReport {
  spousePalace: string;
  spouseElement: string;
  peachBranch: string;
  couplePalace: FateChart["ziwei"]["palaces"][number];
  signals: RelationshipSignal[];
  timeline: RelationshipYear[];
}

export function analyzeSingleRelationship(chart: FateChart, startYear = new Date().getFullYear()): SingleRelationshipReport {
  const dayBranch = chart.bazi.pillars[2].zhi;
  const branches = chart.bazi.pillars.map((pillar) => pillar.zhi);
  const spouse = spouseElement(chart);
  const peach = peachBlossom(dayBranch);
  const spouseCount = chart.bazi.elementCounts[spouse] ?? 0;
  const couplePalace = chart.ziwei.palaces.find((palace) => palace.name === "夫妻") ?? chart.ziwei.palaces[0];
  const coupleMajor = couplePalace.stars.filter((star) => star.type === "major").map((star) => star.name);
  const combined = branches.filter((branch) => pairIn(LIU_HE, dayBranch, branch)).length;
  const clashes = branches.filter((branch) => pairIn(CHONG, dayBranch, branch)).length;

  const signals: RelationshipSignal[] = [
    {
      title: "夫妻宫坐标",
      value: `${dayBranch}支`,
      detail: combined ? `与原局存在 ${combined} 处六合联系，关系议题容易与生活结构联动。` : "原局未见明显六合，关系节奏更依赖双方后天经营。",
      evidence: `八字 · 日支${dayBranch}为夫妻宫`,
      tone: combined ? "jade" : "neutral",
    },
    {
      title: "配偶星线索",
      value: `${spouse} · ${spouseCount ? "有显" : "表层不显"}`,
      detail: spouseCount ? `四柱表层出现${spouse}五行 ${spouseCount} 次，可继续结合藏干与月令判断。` : `四柱表层未见${spouse}五行，不代表没有缘分，需进一步观察藏干与运限。`,
      evidence: `八字 · ${chart.profile.gender === "男" ? "财星" : "官杀"}取${spouse}`, tone: spouseCount ? "gold" : "neutral",
    },
    {
      title: "桃花触发点",
      value: `${peach}支`,
      detail: branches.includes(peach) ? `原局包含${peach}，社交吸引议题较容易被看见。` : `原局表层未见${peach}，逢${peach}的运年可重点观察社交变化。`,
      evidence: `八字 · 以日支${dayBranch}查咸池`, tone: branches.includes(peach) ? "vermilion" : "neutral",
    },
    {
      title: "紫微夫妻宫",
      value: `${couplePalace.ganZhi} · ${coupleMajor.join("、") || "空宫"}`,
      detail: coupleMajor.length ? `夫妻宫主星为${coupleMajor.join("、")}，解读时还需连同命宫、福德宫及三方四正。` : "夫妻宫为空宫，应借对宫并结合三方四正观察，不单以空宫下结论。",
      evidence: `紫微 · ${couplePalace.ganZhi}夫妻宫`, tone: "gold",
    },
    {
      title: "关系张力",
      value: clashes ? `${clashes} 处冲动` : "表层平稳",
      detail: clashes ? "冲不必然等于分离，也可能表现为关系推进、环境变化或边界重建。" : "四柱地支未见夫妻宫直接相冲，仍需结合岁运判断具体变化。",
      evidence: `八字 · 日支与其余三支合冲`, tone: clashes ? "vermilion" : "jade",
    },
  ];

  const timeline = Array.from({ length: 5 }, (_, index) => {
    const year = startYear + index;
    const yearEight = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getEightChar();
    const gan = yearEight.getYearGan();
    const zhi = yearEight.getYearZhi();
    const reasons: string[] = [];
    let active = 0;
    let turning = 0;
    if (zhi === peach) { active += 2; reasons.push(`流年${zhi}触发桃花位`); }
    if (pairIn(LIU_HE, dayBranch, zhi)) { active += 2; reasons.push(`流年与夫妻宫${dayBranch}六合`); }
    if (STEM_ELEMENT[gan] === spouse) { active += 1; reasons.push(`流年天干显${spouse}配偶星`); }
    if (pairIn(CHONG, dayBranch, zhi)) { turning += 2; reasons.push(`流年冲动夫妻宫${dayBranch}`); }
    if (!reasons.length) reasons.push("未见表层强触发，适合观察日常关系积累");
    return {
      year,
      ganZhi: `${gan}${zhi}`,
      level: turning >= 2 ? "转折" : active >= 2 ? "活跃" : "平稳",
      reasons,
    } as RelationshipYear;
  });

  return { spousePalace: dayBranch, spouseElement: spouse, peachBranch: peach, couplePalace, signals, timeline };
}

export interface CompatibilityDimension {
  name: string;
  status: "协同" | "互补" | "中性" | "需经营";
  detail: string;
  evidence: string;
}

export interface CompatibilityReport {
  relationLabel: string;
  headline: string;
  dimensions: CompatibilityDimension[];
  sharedYears: number[];
  personA: SingleRelationshipReport;
  personB: SingleRelationshipReport;
}

export function analyzeCompatibility(a: FateChart, b: FateChart): CompatibilityReport {
  const aDay = a.bazi.pillars[2];
  const bDay = b.bazi.pillars[2];
  const aElement = STEM_ELEMENT[aDay.gan];
  const bElement = STEM_ELEMENT[bDay.gan];
  const stemCombined = pairIn(GAN_HE, aDay.gan, bDay.gan);
  const branchCombined = pairIn(LIU_HE, aDay.zhi, bDay.zhi);
  const branchClash = pairIn(CHONG, aDay.zhi, bDay.zhi);
  const generates = GENERATES[aElement] === bElement || GENERATES[bElement] === aElement;
  const controls = CONTROLS[aElement] === bElement || CONTROLS[bElement] === aElement;
  const reportA = analyzeSingleRelationship(a);
  const reportB = analyzeSingleRelationship(b);
  const activeA = reportA.timeline.filter((item) => item.level !== "平稳").map((item) => item.year);
  const activeB = reportB.timeline.filter((item) => item.level !== "平稳").map((item) => item.year);
  const sharedYears = activeA.filter((year) => activeB.includes(year));

  const dimensions: CompatibilityDimension[] = [
    {
      name: "吸引机制",
      status: stemCombined || branchCombined ? "协同" : generates ? "互补" : "中性",
      detail: stemCombined ? `双方日干${aDay.gan}${bDay.gan}形成五合，容易产生彼此关注的牵引。` : branchCombined ? `双方夫妻宫${aDay.zhi}${bDay.zhi}形成六合，关系连接感较明显。` : generates ? `双方日主${aElement}${bElement}相生，互动中容易形成支持与补位。` : "日柱未见直接合局，吸引力更依赖共同经历与现实互动。",
      evidence: `双方日柱：${aDay.gan}${aDay.zhi} / ${bDay.gan}${bDay.zhi}`,
    },
    {
      name: "沟通节奏",
      status: aElement === bElement ? "协同" : generates ? "互补" : controls ? "需经营" : "中性",
      detail: aElement === bElement ? `双方日主同属${aElement}，理解方式可能较接近，也要留意相似盲点。` : generates ? "五行相生提供自然的给予—回应路径，但应避免固定为单向付出。" : controls ? "日主五行存在相克关系，容易形成推动，也可能被体验为压力或挑剔。" : "五行关系没有直接生克，需要通过明确表达建立沟通习惯。",
      evidence: `日主五行：${a.bazi.dayMaster} / ${b.bazi.dayMaster}`,
    },
    {
      name: "冲突触发",
      status: branchClash ? "需经营" : branchCombined ? "协同" : "中性",
      detail: branchClash ? `双方日支${aDay.zhi}${bDay.zhi}相冲，重要议题上可能节奏相反；冲也可能带来快速推进和改变。` : branchCombined ? "双方日支六合，处理分歧时较容易寻找共同立场。" : "夫妻宫之间无直接合冲，冲突更取决于具体生活分工与沟通方式。",
      evidence: "双方日支合冲关系",
    },
    {
      name: "长期结构",
      status: (a.bazi.elementCounts[reportB.spouseElement] ?? 0) && (b.bazi.elementCounts[reportA.spouseElement] ?? 0) ? "互补" : "中性",
      detail: `A 的配偶星取${reportA.spouseElement}，B 的配偶星取${reportB.spouseElement}。是否适合长期关系，还需要现实价值观、责任分配与人生阶段验证。`,
      evidence: "双方配偶星与五行分布",
    },
    {
      name: "时间协调",
      status: sharedYears.length ? "协同" : "中性",
      detail: sharedYears.length ? `未来五年双方共同出现关系触发信号的年份有 ${sharedYears.join("、")}，适合留意共同计划与关系变化。` : "未来五年的表层触发年份暂未重合，不等于关系无发展，个人选择与现实条件更关键。",
      evidence: "双方夫妻宫、桃花位与流年表层触发",
    },
  ];

  const positives = dimensions.filter((item) => item.status === "协同" || item.status === "互补").length;
  const tensions = dimensions.filter((item) => item.status === "需经营").length;
  const headline = tensions ? "有牵引，也需要建立清晰的相处边界" : positives >= 3 ? "互动结构具备多处协同线索" : "关系潜力更依赖共同经历与现实经营";
  const relationLabel = stemCombined || branchCombined ? "合中有别" : branchClash ? "动中求稳" : generates ? "相生互补" : "并行相识";

  return { relationLabel, headline, dimensions, sharedYears, personA: reportA, personB: reportB };
}
