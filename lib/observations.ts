export type ObservationStatus = "pending" | "matches" | "partial" | "differs" | "uncertain";
export type ObservationSource = "insight" | "time" | "relationship" | "manual";

export interface ObservationRecord {
  id: string;
  profileId: string;
  profileName: string;
  source: ObservationSource;
  sourceId: string;
  title: string;
  question: string;
  status: ObservationStatus;
  note: string;
  observedOn: string;
  createdAt: string;
  reviewedAt?: string;
  /** 用户希望再次核对这条观察的本地日期。 */
  reviewOn?: string;
}

export const OBSERVATION_STATUS_META: Record<ObservationStatus, { label: string; short: string }> = {
  pending: { label: "等待观察", short: "待观察" },
  matches: { label: "符合", short: "符合" },
  partial: { label: "部分符合", short: "部分符合" },
  differs: { label: "不符合", short: "不符合" },
  uncertain: { label: "暂不确定", short: "暂不确定" },
};

export type ObservationDraft = Pick<ObservationRecord,
  "source" | "sourceId" | "title" | "question" | "status" | "note" | "observedOn" | "reviewOn"
>;

export const INSIGHT_QUESTIONS: Record<string, string> = {
  "day-master": "最近面对压力或机会时，哪些做法让你更有余力，哪些会明显消耗你？",
  "branch-network": "这段时间有哪些连接与变化同时发生？它们彼此推动，还是互相牵制？",
  "visible-patterns": "盘面数量上的强弱，是否真的对应你的现实体验？有哪些反例？",
  "life-body-axis": "你对自己的理解，与现实中承担的角色是否一致？差异出现在哪里？",
  "mutagen-paths": "哪些生活领域最近反复吸引你的注意、责任或担忧？",
};

export function questionForInsight(insightId: string) {
  return INSIGHT_QUESTIONS[insightId] ?? "这条观察在现实中有什么对应或反例？";
}

const OBSERVATION_SOURCES: ObservationSource[] = ["insight", "time", "relationship", "manual"];

/** 逐条校验本地存储中的观测记录；localStorage 可能被手工编辑或被旧版本写入。 */
export function isObservationRecord(value: unknown): value is ObservationRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ObservationRecord>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.profileId === "string" &&
    typeof item.profileName === "string" &&
    typeof item.source === "string" && OBSERVATION_SOURCES.includes(item.source as ObservationSource) &&
    typeof item.sourceId === "string" &&
    typeof item.title === "string" &&
    typeof item.question === "string" &&
    typeof item.status === "string" && item.status in OBSERVATION_STATUS_META &&
    typeof item.note === "string" &&
    typeof item.observedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.observedOn) &&
    typeof item.createdAt === "string"
  );
}

export function readObservationRecords(): ObservationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem("cyberfate-observations") ?? "[]");
    return Array.isArray(value) ? value.filter(isObservationRecord) : [];
  } catch {
    return [];
  }
}

export function writeObservationRecords(records: ObservationRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("cyberfate-observations", JSON.stringify(records));
  } catch {
    // 隐私模式或空间不足时保留当前会话状态。
  }
}

export function createObservationRecord(input: Omit<ObservationRecord, "id" | "status" | "note" | "createdAt">): ObservationRecord {
  return {
    ...input,
    id: crypto.randomUUID(),
    status: "pending",
    note: "",
    createdAt: new Date().toISOString(),
  };
}
