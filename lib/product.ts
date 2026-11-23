export const ALGORITHM_VERSION = "CF-RULES 1.1 · 2026.11";

export type LocalProductEvent = {
  name: string;
  at: string;
  meta?: Record<string, string | number | boolean>;
};

/** 只记录匿名交互名称和数量，保存在当前浏览器，不写入生辰或姓名。 */
export function trackLocalEvent(name: string, meta?: LocalProductEvent["meta"]) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(localStorage.getItem("cyberfate-local-events") ?? "[]") as LocalProductEvent[];
    const next = [...current, { name, at: new Date().toISOString(), meta }].slice(-200);
    localStorage.setItem("cyberfate-local-events", JSON.stringify(next));
  } catch {
    // 隐私统计不可用时不影响主流程。
  }
}
