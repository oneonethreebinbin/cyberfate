import { FORTUNE_STATE_META, buildFortuneReport } from "@/lib/fortune";
import { buildChartReading, type ChartInsight } from "@/lib/insights";
import { analyzeSingleRelationship, type RelationshipSignal } from "@/lib/relationship";
import type { FateChart } from "@/lib/types";
import type { ExploreMode, ObservationIntent } from "@/components/types";
import { ALGORITHM_VERSION } from "@/lib/product";

export type EvidenceSystem = "子平八字" | "紫微斗数" | "岁运规则" | "关系结构";
export type EvidenceStrength = "strong" | "combined" | "observational";
export type ConflictLevel = "none" | "mixed" | "context" | "missing";

export type RuleEvidence = {
  evidenceId: string;
  sourceIds: string[];
  systems: EvidenceSystem[];
  school: string;
  ruleVersion: string;
  strength: { level: EvidenceStrength; label: string; reason: string };
  conditions: string[];
  signals: string[];
  conflict: { level: ConflictLevel; label: string; detail: string };
  missing: string[];
};

type LegacyGuidedTheme = {
  id: string;
  label: string;
  title: string;
  detail: string;
  manifestations: string[];
  evidence: string[];
  boundary: string;
  confidence: "较强信号" | "组合观察" | "待现实核对";
};

type LegacyGuidedQuestion = {
  id: string;
  question: string;
  answer: string;
  evidence: string[];
  boundary: string;
};

type LegacyGuidedReport = {
  intent: ObservationIntent;
  eyebrow: string;
  title: string;
  summary: string;
  recommendation: string;
  themes: LegacyGuidedTheme[];
  questions: LegacyGuidedQuestion[];
  nextMode: ExploreMode;
  nextLabel: string;
};

export type GuidedTheme = Omit<LegacyGuidedTheme, "evidence"> & { evidence: RuleEvidence };
export type GuidedQuestion = Omit<LegacyGuidedQuestion, "evidence"> & { evidence: RuleEvidence };
export type GuidedReport = Omit<LegacyGuidedReport, "themes" | "questions"> & {
  primaryEvidence: RuleEvidence;
  themes: GuidedTheme[];
  questions: GuidedQuestion[];
};

const STRENGTH_META: Record<LegacyGuidedTheme["confidence"], RuleEvidence["strength"]> = {
  "较强信号": { level: "strong", label: "较强信号", reason: "由多项已计算盘面字段共同支持，但仍不等于现实事实。" },
  "组合观察": { level: "combined", label: "组合观察", reason: "结论来自两项以上规则的组合，需要结合现实情境核对。" },
  "待现实核对": { level: "observational", label: "待现实核对", reason: "当前规则只提供观察方向，现实记录是必要证据。" },
};

function evidenceContext(intent: ObservationIntent, id: string) {
  if (intent === "timing") return {
    systems: ["子平八字", "岁运规则"] as EvidenceSystem[],
    school: "子平法 · 原局与大运、流年叠看",
    sourceIds: ["lunar-js", "sanming-tonghui"],
    conditions: ["出生日期与时辰已确认", "四柱按节气口径生成", "流年必须与原局及现行大运共同阅读"],
    missing: ["未纳入现实行业周期与个人资源", "未纳入完整紫微运限四化叠盘"],
  };
  if (intent === "relationship") return {
    systems: ["子平八字", "紫微斗数", "关系结构"] as EvidenceSystem[],
    school: "夫妻宫与地支关系的有限交叉观察",
    sourceIds: ["lunar-js", "sanming-tonghui", "iztro", "iztro-palace"],
    conditions: ["当前仅依据本人命盘", "关系信号用于生成问题而非判定对象", "时间窗口仅表示规则触发"],
    missing: ["未纳入对方资料与双方现实互动", "未纳入依恋、沟通史和当前关系状态"],
  };
  const isZiweiAxis = id.includes("life-body");
  return {
    systems: isZiweiAxis ? ["紫微斗数"] as EvidenceSystem[] : ["子平八字"] as EvidenceSystem[],
    school: isZiweiAxis ? "紫微斗数 · 命身轴与十二宫" : "子平法 · 旺衰与干支结构",
    sourceIds: isZiweiAxis ? ["iztro", "iztro-palace"] : ["lunar-js", "sanming-tonghui"],
    conditions: isZiweiAxis
      ? ["出生时辰已确认", "命宫、身宫按当前排盘口径生成", "单宫不脱离全盘解释"]
      : ["出生日期与时辰已确认", "四柱按节气口径生成", "旺衰与关系必须结合全局而非单字判断"],
    missing: isZiweiAxis
      ? ["未展开全部宫位、四化与运限叠盘", "未纳入现实角色与生活环境"]
      : ["未纳入环境、教育与重大经历", "传统规则未经过针对本人的实证验证"],
  };
}

function inferConflict(intent: ObservationIntent, id: string, signals: string[]): RuleEvidence["conflict"] {
  const text = signals.join(" ");
  if (/相反|同时|牵制|混合|助势|制约/.test(text)) return { level: "mixed", label: "存在并行信号", detail: "盘面同时出现方向不同的规则，不能压缩成单一吉凶或人格标签。" };
  if (intent === "relationship") return { level: "context", label: "缺少另一方与情境", detail: "本人盘只能说明观察入口，不能替双方关系作结论。" };
  if (/未取得|暂未|没有/.test(text)) return { level: "missing", label: "资料或规则缺失", detail: "当前缺少支撑字段，因此结论强度已下调。" };
  if (id.includes("life-body") || id.includes("window")) return { level: "context", label: "需要现实情境", detail: "盘面信号没有直接冲突，但其现实表现会随角色、选择和环境变化。" };
  return { level: "none", label: "未见直接冲突", detail: "当前纳入的规则方向基本一致；仍需保留现实反例。" };
}

function structureEvidence(intent: ObservationIntent, id: string, signals: string[], confidence: LegacyGuidedTheme["confidence"]): RuleEvidence {
  const context = evidenceContext(intent, id);
  return {
    evidenceId: `ev-${intent}-${id}`,
    sourceIds: context.sourceIds,
    systems: context.systems,
    school: context.school,
    ruleVersion: ALGORITHM_VERSION,
    strength: STRENGTH_META[confidence],
    conditions: context.conditions,
    signals,
    conflict: inferConflict(intent, id, signals),
    missing: context.missing,
  };
}

function structureReport(report: LegacyGuidedReport): GuidedReport {
  const themes = report.themes.map((theme) => ({
    ...theme,
    evidence: structureEvidence(report.intent, theme.id, theme.evidence, theme.confidence),
  }));
  const questions = report.questions.map((question) => ({
    ...question,
    evidence: structureEvidence(report.intent, question.id, question.evidence, "待现实核对"),
  }));
  return {
    ...report,
    themes,
    questions,
    primaryEvidence: {
      ...themes[0].evidence,
      evidenceId: `ev-${report.intent}-primary`,
      sourceIds: [...new Set(themes.flatMap((theme) => theme.evidence.sourceIds))],
      systems: [...new Set(themes.flatMap((theme) => theme.evidence.systems))],
      school: [...new Set(themes.map((theme) => theme.evidence.school))].join("；"),
      strength: STRENGTH_META["组合观察"],
      conditions: [...new Set(themes.flatMap((theme) => theme.evidence.conditions))],
      signals: themes.flatMap((theme) => theme.evidence.signals.slice(0, 1)),
      conflict: themes.find((theme) => theme.evidence.conflict.level !== "none")?.evidence.conflict ?? themes[0].evidence.conflict,
      missing: [...new Set(themes.flatMap((theme) => theme.evidence.missing))],
    },
  };
}

// 导读条目或信号缺失时的兜底：宁可少一条证据，不让首屏塌掉。
function fallbackInsight(id: string, title: string): ChartInsight {
  return {
    id,
    index: "",
    label: "暂缺",
    title,
    summary: "该条导读未按预期生成，请回到完整盘面对应面板查看。",
    plain: "本条导读暂未生成；盘面字段仍在，宜直接查看完整盘面，勿据此占位作断。",
    manifestations: [],
    evidence: ["该条导读缺失，未取得盘面依据"],
    alternative: "回到完整盘面对应面板阅读。",
    limits: "此为兜底占位，不代表传统规则无此论法。",
    tone: "neutral",
  };
}

function fallbackSignal(title: string, detail: string): RelationshipSignal {
  return {
    title,
    value: detail,
    detail,
    evidence: "该叙述未按预期生成，仅保留盘面坐标。",
    alternative: "回到完整盘面阅读，勿据此单点作断。",
    limits: "此为兜底占位，不代表传统规则无此论法。",
    reflection: "先记录现实情况，再核对完整盘面。",
    tone: "neutral",
  };
}

function selfReport(chart: FateChart): LegacyGuidedReport {
  const reading = buildChartReading(chart);
  const byId = new Map(reading.insights.map((item) => [item.id, item]));
  const strength = byId.get("day-master") ?? fallbackInsight("day-master", "日主旺衰");
  const relations = byId.get("branch-network") ?? fallbackInsight("branch-network", "地支关系");
  const lifeBody = byId.get("life-body-axis") ?? fallbackInsight("life-body-axis", "命身轴线");
  const visible = byId.get("visible-patterns") ?? fallbackInsight("visible-patterns", "常见误读");

  return {
    intent: "self",
    eyebrow: "先回答你 · 了解自己",
    title: strength.plain.split("。")[0] + "。",
    summary: `${relations.plain} ${lifeBody.plain}`,
    recommendation: chart.bazi.strength.verdict === "身弱"
      ? "先辨认哪些资源、协作和准备会显著改善你的状态，再决定是否增加承担。"
      : chart.bazi.strength.verdict === "身强"
        ? "把已有能量集中到少数可兑现的事情上，同时为休息和交接留下位置。"
        : "记录不同环境下状态的变化，比急着寻找一个固定性格标签更有价值。",
    themes: [
      {
        id: strength.id,
        label: "你的发挥条件",
        title: strength.title,
        detail: strength.plain,
        manifestations: strength.manifestations,
        evidence: strength.evidence.slice(0, 3),
        boundary: strength.limits,
        confidence: "较强信号",
      },
      {
        id: relations.id,
        label: "容易反复的张力",
        title: relations.title,
        detail: relations.plain,
        manifestations: relations.manifestations,
        evidence: relations.evidence.slice(0, 3),
        boundary: relations.limits,
        confidence: "组合观察",
      },
      {
        id: lifeBody.id,
        label: "内在与行动",
        title: lifeBody.title,
        detail: lifeBody.plain,
        manifestations: lifeBody.manifestations,
        evidence: lifeBody.evidence,
        boundary: lifeBody.limits,
        confidence: "待现实核对",
      },
    ],
    questions: [
      {
        id: "self-environment",
        question: "我在什么环境里更容易发挥？",
        answer: strength.plain,
        evidence: strength.evidence.slice(0, 2),
        boundary: strength.alternative,
      },
      {
        id: "self-repeating",
        question: "哪些问题可能反复要求我调整？",
        answer: relations.plain,
        evidence: relations.evidence.slice(0, 2),
        boundary: relations.alternative,
      },
      {
        id: "self-misread",
        question: "这张盘最不该被怎样误读？",
        answer: visible.plain,
        evidence: visible.evidence,
        boundary: visible.alternative,
      },
    ],
    nextMode: "self",
    nextLabel: "展开完整自我观察",
  };
}

function timingReport(chart: FateChart): LegacyGuidedReport {
  const report = buildFortuneReport(chart);
  const current = report.current;
  const meta = FORTUNE_STATE_META[current.state];
  const nextDistinct = report.years.find((item) => item.year !== current.year && item.state !== current.state) ?? report.years[1] ?? current;
  const nextMeta = FORTUNE_STATE_META[nextDistinct.state];
  const daYun = report.currentDaYun;

  return {
    intent: "timing",
    eyebrow: "先回答你 · 阶段变化",
    title: `${current.year} 年的主调是“${meta.label}”：${meta.explanation}`,
    summary: `${meta.subtitle}${daYun ? ` 当前同时处于 ${daYun.ganZhi} 大运（${daYun.startYear}–${daYun.endYear}），流年需要放在这段十年背景里看。` : ""}`,
    recommendation: current.observation,
    themes: [
      {
        id: `timing-${current.year}`,
        label: "当前阶段",
        title: `${current.year} · ${meta.label}`,
        detail: meta.explanation,
        manifestations: [current.observation, current.counterpoint],
        evidence: current.evidence.slice(0, 4),
        boundary: "流年标签描述规则组合，不是成功率、风险概率或必然事件。",
        confidence: "较强信号",
      },
      {
        id: "timing-dayun",
        label: "十年背景",
        title: daYun ? `现行大运 ${daYun.ganZhi}` : "现行大运暂未定位",
        detail: daYun
          ? `这一步大运覆盖 ${daYun.startYear}–${daYun.endYear}，当前流年的支持、压力和变化信号需要与它叠看。`
          : "当前资料没有定位到可用的大运区间，因此不进一步延伸十年判断。",
        manifestations: ["先区分长期背景与当年触发，避免用一年概括整个阶段。", "现实中的资源、责任和选择仍比单个标签更重要。"],
        evidence: daYun ? [`大运：${daYun.ganZhi}`, `起止年份：${daYun.startYear}–${daYun.endYear}`] : ["未取得现行大运"],
        boundary: "大运只提供传统时间背景；当前未纳入完整藏干权重与紫微运限四化叠盘。",
        confidence: daYun ? "组合观察" : "待现实核对",
      },
      {
        id: `timing-${nextDistinct.year}`,
        label: "下一处变化",
        title: `${nextDistinct.year} · ${nextMeta.label}`,
        detail: nextMeta.explanation,
        manifestations: [nextDistinct.observation, nextDistinct.counterpoint],
        evidence: nextDistinct.evidence.slice(0, 3),
        boundary: "年份只用于安排观察，不宜单独决定辞职、投资、婚育或其他重大事项。",
        confidence: "待现实核对",
      },
    ],
    questions: [
      {
        id: "timing-pace",
        question: "现在更适合推进，还是先调整？",
        answer: current.observation,
        evidence: current.evidence.slice(0, 3),
        boundary: current.counterpoint,
      },
      {
        id: "timing-pressure",
        question: "当前压力或助力主要来自哪里？",
        answer: `当前规则计数为：助势 ${current.scores.support}、制约 ${current.scores.pressure}、动象 ${current.scores.movement}、耗势 ${current.scores.depletion}。应分别核对，不把它们压成一个吉凶分数。`,
        evidence: current.evidence.slice(0, 4),
        boundary: "计数表示规则命中数量，不表示真实事件强度。",
      },
      {
        id: "timing-next",
        question: "下一段值得提前留意什么？",
        answer: `${nextDistinct.year} 年呈现“${nextMeta.label}”。${nextDistinct.observation}`,
        evidence: nextDistinct.evidence.slice(0, 3),
        boundary: nextDistinct.counterpoint,
      },
    ],
    nextMode: "timing",
    nextLabel: "查看完整六年时间线",
  };
}

function relationshipReport(chart: FateChart): LegacyGuidedReport {
  const report = analyzeSingleRelationship(chart);
  // 信号以标题定位（关系报告未提供结构化叙述键）；缺条时退回盘面字段占位，不让页面塌掉。
  const spouse = report.signals.find((item) => item.title === "夫妻宫坐标")
    ?? fallbackSignal("夫妻宫坐标", `夫妻宫落 ${report.spousePalace}，配偶星属${report.spouseElement}（${report.spouseDirection}）。`);
  const tension = report.signals.find((item) => item.title === "关系张力")
    ?? fallbackSignal("关系张力", "日支关系信号暂未生成；宜回到完整盘面查看地支关系面板。");
  const ziwei = report.signals.find((item) => item.title === "紫微夫妻宫")
    ?? fallbackSignal("紫微夫妻宫", `紫微夫妻宫位于 ${report.couplePalace.name}，主星叙述暂未生成。`);
  const notableYear = report.timeline.find((item) => item.level !== "平稳") ?? report.timeline[0];

  return {
    intent: "relationship",
    eyebrow: "先回答你 · 关系议题",
    title: `${spouse.detail}`,
    summary: `${tension.detail} ${ziwei.detail}`,
    recommendation: "先把亲密距离、责任分配和变化节奏拆开讨论；关系结构只提供提问方向，不替双方判定合或不合。",
    themes: [
      {
        id: "relationship-entry",
        label: "关系进入方式",
        title: spouse.title,
        detail: spouse.detail,
        manifestations: [spouse.reflection, spouse.alternative],
        evidence: [spouse.evidence],
        boundary: spouse.limits,
        confidence: "组合观察",
      },
      {
        id: "relationship-tension",
        label: "磨合与边界",
        title: tension.value,
        detail: tension.detail,
        manifestations: [tension.reflection, tension.alternative],
        evidence: [tension.evidence],
        boundary: tension.limits,
        confidence: "待现实核对",
      },
      {
        id: "relationship-window",
        label: "时间窗口",
        title: `${notableYear.year} · ${notableYear.level}`,
        detail: notableYear.reasons.join("；"),
        manifestations: ["把这一年作为观察窗口，而不是婚恋事件的预告。", "记录现实中的靠近、调整或边界变化，再回来核对。"],
        evidence: [`${notableYear.year} ${notableYear.ganZhi}`, ...notableYear.reasons],
        boundary: "活跃不等于成婚，转折不等于离散；双方处境与选择未包含在盘面中。",
        confidence: "待现实核对",
      },
    ],
    questions: [
      {
        id: "relationship-pattern",
        question: "我在关系里最需要先看什么？",
        answer: `${spouse.detail} ${spouse.reflection}`,
        evidence: [spouse.evidence],
        boundary: spouse.alternative,
      },
      {
        id: "relationship-friction",
        question: "关系反复时，应该核对什么？",
        answer: `${tension.detail} ${tension.reflection}`,
        evidence: [tension.evidence],
        boundary: tension.alternative,
      },
      {
        id: "relationship-year",
        question: "未来几年哪一处值得多观察？",
        answer: `${notableYear.year} 年为“${notableYear.level}”观察窗：${notableYear.reasons.join("；")}。`,
        evidence: [`流年：${notableYear.ganZhi}`],
        boundary: "这不是事件预测，只表示当前有限规则出现了较集中触发。",
      },
    ],
    nextMode: "relationship",
    nextLabel: "查看关系结构与合盘",
  };
}

export function buildGuidedReport(chart: FateChart, intent: ObservationIntent): GuidedReport {
  const report = intent === "timing" ? timingReport(chart) : intent === "relationship" ? relationshipReport(chart) : selfReport(chart);
  return structureReport(report);
}
