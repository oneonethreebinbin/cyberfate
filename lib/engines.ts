import { astro } from "iztro";
import { Solar } from "lunar-javascript";
import type {
  BaziChart,
  BaziPillar,
  BirthProfile,
  FateChart,
  SolarCorrection,
  ZiweiChart,
  ZiweiStar,
} from "@/lib/types";

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

export function correctSolarTime(profile: BirthProfile): {
  date: Date;
  detail: SolarCorrection;
} {
  const [year, month, day] = profile.date.split("-").map(Number);
  const [hour, minute] = profile.time.split(":").map(Number);
  const clock = new Date(year, month - 1, day, hour, minute, 0, 0);
  const eot = equationOfTimeMinutes(clock);
  const longitudeOffset = (profile.longitude - 120) * 4;
  const minutes = profile.useTrueSolarTime ? eot + longitudeOffset : 0;
  const corrected = new Date(clock.getTime() + minutes * 60_000);

  return {
    date: corrected,
    detail: {
      clockTime: `${profile.date} ${profile.time}`,
      solarTime: `${corrected.getFullYear()}-${pad(corrected.getMonth() + 1)}-${pad(corrected.getDate())} ${pad(corrected.getHours())}:${pad(corrected.getMinutes())}`,
      minutes: Math.round(minutes),
      equationOfTime: Math.round(eot * 10) / 10,
      longitudeOffset: Math.round(longitudeOffset * 10) / 10,
    },
  };
}

function hourBranchIndex(hour: number) {
  return Math.floor((hour + 1) / 2) % 12;
}

function buildBazi(date: Date): BaziChart {
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
  const chart = astro.bySolar(dateString, hourBranchIndex(date.getHours()), gender, true, "zh-CN");

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
    bazi: buildBazi(date),
    ziwei: buildZiwei(date, profile.gender),
  };
}

export function getTimeBranch(time: string) {
  const hour = Number(time.split(":")[0]);
  return EARTHLY_BRANCHES[hourBranchIndex(hour)];
}
