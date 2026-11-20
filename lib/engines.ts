import { astro } from "iztro";
import { Solar } from "lunar-javascript";
import type {
  BaziChart,
  BaziPillar,
  BirthProfile,
  DaYunItem,
  FateChart,
  SolarCorrection,
  ZiweiChart,
  ZiweiStar,
} from "@/lib/types";
import { analyzeDayMasterStrength } from "@/lib/strength";

const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 寅: "木", 卯: "木",
  丙: "火", 丁: "火", 巳: "火", 午: "火",
  戊: "土", 己: "土", 辰: "土", 戌: "土", 丑: "土", 未: "土",
  庚: "金", 辛: "金", 申: "金", 酉: "金",
  壬: "水", 癸: "水", 子: "水", 亥: "水",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function equationOfTimeMinutes(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const b = ((360 / 365) * (day - 81) * Math.PI) / 180;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

// 1986–1991 年华夏实行夏令时，钟表拨快一小时。此时段出生的钟表时间须还原（减 60 分钟），
// 否则时辰错一线、紫微全盘皆翻。返回需要施加到钟表时间上的调整分钟数。
const DST_PERIODS: Array<[number, number, number, number, number, number]> = [
  [1986, 5, 4, 1986, 9, 14],
  [1987, 4, 12, 1987, 9, 13],
  [1988, 4, 10, 1988, 9, 11],
  [1989, 4, 16, 1989, 9, 17],
  [1990, 4, 15, 1990, 9, 16],
  [1991, 4, 14, 1991, 9, 15],
];

function dstAdjustmentMinutes(date: Date): number {
  for (const [sy, sm, sd, ey, em, ed] of DST_PERIODS) {
    if (date >= new Date(sy, sm - 1, sd) && date < new Date(ey, em - 1, ed)) {
      return -60;
    }
  }
  return 0;
}

export function correctSolarTime(profile: BirthProfile): {
  date: Date;
  detail: SolarCorrection;
} {
  const [year, month, day] = profile.date.split("-").map(Number);
  const [hour, minute] = profile.time.split(":").map(Number);
  const clock = new Date(year, month - 1, day, hour, minute, 0, 0);
  const dstMinutes = dstAdjustmentMinutes(clock);
  const standard = new Date(clock.getTime() + dstMinutes * 60_000);
  const eot = equationOfTimeMinutes(standard);
  const longitudeOffset = (profile.longitude - 120) * 4;
  const solarAdjustment = profile.useTrueSolarTime ? eot + longitudeOffset : 0;
  const corrected = new Date(standard.getTime() + solarAdjustment * 60_000);

  return {
    date: corrected,
    detail: {
      clockTime: `${profile.date} ${profile.time}`,
      solarTime: `${corrected.getFullYear()}-${pad(corrected.getMonth() + 1)}-${pad(corrected.getDate())} ${pad(corrected.getHours())}:${pad(corrected.getMinutes())}`,
      minutes: Math.round(dstMinutes + solarAdjustment),
      equationOfTime: Math.round(eot * 10) / 10,
      longitudeOffset: Math.round(longitudeOffset * 10) / 10,
      dstMinutes,
    },
  };
}

function hourBranchIndex(hour: number) {
  return Math.floor((hour + 1) / 2) % 12;
}

function buildBazi(date: Date, gender: BirthProfile["gender"]): BaziChart {
  const solar = Solar.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    0,
  );
  const lunar = solar.getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(2);

  const definitions = [
    ["年柱", "Year"],
    ["月柱", "Month"],
    ["日柱", "Day"],
    ["时柱", "Time"],
  ] as const;

  const pillars = definitions.map(([label, key]) => ({
    label,
    gan: eight[`get${key}Gan`](),
    zhi: eight[`get${key}Zhi`](),
    hidden: Array.from(eight[`get${key}HideGan`]()) as string[],
    wuXing: eight[`get${key}WuXing`](),
    naYin: eight[`get${key}NaYin`](),
    shiShenGan: eight[`get${key}ShiShenGan`](),
    shiShenZhi: Array.from(eight[`get${key}ShiShenZhi`]()) as string[],
    diShi: eight[`get${key}DiShi`](),
  })) as BaziPillar[];

  const elementCounts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of pillars) {
    elementCounts[ELEMENTS[pillar.gan]] += 1;
    elementCounts[ELEMENTS[pillar.zhi]] += 1;
  }

  return {
    lunarText: lunar.toString(),
    zodiac: lunar.getYearShengXiao(),
    dayMaster: `${pillars[2].gan}${ELEMENTS[pillars[2].gan]}`,
    pillars,
    mingGong: eight.getMingGong(),
    shenGong: eight.getShenGong(),
    taiYuan: eight.getTaiYuan(),
    xunKong: eight.getDayXunKong(),
    elementCounts,
    strength: analyzeDayMasterStrength(pillars),
    daYun: (Array.from(eight.getYun(gender === "男" ? 1 : 0).getDaYun()) as Array<{
      getStartYear(): number;
      getEndYear(): number;
      getStartAge(): number;
      getGanZhi(): string;
    }>)
      .map((item) => ({
        startYear: item.getStartYear(),
        endYear: item.getEndYear(),
        startAge: item.getStartAge(),
        ganZhi: item.getGanZhi(),
      }))
      .filter((item) => item.ganZhi)
      .slice(0, 9) as DaYunItem[],
  };
}

function normalizeStar(star: any, type: ZiweiStar["type"]): ZiweiStar {
  return {
    name: String(star.name),
    type,
    brightness: star.brightness ? String(star.brightness) : undefined,
    mutagen: star.mutagen ? String(star.mutagen) : undefined,
  };
}

function buildZiwei(date: Date, gender: BirthProfile["gender"]): ZiweiChart {
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  // iztro 的 timeIndex：0 为早子时（00:00–00:59），12 为晚子时（23:00–23:59）。
  // 晚子时必须传 12——二者星曜落宫不同，与八字侧 sect 2（晚子时算当日）口径一致。
  const hour = date.getHours();
  const timeIndex = hour === 23 ? 12 : hourBranchIndex(hour);
  const chart = astro.bySolar(dateString, timeIndex, gender, true, "zh-CN");

  return {
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: chart.time,
    timeRange: chart.timeRange,
    zodiac: chart.zodiac,
    sign: chart.sign,
    soul: String(chart.soul),
    body: String(chart.body),
    fiveElementsClass: String(chart.fiveElementsClass),
    soulPalace: String(chart.earthlyBranchOfSoulPalace),
    bodyPalace: String(chart.earthlyBranchOfBodyPalace),
    palaces: chart.palaces.map((palace) => ({
      index: palace.index,
      name: String(palace.name),
      ganZhi: `${palace.heavenlyStem}${palace.earthlyBranch}`,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      stars: [
        ...palace.majorStars.map((star) => normalizeStar(star, "major")),
        ...palace.minorStars.map((star) => normalizeStar(star, "minor")),
        ...palace.adjectiveStars.map((star) => normalizeStar(star, "adjective")),
      ],
      changsheng: String(palace.changsheng12),
      decadal: palace.decadal.range,
    })),
  };
}

export function createFateChart(profile: BirthProfile): FateChart {
  const { date, detail } = correctSolarTime(profile);
  return {
    profile,
    correctedDateTime: detail.solarTime,
    correction: detail,
    bazi: buildBazi(date, profile.gender),
    ziwei: buildZiwei(date, profile.gender),
  };
}

export function getTimeBranch(time: string) {
  const hour = Number(time.split(":")[0]);
  return EARTHLY_BRANCHES[hourBranchIndex(hour)];
}
