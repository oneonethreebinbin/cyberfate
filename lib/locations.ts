export const CITY_OPTIONS = [
  { id: "beijing", name: "北京", longitude: 116.4 },
  { id: "shanghai", name: "上海", longitude: 121.47 },
  { id: "guangzhou", name: "广州", longitude: 113.27 },
  { id: "shenzhen", name: "深圳", longitude: 114.06 },
  { id: "hangzhou", name: "杭州", longitude: 120.16 },
  { id: "nanjing", name: "南京", longitude: 118.8 },
  { id: "chengdu", name: "成都", longitude: 104.07 },
  { id: "chongqing", name: "重庆", longitude: 106.55 },
  { id: "wuhan", name: "武汉", longitude: 114.31 },
  { id: "xian", name: "西安", longitude: 108.94 },
  { id: "hongkong", name: "香港", longitude: 114.17 },
  { id: "taipei", name: "台北", longitude: 121.57 },
] as const;

export function cityIdForLongitude(longitude: number) {
  return CITY_OPTIONS.find((city) => Math.abs(city.longitude - longitude) < 0.02)?.id ?? "custom";
}
