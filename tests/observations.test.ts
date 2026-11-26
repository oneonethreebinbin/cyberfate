import assert from "node:assert/strict";
import { test } from "node:test";
import { getObservationSufficiency, isObservationRecord, readObservationRecords, type ObservationRecord, type ObservationSource, type ObservationStatus } from "../lib/observations";

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

test("记录充分度只反映已复盘样本数量，并提示混合结果", () => {
  assert.equal(getObservationSufficiency([]).label, "样本不足");
  assert.equal(getObservationSufficiency([
    validRecord({ id: "1", status: "matches" }),
    validRecord({ id: "2", status: "partial" }),
    validRecord({ id: "3", status: "differs" }),
  ]).label, "初步信号 · 结果混合");
  assert.equal(getObservationSufficiency(Array.from({ length: 6 }, (_, index) => validRecord({ id: String(index), status: "matches" }))).level, "growing");
  assert.equal(getObservationSufficiency(Array.from({ length: 9 }, (_, index) => validRecord({ id: String(index), status: "pending" }))).level, "insufficient", "待观察记录不应冒充已核对样本");
});
