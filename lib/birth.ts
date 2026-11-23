import type { BirthProfile } from "@/lib/types";

export function localDateValue(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

export function localDateAfter(days: number) {
  return localDateValue(new Date(Date.now() + days * 86_400_000));
}

export function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > localDateValue()) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isBirthProfile(value: unknown): value is BirthProfile {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BirthProfile>;
  return typeof item.id === "string" && typeof item.name === "string" && isValidBirthDate(item.date ?? "") && isValidTime(item.time ?? "") && (item.gender === "男" || item.gender === "女") && typeof item.longitude === "number" && item.longitude >= 73 && item.longitude <= 135 && typeof item.useTrueSolarTime === "boolean";
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
