import assert from "node:assert/strict";
import { test } from "node:test";
import {
  branchHeTransform,
  findFullXing,
  findTrines,
  isHaiPair,
  isPoPair,
  isSelfXing,
  isXingPair,
  LIU_XING,
  pairIn,
  stemHeTransform,
} from "../lib/combinations";
import type { BaziPillar } from "../lib/types";

function pillarsOf(gans: string[], zhis: string[]): BaziPillar[] {
  return gans.map((gan, index) => ({
    label: (["年柱", "月柱", "日柱", "时柱"] as const)[index],
    gan,
    zhi: zhis[index],
    hidden: [],
    wuXing: "",
    naYin: "",
    shiShenGan: "",
    shiShenZhi: [],
    diShi: "",
  }));
}

test("相刑表包含全部七组", () => {
  // 相刑须含子卯、寅巳、巳申、寅申、丑戌、戌未、丑未。
  assert.equal(LIU_XING.length, 7);
  for (const pair of ["子卯", "寅巳", "巳申", "寅申", "丑戌", "戌未", "丑未"]) {
    assert.ok(LIU_XING.includes(pair), `缺少相刑组合：${pair}`);
  }
});

test("刑冲并见：寅申、丑未既为刑亦为冲对", () => {
  assert.equal(isXingPair("寅", "申"), true);
  assert.equal(isXingPair("申", "寅"), true, "刑组不分顺序");
  assert.equal(isXingPair("丑", "未"), true);
  assert.equal(isXingPair("午", "子"), false, "子午只冲不刑");
});

test("自刑、六害、六破", () => {
  assert.equal(isSelfXing("辰"), true);
  assert.equal(isSelfXing("子"), false);
  assert.equal(isHaiPair("子", "未"), true);
  assert.equal(isPoPair("酉", "子"), true);
});

test("三刑全象只在三支齐见时成立", () => {
  assert.deepEqual(findFullXing(["寅", "巳"]), [], "两支不成三刑");
  assert.deepEqual(findFullXing(["寅", "巳", "申"]).length, 1, "寅巳申成局");
  assert.deepEqual(findFullXing(["丑", "戌", "未"]).length, 1, "丑戌未成局");
});

test("三合局分全合与半合", () => {
  const full = findTrines(["申", "子", "辰"]);
  assert.equal(full.length, 1);
  assert.equal(full[0].full, true);
  assert.equal(full[0].element, "水");

  const half = findTrines(["子", "辰"]);
  assert.equal(half[0].full, false, "两员为半合");
});

test("六合化神与透干成化", () => {
  const earthTransparent = pillarsOf(["甲", "戊", "戊", "戊"], ["子", "戌", "戌", "戌"]);
  const he = branchHeTransform("子", "丑", earthTransparent);
  assert.ok(he);
  assert.equal(he?.element, "土");
  assert.equal(he?.transformed, true, "化神透干则论化");

  const noEarth = pillarsOf(["甲", "丙", "壬", "壬"], ["子", "申", "戌", "戌"]);
  assert.equal(branchHeTransform("子", "丑", noEarth)?.transformed, false, "化神不透为绊");
  assert.equal(branchHeTransform("子", "巳", noEarth), null, "非六合组合返回 null");
});

test("天干五合", () => {
  const fireTransparent = pillarsOf(["丁", "戊", "戊", "戊"], ["午", "戌", "戌", "戌"]);
  assert.equal(stemHeTransform("甲", "己", fireTransparent)?.transformed, true, "化神透干论化");
  assert.equal(stemHeTransform("己", "甲", fireTransparent)?.element, "土", "五合不分顺序");
});

test("pairIn 双向匹配", () => {
  assert.equal(pairIn(["子未"], "未", "子"), true);
  assert.equal(pairIn(["子未"], "子", "丑"), false);
});
