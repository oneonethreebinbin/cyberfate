export type ObservationStatus = "pending" | "matches" | "differs" | "uncertain";
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
  matches: { label: "有对应经历", short: "有对应" },
  differs: { label: "暂无对应经历", short: "暂无对应" },
  uncertain: { label: "仍不确定", short: "不确定" },
};

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

export function readObservationRecords(): ObservationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem("cyberfate-observations") ?? "[]");
    return Array.isArray(value) ? value : [];
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
