import assert from "node:assert/strict";
import { test } from "node:test";
import { isObservationRecord, readObservationRecords, type ObservationRecord, type ObservationSource, type ObservationStatus } from "../lib/observations";

function validRecord(overrides: Partial<ObservationRecord> = {}): ObservationRecord {
  return {
    id: "rec-1",
    profileId: "profile-1",
    profileName: "测试档案",
    source: "insight",
    sourceId: "day-master",
    title: "日主观察",
    question: "最近哪些做法让你更有余力？",
    status: "pending",
    note: "",
    observedOn: "2026-11-23",
    createdAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

test("合法观测记录通过校验", () => {
  assert.equal(isObservationRecord(validRecord()), true);
  assert.equal(isObservationRecord(validRecord({ status: "matches" })), true);
  assert.equal(isObservationRecord(validRecord({ status: "partial" })), true);
  assert.equal(isObservationRecord(validRecord({ source: "manual" })), true);
  assert.equal(isObservationRecord(validRecord({ reviewOn: "2026-12-23" })), true);
});

test("非法观测记录被拒绝", () => {
  assert.equal(isObservationRecord(null), false);
  assert.equal(isObservationRecord("text"), false);
  assert.equal(isObservationRecord({}), false);
  assert.equal(isObservationRecord(validRecord({ id: "" })), false, "空编号无效");
  assert.equal(isObservationRecord(validRecord({ status: "unknown-status" as ObservationStatus })), false, "未知状态会击穿状态表");
  assert.equal(isObservationRecord(validRecord({ source: "hacked" as ObservationSource })), false, "未知来源无效");
  assert.equal(isObservationRecord(validRecord({ observedOn: "2026/11/23" })), false, "日期必须是 YYYY-MM-DD");
  assert.equal(isObservationRecord(validRecord({ note: undefined })), false, "缺字段无效");
});

test("无 window 环境下读取返回空数组", () => {
  assert.deepEqual(readObservationRecords(), []);
});
