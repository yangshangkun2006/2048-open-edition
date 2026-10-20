import { describe, expect, it } from 'vitest';
import type { Dir, GameState, Tile } from './types';
import { applyMove, hasMoves, maxTileOf, newGame, spawnRandomTile } from './reducer';
import { boardsEqual, boardToString, parseBoard, stateFromBoard } from './test-helpers';

// PRD §13.3 golden vectors. The expected board ignores the spawned tile
// ("新方块的随机性通过种子固定或单独校验"); assertions strip the single
// spawned tile (fresh id) and compare values, score delta and validity.

function runVector(
  spec: string,
  dir: Dir,
  expected: string,
  deltaScore: number,
  shouldSpawn: boolean,
) {
  const before = parseBoard(spec);
  const state = stateFromBoard(before);
  const maxIdBefore = Math.max(...before.map((t) => (t ? t.id : 0)));
  const after = applyMove(state, dir);

  if (deltaScore === 0 && !shouldSpawn && !hasAnyChange(before, expected)) {
    // Invalid move: state must be untouched (no spawn, no score, no RNG use).
    expect(after, `V: ${spec} ${dir} should be unchanged`).toBe(state);
    return;
  }

  expect(after.score, `score delta for ${spec} ${dir}`).toBe(state.score + deltaScore);
  expect(after.moves).toBe(state.moves + 1);

  // Exactly one tile was spawned: the one with a fresh id.
  const spawned = after.board.filter((t): t is Tile => t !== null && t.id > maxIdBefore);
  expect(spawned.length, `spawn count for ${spec} ${dir}`).toBe(1);
  const spawnedValue = spawned[0]?.value;
  expect(spawnedValue === 2 || spawnedValue === 4).toBe(true);

  const withoutSpawn = after.board.map((t) => (t && t.id > maxIdBefore ? null : t));
  const expectedBoard = parseBoard(expected);
  expect(
    boardsEqual(withoutSpawn, expectedBoard),
    `board mismatch for ${spec} ${dir}:\n  got: ${boardToString(withoutSpawn)}\n  want: ${boardToString(expectedBoard)}`,
  ).toBe(true);
}

function hasAnyChange(a: (Tile | null)[], spec: string): boolean {
  return !boardsEqual(a, parseBoard(spec));
}

describe('golden vectors V-01..V-17', () => {
  it('V-01 empty board: invalid move', () => {
    const state = stateFromBoard(parseBoard('0000/0000/0000/0000'));
    expect(applyMove(state, 'left')).toBe(state);
  });

  it('V-02 tile against wall: invalid move', () => runVector('2000/0000/0000/0000', 'left', '2000/0000/0000/0000', 0, false));

  it('V-03 basic merge', () => runVector('2200/0000/0000/0000', 'left', '4000/0000/0000/0000', 4, true));

  it('V-04 two independent pairs', () => runVector('2222/0000/0000/0000', 'left', '4400/0000/0000/0000', 8, true));

  it('V-05 no chain merge with old 4', () => runVector('2240/0000/0000/0000', 'left', '4400/0000/0000/0000', 4, true));

  it('V-06 merged 8 does not merge again', () => runVector('4480/0000/0000/0000', 'left', '8800/0000/0000/0000', 8, true));

  it('V-07 merge across empty cell', () => runVector('2024/0000/0000/0000', 'left', '4400/0000/0000/0000', 4, true));

  it('V-08 leftmost pair merges first', () => runVector('4440/0000/0000/0000', 'left', '8400/0000/0000/0000', 8, true));

  it('V-09 two merges scored separately', () => runVector('2244/0000/0000/0000', 'left', '4800/0000/0000/0000', 12, true));

  it('V-10 middle pair merges, tail fills in', () => runVector('0222/0000/0000/0000', 'left', '4200/0000/0000/0000', 4, true));

  it('V-11 two pairs of 4/8', () => runVector('4488/0000/0000/0000', 'left', '81600/0000/0000/0000', 24, true));

  it('V-12 no adjacent equals: invalid', () => runVector('2424/0000/0000/0000', 'left', '2424/0000/0000/0000', 0, false));

  // V-13: slide to the far edge is a valid move (PRD §6.3: any movement
  // counts), so a tile spawns; the vector's board shows only the slide.
  it('V-13 direction correctness, no merge', () => runVector('2000/0000/0000/0000', 'right', '0002/0000/0000/0000', 0, true));

  it('V-14 vertical slide', () => runVector('0000/0000/0000/2000', 'up', '2000/0000/0000/0000', 0, true));

  it('V-15 first 2048 merge wins', () => {
    const state = stateFromBoard(parseBoard('1024102424/0000/0000/0000'));
    const after = applyMove(state, 'left');
    expect(after.won).toBe(true);
    expect(after.status).toBe('WON');
    expect(after.score).toBe(2048);
    expect(after.board[0]?.value).toBe(2048);
  });

  it('V-16 win and over in the same move: win-first narrative', () => {
    // PRD V-16 describes "15 cells + two adjacent 1024 + 1 empty", but that
    // configuration cannot end in OVER: after merge and spawn one cell remains
    // empty, so hasMoves stays true. The only self-consistent reading of
    // "won=true 且 over=true" is a FULL board (16 tiles) whose only match is
    // the 1024 pair; merging it empties one cell, the spawn refills it, and
    // the resulting full board has no matches. Fixed fixture below.
    const state = stateFromBoard(parseBoard('10241024816/416232/24328/16842'));
    expect(hasMoves(state.board)).toBe(true);
    const after = applyMove(state, 'left');
    expect(after.won).toBe(true);
    expect(after.status).toBe('OVER');
    expect(after.score).toBe(2048);
    expect(after.board.every((t) => t !== null), 'board must be full after spawn').toBe(true);
    expect(hasMoves(after.board)).toBe(false);
    expect(after.board[0]?.value).toBe(2048);
  });

  it('V-17 full board with no matches: every direction invalid', () => {
    const board = parseBoard('24816/42168/81624/16842');
    expect(hasMoves(board)).toBe(false);
    const state = stateFromBoard(board);
    for (const dir of ['left', 'right', 'up', 'down'] as Dir[]) {
      expect(applyMove(state, dir)).toBe(state);
    }
    expect(state.status).toBe('PLAYING');
  });
});

describe('V-18 spawn distribution (100k draws, chi-square p > 0.01)', () => {
  it('values are 90/10 within tolerance and positions are uniform', () => {
    // Use the real spawn path: repeatedly spawn onto a fresh empty board.
    const N = 100_000;
    let count2 = 0;
    let count4 = 0;
    const posCounts: number[] = new Array<number>(16).fill(0);

    const rng = { rngState: 0x12345678 };
    for (let i = 0; i < N; i++) {
      const board: (Tile | null)[] = new Array<Tile | null>(16).fill(null);
      const t = spawnRandomTile(board, rng, 1);
      if (t.value === 2) count2++;
      else count4++;
      const idx = t.r * 4 + t.c;
      posCounts[idx] = (posCounts[idx] ?? 0) + 1;
    }

    const ratio = count2 / N;
    expect(ratio).toBeGreaterThanOrEqual(0.895);
    expect(ratio).toBeLessThanOrEqual(0.905);

    // chi-square, 1 df, critical value 6.635 at p = 0.01
    const chi2v = ((count2 - 0.9 * N) ** 2) / (0.9 * N) + ((count4 - 0.1 * N) ** 2) / (0.1 * N);
    expect(chi2v, 'value distribution chi-square').toBeLessThan(6.635);

    // chi-square for uniform positions, 15 df, critical value 30.578
    const expected = N / 16;
    const chi2p = posCounts.reduce((acc, n) => acc + ((n - expected) ** 2) / expected, 0);
    expect(chi2p, 'position distribution chi-square').toBeLessThan(30.578);
  });
});

describe('RNG determinism', () => {
  it('same seed + same moves => identical game (replay)', () => {
    const moves: Dir[] = ['left', 'up', 'right', 'down', 'left', 'up', 'right', 'down', 'left', 'up'];
    const play = (seed: number): GameState => {
      let s = newGame(seed, 0);
      for (const d of moves) s = applyMove(s, d);
      return s;
    };
    const a = play(12345);
    const b = play(12345);
    expect(a.score).toBe(b.score);
    expect(a.rngState).toBe(b.rngState);
    expect(boardsEqual(a.board, b.board)).toBe(true);
    expect(boardToString(a.board)).toBe(boardToString(b.board));
  });

  it('different seeds diverge', () => {
    const moves: Dir[] = ['left', 'up', 'right', 'down'];
    const play = (seed: number): GameState => {
      let s = newGame(seed, 0);
      for (const d of moves) s = applyMove(s, d);
      return s;
    };
    const a = play(1);
    const b = play(2);
    expect(a.rngState).not.toBe(b.rngState);
    expect(boardsEqual(a.board, b.board)).toBe(false);
  });

  it('invalid moves do not consume RNG', () => {
    const state = stateFromBoard(parseBoard('2000/0000/0000/0000'));
    const rngBefore = state.rngState;
    applyMove(state, 'left'); // at wall
    applyMove(state, 'up'); // at top edge
    applyMove(state, 'down'); // nothing below to slide
    expect(state.rngState).toBe(rngBefore);
    // A valid move then consumes exactly two draws (value + position).
    const after = applyMove(state, 'right');
    expect(after).not.toBe(state);
    expect(after.rngState).not.toBe(rngBefore);
  });

  it('maxTile tracks the largest tile', () => {
    const state = stateFromBoard(parseBoard('1024102424/0000/0000/0000'));
    const after = applyMove(state, 'left');
    expect(maxTileOf(after.board)).toBe(2048);
    expect(after.maxTile).toBe(2048);
  });
});
