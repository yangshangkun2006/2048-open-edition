import type { GameState, Status, Tile } from './types';
import { SIZE, maxTileOf } from './reducer';
import { newSeed } from './rng';

const STATUSES: readonly Status[] = ['PLAYING', 'WON', 'POST_WIN', 'OVER'];

export function isPowerOfTwo(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0;
}

function isUint32(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
}

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

// ---------------------------------------------------------------------------
// Serialize to the FR-05 storage shape: nested 4×4 rows of {id, value} | null.

export function serializeGame(state: GameState): string {
  const board: ({ id: number; value: number } | null)[][] = [];
  for (let r = 0; r < SIZE; r++) {
    const row: ({ id: number; value: number } | null)[] = [];
    for (let c = 0; c < SIZE; c++) {
      const t = state.board[r * SIZE + c];
      row.push(t ? { id: t.id, value: t.value } : null);
    }
    board.push(row);
  }
  return JSON.stringify({
    schemaVersion: 2,
    board,
    score: state.score,
    status: state.status,
    won: state.won,
    moves: state.moves,
    maxTile: state.maxTile,
    seed: state.seed,
    rngState: state.rngState,
    elapsedMs: state.elapsedMs,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// Parse + schema validation (FR-05): types, ranges, 4×4 board, powers of two,
// unique ids, non-negative score. Returns null when the save is not restorable.

export function parseGame(raw: string): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const g = data as Record<string, unknown>;

  if (g.schemaVersion !== 2) return null;
  if (!Array.isArray(g.board) || g.board.length !== SIZE) return null;

  const board: (Tile | null)[] = new Array<Tile | null>(SIZE * SIZE).fill(null);
  const seenIds = new Set<number>();

  for (let r = 0; r < SIZE; r++) {
    const row = g.board[r];
    if (!Array.isArray(row) || row.length !== SIZE) return null;
    for (let c = 0; c < SIZE; c++) {
      const cell = row[c];
      if (cell === null) continue;
      if (typeof cell !== 'object' || cell === null) return null;
      const { id, value } = cell as Record<string, unknown>;
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return null;
      if (!isPowerOfTwo(value)) return null;
      if (seenIds.has(id)) return null;
      seenIds.add(id);
      board[r * SIZE + c] = { id, value, c, r };
    }
  }

  if (!isNonNegNumber(g.score)) return null;
  if (!STATUSES.includes(g.status as Status)) return null;
  if (typeof g.won !== 'boolean') return null;
  if (typeof g.moves !== 'number' || !Number.isInteger(g.moves) || g.moves < 0) return null;
  if (!isUint32(g.seed) || !isUint32(g.rngState)) return null;
  if (!isNonNegNumber(g.elapsedMs) || !isNonNegNumber(g.startedAt) || !isNonNegNumber(g.updatedAt)) return null;

  const state: GameState = {
    schemaVersion: 2,
    board,
    score: g.score,
    status: g.status as Status,
    won: g.won,
    moves: g.moves,
    maxTile: maxTileOf(board),
    seed: g.seed,
    rngState: g.rngState,
    elapsedMs: g.elapsedMs,
    startedAt: g.startedAt,
    updatedAt: g.updatedAt,
  };
  return state;
}

// ---------------------------------------------------------------------------
// v1 migration (FR-05 / R-04): upstream `gameState` (grid.cells with x/y) and
// `bestScore` stored as a string.

export function migrateGameV1(raw: string, now: number = Date.now()): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const g = data as Record<string, unknown>;
  const grid = (g.grid ?? {}) as Record<string, unknown>;
  const cells = grid.cells;
  if (!Array.isArray(cells) || cells.length !== SIZE * SIZE) return null;

  const board: (Tile | null)[] = new Array<Tile | null>(SIZE * SIZE).fill(null);
  let id = 1;
  for (const cell of cells) {
    if (cell === null) continue;
    if (typeof cell !== 'object' || cell === null) return null;
    const { x, y, value } = cell as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!isPowerOfTwo(value)) return null;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 3 || y < 0 || y > 3) return null;
    board[y * SIZE + x] = { id: id++, value, c: x, r: y };
  }

  const score = typeof g.score === 'number' && Number.isFinite(g.score) && g.score >= 0 ? g.score : 0;
  const won = g.won === true;
  let status: Status;
  if (g.over === true) status = 'OVER';
  else if (won) status = g.keepPlaying === true ? 'POST_WIN' : 'WON';
  else status = 'PLAYING';

  const { seed } = newSeed();
  return {
    schemaVersion: 2,
    board,
    score,
    status,
    won,
    moves: 0,
    maxTile: maxTileOf(board),
    seed,
    rngState: seed,
    elapsedMs: 0,
    startedAt: 0,
    updatedAt: now,
  };
}

export function migrateBestV1(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
