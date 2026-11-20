export type Gender = "男" | "女";

export interface BirthProfile {
  id: string;
  name: string;
  date: string;
  time: string;
  gender: Gender;
  longitude: number;
  useTrueSolarTime: boolean;
  createdAt: string;
}

export interface SolarCorrection {
  clockTime: string;
  solarTime: string;
  minutes: number;
  equationOfTime: number;
  longitudeOffset: number;
  dstMinutes: number;
}

export interface DaYunItem {
  startYear: number;
  endYear: number;
  startAge: number;
  ganZhi: string;
}

export type StrengthVerdict = "身强" | "身弱" | "中和";

export interface DayMasterStrength {
  verdict: StrengthVerdict;
  score: number;
  commandNote: string;
  evidence: string[];
  favorable: string[];
  unfavorable: string[];
}

export interface BaziPillar {
  label: "年柱" | "月柱" | "日柱" | "时柱";
  gan: string;
  zhi: string;
  hidden: string[];
  wuXing: string;
  naYin: string;
  shiShenGan: string;
  shiShenZhi: string[];
  diShi: string;
}

export interface BaziChart {
  lunarText: string;
  zodiac: string;
  dayMaster: string;
  pillars: BaziPillar[];
  mingGong: string;
  shenGong: string;
  taiYuan: string;
  xunKong: string;
  elementCounts: Record<string, number>;
  strength: DayMasterStrength;
  daYun: DaYunItem[];
}

export interface ZiweiStar {
  name: string;
  type: "major" | "minor" | "adjective";
  brightness?: string;
  mutagen?: string;
}

export interface ZiweiPalace {
  index: number;
  name: string;
  ganZhi: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  stars: ZiweiStar[];
  changsheng: string;
  decadal: [number, number];
}

export interface ZiweiChart {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  time: string;
  timeRange: string;
  zodiac: string;
  sign: string;
  soul: string;
  body: string;
  fiveElementsClass: string;
  soulPalace: string;
  bodyPalace: string;
  palaces: ZiweiPalace[];
}

export interface FateChart {
  profile: BirthProfile;
  correctedDateTime: string;
  correction: SolarCorrection;
  bazi: BaziChart;
  ziwei: ZiweiChart;
}
