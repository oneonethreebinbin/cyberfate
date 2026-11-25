export type RelationshipTimelineStatus = "有对应经历" | "暂无对应经历" | "仍不确定";

export type RelationshipTimelineNote = {
  status?: RelationshipTimelineStatus;
  text?: string;
};

export type RelationshipTimelineNotes = Record<number, RelationshipTimelineNote>;

export interface RelationshipNotesBackupEntry {
  profileId: string;
  notes: RelationshipTimelineNotes;
}

const STORAGE_PREFIX = "cyberfate-relationship-notes:";
export const RELATIONSHIP_NOTES_CHANGED_EVENT = "cyberfate:relationship-notes-changed";
const STATUSES: RelationshipTimelineStatus[] = ["有对应经历", "暂无对应经历", "仍不确定"];

export function normalizeRelationshipTimelineNotes(value: unknown): RelationshipTimelineNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized: RelationshipTimelineNotes = {};
  for (const [yearKey, rawNote] of Object.entries(value)) {
    const year = Number(yearKey);
    if (!Number.isInteger(year) || year < 1900 || year > 2200 || !rawNote || typeof rawNote !== "object" || Array.isArray(rawNote)) continue;
    const note = rawNote as { status?: unknown; text?: unknown };
    const status = typeof note.status === "string" && STATUSES.includes(note.status as RelationshipTimelineStatus)
      ? note.status as RelationshipTimelineStatus
      : undefined;
    const text = typeof note.text === "string" ? note.text.slice(0, 5000) : undefined;
    if (status || text) normalized[year] = { ...(status ? { status } : {}), ...(text ? { text } : {}) };
  }
  return normalized;
}

export function isRelationshipNotesBackupEntry(value: unknown): value is RelationshipNotesBackupEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RelationshipNotesBackupEntry>;
  return typeof entry.profileId === "string"
    && entry.profileId.length > 0
    && entry.profileId.length <= 200
    && entry.profileId.trim() === entry.profileId
    && Object.keys(normalizeRelationshipTimelineNotes(entry.notes)).length > 0;
}

export function normalizeRelationshipNotesBackupEntries(value: unknown): RelationshipNotesBackupEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRelationshipNotesBackupEntry)
    .map((entry) => ({ profileId: entry.profileId, notes: normalizeRelationshipTimelineNotes(entry.notes) }));
}

export function mergeRelationshipTimelineNotes(
  local: RelationshipTimelineNotes,
  incoming: RelationshipTimelineNotes,
): RelationshipTimelineNotes {
  return { ...incoming, ...local };
}

export function readRelationshipTimelineNotes(profileId: string): RelationshipTimelineNotes {
  if (typeof window === "undefined") return {};
  try {
    return normalizeRelationshipTimelineNotes(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${profileId}`) ?? "{}"));
  } catch {
    return {};
  }
}

export function writeRelationshipTimelineNotes(profileId: string, notes: RelationshipTimelineNotes) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(notes));
    window.dispatchEvent(new Event(RELATIONSHIP_NOTES_CHANGED_EVENT));
  } catch {
    // 隐私模式或空间不足时保留当前会话状态。
  }
}

export function removeRelationshipTimelineNotes(profileId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${profileId}`);
    window.dispatchEvent(new Event(RELATIONSHIP_NOTES_CHANGED_EVENT));
  } catch {
    // 删除失败时由调用方保留当前会话状态，不扩大影响范围。
  }
}

export function readAllRelationshipTimelineNotes(): RelationshipNotesBackupEntry[] {
  if (typeof window === "undefined") return [];
  const entries: RelationshipNotesBackupEntry[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const profileId = key.slice(STORAGE_PREFIX.length);
      const notes = readRelationshipTimelineNotes(profileId);
      if (profileId && Object.keys(notes).length) entries.push({ profileId, notes });
    }
  } catch {
    return [];
  }
  return entries;
}

export function restoreRelationshipTimelineNotes(entries: RelationshipNotesBackupEntry[]) {
  let restoredNotes = 0;
  let restoredProfiles = 0;
  for (const entry of entries) {
    const incoming = normalizeRelationshipTimelineNotes(entry.notes);
    if (!Object.keys(incoming).length) continue;
    const local = readRelationshipTimelineNotes(entry.profileId);
    const merged = mergeRelationshipTimelineNotes(local, incoming);
    writeRelationshipTimelineNotes(entry.profileId, merged);
    restoredProfiles += 1;
    restoredNotes += Object.keys(incoming).filter((year) => !(Number(year) in local)).length;
  }
  return { restoredProfiles, restoredNotes };
}
