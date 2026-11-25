export type MethodReference = {
  id: string;
  group: "calculation" | "tradition" | "boundary";
  title: string;
  publisher: string;
  url: string;
  supports: string;
  doesNotSupport: string;
};

/**
 * 面向用户公开的方法来源。这里登记“来源能支持什么”，也登记“不能支持什么”，
 * 避免把算法可复现、传统文本记载与现代科学验证混为一谈。
 */
export const METHOD_REFERENCES: MethodReference[] = [
  {
    id: "lunar-js",
    group: "calculation",
    title: "lunar-javascript",
    publisher: "6tail · MIT 开源项目",
    url: "https://github.com/6tail/lunar-javascript",
    supports: "公农历转换、节气、干支、四柱、十神、纳音与大运等可复现计算。",
    doesNotSupport: "库的计算能力不等于命理解释已经得到科学验证。",
  },
  {
    id: "iztro",
    group: "calculation",
    title: "iztro 与紫微研习社文档",
    publisher: "SylarLong · MIT 开源项目",
    url: "https://github.com/SylarLong/iztro",
    supports: "紫微十二宫、星曜、四化与运限字段的排盘 API、类型和配置来源。",
    doesNotSupport: "不同流派的安星、四化和闰月口径可能不同，不能视为唯一传统答案。",
  },
  {
    id: "noaa-solar",
    group: "calculation",
    title: "General Solar Position Calculations",
    publisher: "NOAA Global Monitoring Laboratory",
    url: "https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF",
    supports: "均时差、经度、时区偏移与真太阳时计算的天文公式参考。",
    doesNotSupport: "真太阳时计算只校正时间坐标，不验证后续术数解释。",
  },
  {
    id: "cas-timezone",
    group: "calculation",
    title: "如何划分地球的时区",
    publisher: "中国科学院地理科学与资源研究所",
    url: "https://igsnrr.cas.cn/cbkx/kpyd/dlzs/earth/202009/t20200910_5692488.html",
    supports: "经度每度约四分钟与中国统一采用东八区标准时间的基础说明。",
    doesNotSupport: "海外出生、历史地方时和夏令时仍需要独立时区资料。",
  },
  {
    id: "sanming-tonghui",
    group: "tradition",
    title: "《三命通会》",
    publisher: "明 · 万民英；中国哲学书电子化计划收录",
    url: "https://ctext.org/wiki.pl?if=gb&remap=gb&res=587236",
    supports: "五行、干支、十神、六亲等传统论法的历史文本来源。",
    doesNotSupport: "古籍记载是传统来源，不是现代实证证据；电子文本也可能含 OCR 错字，需回看影印本。",
  },
  {
    id: "iztro-palace",
    group: "tradition",
    title: "紫微斗数十二宫与学习资料",
    publisher: "紫微研习社",
    url: "https://iztro.com/learn/palace",
    supports: "宫位、对宫、三方四正等紫微术语与阅读框架的公开说明。",
    doesNotSupport: "单宫、单星或单一四化不足以概括人格、关系或事件结果。",
  },
  {
    id: "carlson",
    group: "boundary",
    title: "A double-blind test of astrology",
    publisher: "Nature 318, 419–425 (1985)",
    url: "https://doi.org/10.1038/318419a0",
    supports: "提醒预测性主张需要可重复、可对照的现代证据。",
    doesNotSupport: "该研究针对西方出生星盘，不能直接替代对八字或紫微斗数的独立实验。",
  },
  {
    id: "nist-ai-rmf",
    group: "boundary",
    title: "AI Risk Management Framework 1.0",
    publisher: "NIST",
    url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf",
    supports: "未来如引入 AI，需记录来源、版本、输入范围、风险和人工可检查性。",
    doesNotSupport: "框架不为任何具体 AI 解释背书，也不能消除模型幻觉。",
  },
  {
    id: "local-first",
    group: "boundary",
    title: "Local-first software",
    publisher: "Ink & Switch",
    url: "https://www.inkandswitch.com/essay/local-first/",
    supports: "用户数据所有权、离线能力与长期控制的产品设计原则。",
    doesNotSupport: "浏览器本地存储并不等于加密保险箱，仍需备份和设备安全。",
  },
];
