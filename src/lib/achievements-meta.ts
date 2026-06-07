// Tiny localStorage-backed counters for ambient achievement metadata
// (night submissions, late-edits). Per-user keyed.

const KEY = (uid: string) => `rosie:achv-meta:${uid}`;

export interface AchvMeta {
  time_night: number;
  update_diligent: number;
}

export function loadMeta(uid: string): AchvMeta {
  if (typeof window === "undefined") return { time_night: 0, update_diligent: 0 };
  try {
    const raw = localStorage.getItem(KEY(uid));
    if (!raw) return { time_night: 0, update_diligent: 0 };
    const obj = JSON.parse(raw);
    return {
      time_night: Number(obj.time_night) || 0,
      update_diligent: Number(obj.update_diligent) || 0,
    };
  } catch {
    return { time_night: 0, update_diligent: 0 };
  }
}

export function saveMeta(uid: string, meta: AchvMeta): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY(uid), JSON.stringify(meta)); } catch { /* ignore */ }
}

export function bumpNight(uid: string): AchvMeta {
  const m = loadMeta(uid);
  m.time_night += 1;
  saveMeta(uid, m);
  return m;
}

export function bumpLateEdit(uid: string): AchvMeta {
  const m = loadMeta(uid);
  m.update_diligent += 1;
  saveMeta(uid, m);
  return m;
}