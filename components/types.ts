import type { BirthProfile } from "@/lib/types";

export type Tab = "overview" | "explore" | "observations" | "expert";
export type ExpertMode = "bazi" | "ziwei";
export type ExploreMode = "self" | "timing" | "relationship";
export type ViewMode = ExpertMode | ExploreMode;
export type ObservationIntent = "self" | "timing" | "relationship";

export function handleTabArrow<T extends string>(event: React.KeyboardEvent<HTMLButtonElement>, items: readonly T[], current: T, select: (item: T) => void, idPrefix: string) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = items.indexOf(current);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  const next = items[nextIndex];
  select(next);
  window.requestAnimationFrame(() => document.getElementById(`${idPrefix}${next}`)?.focus());
}

export const INITIAL_PROFILE: BirthProfile = {
  id: "draft",
  name: "",
  date: "",
  time: "",
  timeKnown: true,
  gender: "男",
  longitude: 116.4,
  useTrueSolarTime: true,
  createdAt: new Date().toISOString(),
};

export const SAMPLE_PROFILE: BirthProfile = {
  ...INITIAL_PROFILE,
  id: "sample",
  name: "示例命盘",
  date: "1990-01-27",
  time: "08:30",
  gender: "男",
};

export const TAB_ITEMS: { id: Tab; label: string; hint: string }[] = [
  { id: "overview", label: "先看结论", hint: "一分钟读懂" },
  { id: "explore", label: "按问题看", hint: "自己·时间·关系" },
  { id: "observations", label: "我的验证", hint: "记录与复盘" },
  { id: "expert", label: "专业盘", hint: "八字与紫微" },
];

export const INTENT_OPTIONS: Array<{ id: ObservationIntent; label: string; title: string; detail: string }> = [
  { id: "self", label: "了解自己", title: "我想先看自己", detail: "从命盘主轴与结构开始，不急着下结论。" },
  { id: "timing", label: "阶段变化", title: "我正经历变化", detail: "观察未来六年的支持、制约与变动信号。" },
  { id: "relationship", label: "关系议题", title: "我关心一段关系", detail: "先看自己的关系结构，也可以继续做双人合盘。" },
];
