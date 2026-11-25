export interface LocalStorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

const CYBERFATE_STORAGE_PREFIX = "cyberfate-";

/** 先快照键名再删除，避免 localStorage.length 在循环中变化导致漏删。 */
export function clearCyberfateLocalData(storage: LocalStorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(CYBERFATE_STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys;
}
