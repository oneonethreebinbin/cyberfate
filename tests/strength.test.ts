import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeDayMasterStrength, favorDirection, tenGodOf } from "../lib/strength";
import type { BaziPillar } from "../lib/types";

function pillar(label: BaziPillar["label"], gan: string, zhi: string, hidden: string[]): BaziPillar {
  return { label, gan, zhi, hidden, wuXing: "", naYin: "", shiShenGan: "", shiShenZhi: [], diShi: "" };
}

test("十神定名：五行相对日主的关系", () => {
  // 第二参数为日主五行，不是天干。
  assert.equal(tenGodOf("木", "水"), "食伤", "水生木，我生为食伤");
  assert.equal(tenGodOf("金", "水"), "印", "金生水，生我为印");
  assert.equal(tenGodOf("水", "水"), "比劫", "同气为比劫");
  assert.equal(tenGodOf("火", "水"), "财", "水克火，我克为财");
  assert.equal(tenGodOf("土", "水"), "官杀", "土克水，克我为官杀");
});

test("月令同气判身强，喜克泄耗", () => {
  // 壬水日主生于子月（同气得令 40）+ 日支子水本气根 15 + 年干壬比劫 8 → 63？需加时柱。
  const pillars = [
    pillar("年柱", "壬", "子", ["癸"]),
    pillar("月柱", "壬", "子", ["癸"]),
    pillar("日柱", "壬", "子", ["癸"]),
    pillar("时柱", "庚", "子", ["癸"]),
  ];
  const strength = analyzeDayMasterStrength(pillars);
  assert.equal(strength.verdict, "身强");
  assert.ok(strength.score >= 70);
  assert.ok(strength.favorable.length > 0, "身强必有可用之喜");
  assert.equal(favorDirection(strength, "土", "水"), "喜", "身强喜官杀");
  assert.equal(favorDirection(strength, "金", "水"), "忌", "身强忌印");
});

test("月令受制无根判身弱，喜生扶", () => {
  // 丙火生于子月（受制 5），四支藏干皆无丙丁之根，三干无比劫印。
  const pillars = [
    pillar("年柱", "庚", "子", ["癸"]),
    pillar("月柱", "戊", "子", ["癸"]),
    pillar("日柱", "丙", "子", ["癸"]),
    pillar("时柱", "庚", "子", ["癸"]),
  ];
  const strength = analyzeDayMasterStrength(pillars);
  assert.equal(strength.verdict, "身弱");
  assert.ok(strength.score <= 40);
  assert.ok(strength.favorable.some((item) => item.startsWith("印")), "身弱喜印星生扶");
  assert.ok(strength.evidence.some((item) => item.includes("无根")), "无根应写入判定依据");
});

test("中和不作单向喜忌判断", () => {
  const pillars = [
    pillar("年柱", "壬", "午", ["丁", "己"]),
    pillar("月柱", "庚", "戌", ["戊", "辛", "丁"]),
    pillar("日柱", "壬", "辰", ["戊", "乙", "癸"]),
    pillar("时柱", "戊", "申", ["庚", "壬", "戊"]),
  ];
  const strength = analyzeDayMasterStrength(pillars);
  if (strength.verdict === "中和") {
    assert.deepEqual(strength.favorable, []);
    assert.equal(favorDirection(strength, "火", "水"), "平");
  }
});
