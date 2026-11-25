import assert from "node:assert/strict";
import { test } from "node:test";
import { createFateChart } from "../lib/engines";
import { buildGuidedReport } from "../lib/guided-reading";
import { METHOD_REFERENCES } from "../lib/references";
import type { BirthProfile } from "../lib/types";

const profile: BirthProfile = {
  id: "guided",
  name: "导读命例",
  date: "1990-01-27",
  time: "08:30",
  timeKnown: true,
  gender: "男",
  longitude: 116.4,
  useTrueSolarTime: true,
  createdAt: "2026-11-24T00:00:00.000Z",
};

const chart = createFateChart(profile);

for (const intent of ["self", "timing", "relationship"] as const) {
  test(`${intent} 导读包含结论、三个主题与受约束问题`, () => {
    const report = buildGuidedReport(chart, intent);
    assert.equal(report.intent, intent);
    assert.ok(report.title.length > 12);
    assert.ok(report.summary.length > 20);
    assert.ok(report.recommendation.length > 12);
    assert.equal(report.themes.length, 3);
    assert.ok(report.questions.length >= 3);
    assert.ok(report.primaryEvidence.sourceIds.length > 0, "首屏结论必须绑定来源");
    for (const theme of report.themes) {
      assert.ok(theme.evidence.signals.length > 0, `${theme.id} 必须绑定盘面信号`);
      assert.ok(theme.evidence.sourceIds.length > 0, `${theme.id} 必须绑定来源 ID`);
      assert.ok(theme.evidence.systems.length > 0, `${theme.id} 必须声明所属体系`);
      assert.ok(theme.evidence.conditions.length > 0, `${theme.id} 必须声明成立条件`);
      assert.ok(theme.evidence.ruleVersion.length > 0, `${theme.id} 必须声明规则版本`);
      assert.ok(theme.evidence.strength.reason.length > 10, `${theme.id} 必须解释证据强度`);
      assert.ok(theme.evidence.conflict.detail.length > 10, `${theme.id} 必须声明冲突信号`);
      assert.ok(theme.boundary.length > 10, `${theme.id} 必须写明边界`);
    }
    for (const question of report.questions) {
      assert.ok(question.evidence.signals.length > 0, `${question.id} 回答必须绑定依据`);
      assert.ok(question.boundary.length > 10, `${question.id} 回答必须写明边界`);
    }
  });
}

test("方法来源同时声明支持范围与不能推出的内容", () => {
  assert.ok(METHOD_REFERENCES.length >= 8);
  assert.deepEqual(new Set(METHOD_REFERENCES.map((item) => item.group)), new Set(["calculation", "tradition", "boundary"]));
  for (const source of METHOD_REFERENCES) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.supports.length > 10);
    assert.ok(source.doesNotSupport.length > 10);
  }
});

test("所有结构化证据引用都能回到方法账本", () => {
  const ids = new Set(METHOD_REFERENCES.map((item) => item.id));
  for (const intent of ["self", "timing", "relationship"] as const) {
    const report = buildGuidedReport(chart, intent);
    for (const evidence of [report.primaryEvidence, ...report.themes.map((item) => item.evidence), ...report.questions.map((item) => item.evidence)]) {
      for (const sourceId of evidence.sourceIds) assert.equal(ids.has(sourceId), true, `${evidence.evidenceId} 引用了未知来源 ${sourceId}`);
    }
  }
});
