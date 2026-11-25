import assert from "node:assert/strict";
import test from "node:test";
import { isSameBirthProfileInput } from "../lib/birth";
import {
  mergeRelationshipTimelineNotes,
  normalizeRelationshipNotesBackupEntries,
  normalizeRelationshipTimelineNotes,
} from "../lib/relationship-notes";
import { buildAnonymizedCompatibilitySummary } from "../lib/share-card";
import { clearCyberfateLocalData } from "../lib/local-data";
import type { CompatibilityReport } from "../lib/relationship";
import type { BirthProfile } from "../lib/types";

const profile: BirthProfile = {
  id: "profile-a",
  name: "甲",
  date: "1990-01-27",
  time: "08:30",
  timeKnown: true,
  gender: "男",
  longitude: 116.4,
  useTrueSolarTime: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("出生资料比较只忽略记录身份字段，并允许改回原值", () => {
  assert.equal(isSameBirthProfileInput(profile, { ...profile, id: "new-id", createdAt: "2026-02-01T00:00:00.000Z" }), true);
  assert.equal(isSameBirthProfileInput(profile, { ...profile, date: "1990-01-28" }), false);
  assert.equal(isSameBirthProfileInput(profile, { ...profile, timeKnown: false }), false);
  assert.equal(isSameBirthProfileInput(profile, { ...profile, longitude: 121.47 }), false);
  assert.equal(isSameBirthProfileInput(profile, { ...profile, useTrueSolarTime: false }), false);
});

test("关系复盘备份逐条清洗非法年份、状态和文本", () => {
  const notes = normalizeRelationshipTimelineNotes({
    2027: { status: "有对应经历", text: "共同搬家" },
    2028: { status: "非法状态", text: "保留合法文本" },
    1800: { status: "仍不确定" },
    bad: { status: "暂无对应经历" },
    2029: { text: 42 },
  });
  assert.deepEqual(notes, {
    2027: { status: "有对应经历", text: "共同搬家" },
    2028: { text: "保留合法文本" },
  });
});

test("恢复关系复盘时当前浏览器记录优先", () => {
  const merged = mergeRelationshipTimelineNotes(
    { 2027: { status: "仍不确定", text: "本地记录" } },
    { 2027: { status: "有对应经历", text: "备份记录" }, 2028: { status: "暂无对应经历" } },
  );
  assert.deepEqual(merged, {
    2027: { status: "仍不确定", text: "本地记录" },
    2028: { status: "暂无对应经历" },
  });
});

test("仅含孤立关系笔记的 v2 备份仍可恢复", () => {
  const entries = normalizeRelationshipNotesBackupEntries([
    { profileId: "deleted-profile", notes: { 2027: { status: "仍不确定", text: "档案已删除，笔记仍须保留" } } },
  ]);
  assert.deepEqual(entries, [
    { profileId: "deleted-profile", notes: { 2027: { status: "仍不确定", text: "档案已删除，笔记仍须保留" } } },
  ]);
});

test("清除全部本地数据只删除 Cyberfate 命名空间", () => {
  const values = new Map([
    ["cyberfate-history", "[]"],
    ["cyberfate-observations", "[]"],
    ["cyberfate-relationship-notes:profile-a", "{}"],
    ["another-app-setting", "keep"],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
  };

  const removed = clearCyberfateLocalData(storage);
  assert.deepEqual(new Set(removed), new Set([
    "cyberfate-history",
    "cyberfate-observations",
    "cyberfate-relationship-notes:profile-a",
  ]));
  assert.deepEqual([...values.entries()], [["another-app-setting", "keep"]]);
});

test("A/B 分享摘要不接收或输出双方称呼与生辰", () => {
  const report = {
    relationLabel: "相生互补",
    headline: "互动结构具备协同线索",
    dimensions: [{ name: "沟通节奏", status: "互补", detail: "彼此补位", evidence: "规则证据", question: "如何沟通？", limits: "仅供观察" }],
    sharedYears: [],
    personA: {},
    personB: {},
  } as unknown as CompatibilityReport;
  const text = buildAnonymizedCompatibilitySummary(report, false);
  assert.match(text, /A × B/);
  assert.match(text, /分享前请确认对方知情/);
  assert.doesNotMatch(text, /甲|乙|1990|116\.4/);
});
