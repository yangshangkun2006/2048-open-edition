import type { GameState, Tile } from './types';

// Test-only helpers. Parses the PRD §13.3 board notation:
// rows separated by '/', digits with 0 = empty; multi-digit tiles are matched
// greedily by longest power of two ("81600" = 8, 16, 0, 0).
const POWERS_DESC = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2];

export function parseBoard(spec: string): (Tile | null)[] {
  const board: (Tile | null)[] = new Array<Tile | null>(16).fill(null);
  const rows = spec.split('/');
  if (rows.length !== 4) throw new Error(`bad board spec (rows): ${spec}`);
  let id = 1;
  rows.forEach((row, r) => {
    let rest = row.trim();
    let c = 0;
    while (rest.length > 0 && c < 4) {
      if (rest.startsWith('0')) {
        rest = rest.slice(1);
        c++;
        continue;
      }
      const p = POWERS_DESC.find((v) => rest.startsWith(String(v)));
      if (p === undefined) throw new Error(`bad board spec (cell): ${spec}`);
      board[r * 4 + c] = { id: id++, value: p, c, r };
      rest = rest.slice(String(p).length);
      c++;
    }
    if (rest.length > 0) throw new Error(`bad board spec (row overflow): ${spec}`);
  });
  return board;
}

export function stateFromBoard(board: (Tile | null)[], seed = 42): GameState {
  let maxTile = 0;
  for (const t of board) if (t && t.value > maxTile) maxTile = t.value;
  return {
    schemaVersion: 2,
    board,
    score: 0,
    status: 'PLAYING',
    won: false,
    moves: 0,
    maxTile,
    seed,
    rngState: seed,
    elapsedMs: 0,
    startedAt: 0,
    updatedAt: 0,
  };
}

export function boardToString(board: (Tile | null)[]): string {
  const rows: string[] = [];
  for (let r = 0; r < 4; r++) {
    rows.push(
      [0, 1, 2, 3].map((c) => board[r * 4 + c]?.value ?? 0).join(','),
    );
  }
  return rows.join(' / ');
}

/** Values-only comparison of two boards. */
export function boardsEqual(a: (Tile | null)[], b: (Tile | null)[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i]?.value ?? 0) !== (b[i]?.value ?? 0)) return false;
  }
  return true;
}
