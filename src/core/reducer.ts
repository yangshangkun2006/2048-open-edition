import type { Dir, GameState, Rng, Status, Tile } from './types';
import { randInt } from './rng';

export const SIZE = 4;

// ---------------------------------------------------------------------------
// Board queries

export function hasMoves(board: (Tile | null)[]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = board[r * SIZE + c];
      if (!tile) return true;
      if (c + 1 < SIZE) {
        const right = board[r * SIZE + c + 1];
        if (right && right.value === tile.value) return true;
      }
      if (r + 1 < SIZE) {
        const down = board[(r + 1) * SIZE + c];
        if (down && down.value === tile.value) return true;
      }
    }
  }
  return false;
}

export function maxTileOf(board: (Tile | null)[]): number {
  let m = 0;
  for (const t of board) if (t && t.value > m) m = t.value;
  return m;
}

function nextTileId(board: (Tile | null)[]): number {
  let m = 0;
  for (const t of board) if (t && t.id > m) m = t.id;
  return m + 1;
}

// ---------------------------------------------------------------------------
// Spawn (PRD §6.6): uniform empty cell; 90% value 2, 10% value 4.
// Draw order is value-then-position and fixed for replay determinism.

export function spawnRandomTile(board: (Tile | null)[], rng: Rng, id: number): Tile {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) empties.push(i);
  const value = randInt(rng, 10) < 9 ? 2 : 4;
  const pos = empties[randInt(rng, empties.length)];
  if (pos === undefined) throw new Error('spawn with no empty cell');
  const tile: Tile = { id, value, c: pos % SIZE, r: Math.floor(pos / SIZE) };
  board[pos] = tile;
  return tile;
}

// ---------------------------------------------------------------------------
// Move resolution (PRD §6.3/§6.4)

// Cells are processed from the far side of the move direction; destination
// indices coincide with traversal order (far cells land first).
function linesFor(dir: Dir): number[][] {
  const lines: number[][] = [];
  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const cols = dir === 'left' ? [0, 1, 2, 3] : [3, 2, 1, 0];
      lines.push(cols.map((c) => r * SIZE + c));
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const rows = dir === 'up' ? [0, 1, 2, 3] : [3, 2, 1, 0];
      lines.push(rows.map((r) => r * SIZE + c));
    }
  }
  return lines;
}

interface LineResult {
  gained: number;
  created2048: boolean;
  moved: boolean;
}

function resolveLine(board: (Tile | null)[], line: number[], merged: Set<number>): LineResult {
  const tiles: Tile[] = [];
  for (const i of line) {
    const t = board[i];
    if (t) tiles.push(t);
  }

  const out: Tile[] = [];
  let gained = 0;
  let created2048 = false;
  let moved = false;

  for (const tile of tiles) {
    const last = out[out.length - 1];
    if (last && last.value === tile.value && !merged.has(last.id)) {
      // Merge into the neighbouring tile; the result keeps its id and cannot
      // merge again this move (PRD: each tile merges at most once per move).
      const mergedTile: Tile = { id: last.id, value: last.value * 2, c: 0, r: 0 };
      out[out.length - 1] = mergedTile;
      merged.add(mergedTile.id);
      gained += mergedTile.value;
      if (mergedTile.value === 2048) created2048 = true;
      moved = true;
    } else {
      out.push(tile);
    }
  }

  // Write back: clear the line, then place results at the far end.
  for (const i of line) board[i] = null;
  for (let k = 0; k < out.length; k++) {
    const dest = line[k]!;
    const t = out[k]!;
    const c = dest % SIZE;
    const r = Math.floor(dest / SIZE);
    if (t.c !== c || t.r !== r) {
      t.c = c;
      t.r = r;
      moved = true;
    }
    board[dest] = t;
  }

  return { gained, created2048, moved };
}

// ---------------------------------------------------------------------------
// applyMove (PRD §6.3 pseudocode)

export function applyMove(state: GameState, dir: Dir): GameState {
  if (state.status !== 'PLAYING' && state.status !== 'POST_WIN') return state;

  const board: (Tile | null)[] = state.board.map((t) => (t ? { ...t } : null));
  const merged = new Set<number>();
  let gained = 0;
  let moved = false;
  let created2048 = false;

  for (const line of linesFor(dir)) {
    const res = resolveLine(board, line, merged);
    gained += res.gained;
    moved = moved || res.moved;
    created2048 = created2048 || res.created2048;
  }

  if (!moved) return state; // invalid move: no spawn, no score, no save (PRD §6.3)

  // Fresh id from the pre-move max: ids strictly increase over a run, so the
  // spawned tile can never collide with an absorbed tile's id.
  const spawnId = nextTileId(state.board);
  const rng: Rng = { rngState: state.rngState };
  spawnRandomTile(board, rng, spawnId);

  let won = state.won;
  let status: Status = state.status;
  if (created2048 && !won) {
    won = true;
    status = 'WON';
  }
  if (!hasMoves(board)) {
    // Win takes narrative priority; status OVER with won badge (PRD §6.7).
    status = 'OVER';
  }

  return {
    ...state,
    board,
    score: state.score + gained,
    won,
    status,
    moves: state.moves + 1,
    maxTile: maxTileOf(board),
    rngState: rng.rngState,
  };
}

// ---------------------------------------------------------------------------
// Game lifecycle

export function newGame(seed: number, now: number = Date.now()): GameState {
  const board: (Tile | null)[] = new Array<Tile | null>(SIZE * SIZE).fill(null);
  const rng: Rng = { rngState: seed };
  spawnRandomTile(board, rng, 1);
  spawnRandomTile(board, rng, 2);
  return {
    schemaVersion: 2,
    board,
    score: 0,
    status: 'PLAYING',
    won: false,
    moves: 0,
    maxTile: maxTileOf(board),
    seed,
    rngState: rng.rngState,
    elapsedMs: 0,
    startedAt: 0,
    updatedAt: now,
  };
}

/** "Keep going" after a win: no spawn, timer resumes (PRD §6.7). */
export function continueGame(state: GameState): GameState {
  if (state.status !== 'WON') return state;
  return { ...state, status: 'POST_WIN' };
}
