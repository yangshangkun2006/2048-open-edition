import type { GameState } from '../core';
import { migrateBestV1, migrateGameV1, parseGame, serializeGame } from '../core';

// Persistence per FR-05 / PRD §11.3. localStorage is the backing store with an
// in-memory Map fallback (private mode, quota, enterprise policy).

export const KEY_GAME = '2048:v2:game';
export const KEY_BEST = '2048:v2:best';
export const KEY_PREFS = '2048:v2:prefs';
export const KEY_LEASE = '2048:v2:lease';
const KEY_V1_GAME = 'gameState';
const KEY_V1_BEST = 'bestScore';
const CORRUPT_PREFIX = '2048:corrupt:';
const CORRUPT_KEEP = 3;

export interface Prefs {
  version: 1;
  lang: 'zh-CN' | 'en';
  sound: boolean;
  haptics: boolean;
  motion: 'system' | 'reduce' | 'full';
  shortcuts: boolean;
  announce: 'concise' | 'verbose';
  analytics: boolean;
  introSeen: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  version: 1,
  lang: 'zh-CN',
  sound: false,
  haptics: false,
  motion: 'system',
  shortcuts: true,
  announce: 'concise',
  analytics: true,
  introSeen: false,
};

// ---------------------------------------------------------------------------
// Backing store with memory fallback (FR-05 AC-06)

class Store {
  private memory = new Map<string, string>();
  private broken = false;

  constructor() {
    try {
      const k = '__2048_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
    } catch {
      this.broken = true;
    }
  }

  isBroken(): boolean {
    return this.broken;
  }

  get(key: string): string | null {
    if (this.broken) return this.memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      this.broken = true;
      return this.memory.get(key) ?? null;
    }
  }

  set(key: string, value: string): boolean {
    if (this.broken) {
      this.memory.set(key, value);
      return true;
    }
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      this.broken = true;
      this.memory.set(key, value);
      return false;
    }
  }

  remove(key: string): void {
    if (this.broken) {
      this.memory.delete(key);
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      this.broken = true;
      this.memory.delete(key);
    }
  }

  keys(): string[] {
    if (this.broken) return [...this.memory.keys()];
    try {
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    } catch {
      this.broken = true;
      return [...this.memory.keys()];
    }
  }
}

export const store = new Store();

// ---------------------------------------------------------------------------
// Game save / restore

export type LoadResult =
  | { kind: 'restored'; state: GameState }
  | { kind: 'new'; notice: string | null };

function archiveCorrupt(raw: string): void {
  const key = `${CORRUPT_PREFIX}${Date.now()}`;
  store.set(key, raw);
  const corrupt = store.keys().filter((k) => k.startsWith(CORRUPT_PREFIX)).sort();
  while (corrupt.length > CORRUPT_KEEP) {
    store.remove(corrupt.shift()!);
  }
}

export function loadGame(): LoadResult {
  const raw = store.get(KEY_GAME);
  if (raw !== null) {
    const state = parseGame(raw);
    if (state) {
      if (state.status === 'OVER') {
        // OVER runs are not restored (FR-05); best/stats stay.
        store.remove(KEY_GAME);
        return { kind: 'new', notice: null };
      }
      return { kind: 'restored', state };
    }
    archiveCorrupt(raw);
    store.remove(KEY_GAME);
    return { kind: 'new', notice: 'corrupt' };
  }

  const v1 = store.get(KEY_V1_GAME);
  if (v1 !== null) {
    const migrated = migrateGameV1(v1);
    store.remove(KEY_V1_GAME);
    if (migrated) {
      if (migrated.status !== 'OVER') {
        store.set(KEY_GAME, serializeGame(migrated));
        return { kind: 'restored', state: migrated };
      }
      return { kind: 'new', notice: null };
    }
    archiveCorrupt(v1);
    return { kind: 'new', notice: 'migrate' };
  }

  return { kind: 'new', notice: null };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: string | null = null;
export let lastSaveFailed = false;

export function saveGame(state: GameState): void {
  const json = serializeGame(state);
  pendingSave = json;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 150); // debounce per FR-05
}

export function flushSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSave === null) return;
  const json = pendingSave;
  pendingSave = null;
  const ok = store.set(KEY_GAME, json);
  if (!ok && !lastSaveFailed) {
    lastSaveFailed = true;
    window.dispatchEvent(new CustomEvent('2048:save-failed'));
  }
}

// ---------------------------------------------------------------------------
// Best score (single source of truth: 2048:v2:best, FR-05)

export function getBest(): number {
  const raw = store.get(KEY_BEST);
  if (raw !== null) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    return 0;
  }
  const v1 = store.get(KEY_V1_BEST);
  if (v1 !== null) {
    store.remove(KEY_V1_BEST);
    const n = migrateBestV1(v1);
    if (n !== null) {
      store.set(KEY_BEST, String(n));
      return n;
    }
  }
  return 0;
}

export function setBest(n: number): void {
  store.set(KEY_BEST, String(Math.floor(n)));
}

export function resetBest(): void {
  store.remove(KEY_BEST);
}

// ---------------------------------------------------------------------------
// Prefs

export function loadPrefs(): Prefs {
  const raw = store.get(KEY_PREFS);
  if (raw !== null) {
    try {
      const p = JSON.parse(raw) as Record<string, unknown>;
      if (p && typeof p === 'object') {
        return {
          version: 1,
          lang: p.lang === 'zh-CN' || p.lang === 'en' ? p.lang : DEFAULT_PREFS.lang,
          sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_PREFS.sound,
          haptics: typeof p.haptics === 'boolean' ? p.haptics : DEFAULT_PREFS.haptics,
          motion: p.motion === 'system' || p.motion === 'reduce' || p.motion === 'full' ? p.motion : DEFAULT_PREFS.motion,
          shortcuts: typeof p.shortcuts === 'boolean' ? p.shortcuts : DEFAULT_PREFS.shortcuts,
          announce: p.announce === 'concise' || p.announce === 'verbose' ? p.announce : DEFAULT_PREFS.announce,
          analytics: typeof p.analytics === 'boolean' ? p.analytics : DEFAULT_PREFS.analytics,
          introSeen: typeof p.introSeen === 'boolean' ? p.introSeen : DEFAULT_PREFS.introSeen,
        };
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return { ...DEFAULT_PREFS };
}

export function savePrefs(prefs: Prefs): void {
  store.set(KEY_PREFS, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// Export / delete (FR-16)

export function exportData(prefs: Prefs, best: number, game: GameState | null): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    prefs,
    best,
    game: game ? JSON.parse(serializeGame(game)) : null,
  });
}

export function deleteAllData(): void {
  for (const k of store.keys()) {
    if (k.startsWith('2048:') || k === KEY_V1_GAME || k === KEY_V1_BEST) store.remove(k);
  }
}
