import { describe, expect, it } from 'vitest';
import type { Dir, Tile } from './types';
import { applyMove, hasMoves, newGame, SIZE } from './reducer';
import { stateFromBoard } from './test-helpers';

// Property tests per PRD §11.6: ≥10,000 random cases. Hot loops use plain
// violation collection instead of expect() so the full sample stays fast.
// Invariants: tile-sum conservation, at most one merge per tile per move
// (no value can more than double), score monotonicity, coordinate uniqueness.

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
const CASES = 10_000;

function sum(board: (Tile | null)[]): number {
  let s = 0;
  for (const t of board) if (t) s += t.value;
  return s;
}

describe('property tests (10k random games)', () => {
  it('invariants hold across random play', () => {
    const violations: string[] = [];
    let seed = 0xc0ffee;
    let games = 0;

    for (let i = 0; i < CASES && violations.length < 20; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      let state = newGame(seed, 0);
      games++;

      for (let step = 0; step < 400; step++) {
        const before = state;
        const sumBefore = sum(before.board);
        const maxBefore = before.maxTile;
        const dir = DIRS[(seed + step) % 4]!;
        const after = applyMove(state, dir);

        if (after === state) continue; // invalid: untouched by contract

        // 1) Tile-sum conservation: grows by exactly the spawned value.
        const delta = sum(after.board) - sumBefore;
        if (delta !== 2 && delta !== 4) {
          violations.push(`game ${i} step ${step}: sum delta ${delta}`);
          break;
        }

        // 2) At most one merge per tile per move: a tile is either unchanged
        //    (moved), doubled once (merged), or fresh (spawn).
        const prevById = new Map<number, number>();
        for (const t of before.board) if (t) prevById.set(t.id, t.value);
        let spawns = 0;
        for (const t of after.board) {
          if (!t) continue;
          if ((t.value & (t.value - 1)) !== 0 || t.value < 2) {
            violations.push(`game ${i} step ${step}: non-power tile ${t.value}`);
            break;
          }
          const prev = prevById.get(t.id);
          if (prev === undefined) {
            spawns++;
            if (t.value !== 2 && t.value !== 4) {
              violations.push(`game ${i} step ${step}: spawn value ${t.value}`);
              break;
            }
          } else if (t.value !== prev && t.value !== prev * 2) {
            violations.push(`game ${i} step ${step}: tile ${t.id} went ${prev} -> ${t.value}`);
            break;
          }
        }
        if (violations.length) break;
        if (spawns !== 1) {
          violations.push(`game ${i} step ${step}: ${spawns} spawns`);
          break;
        }
        if (after.maxTile > maxBefore * 2) {
          violations.push(`game ${i} step ${step}: maxTile ${maxBefore} -> ${after.maxTile}`);
          break;
        }

        // 3) Score monotonic and bounded.
        if (after.score < before.score || after.score > before.score + sumBefore) {
          violations.push(`game ${i} step ${step}: score ${before.score} -> ${after.score}`);
          break;
        }

        // 4) Coordinate uniqueness / consistency.
        for (let idx = 0; idx < after.board.length; idx++) {
          const t = after.board[idx];
          if (!t) continue;
          if (t.c !== idx % SIZE || t.r !== Math.floor(idx / SIZE)) {
            violations.push(`game ${i} step ${step}: bad coords at ${idx}`);
            break;
          }
          if (after.board[t.r * SIZE + t.c] !== t) {
            violations.push(`game ${i} step ${step}: position collision at ${idx}`);
            break;
          }
        }
        if (violations.length) break;

        // 5) Status legality.
        const legal: Record<string, string[]> = {
          PLAYING: ['PLAYING', 'WON', 'OVER'],
          POST_WIN: ['POST_WIN', 'OVER'],
        };
        const allowed = legal[before.status];
        if (allowed && !allowed.includes(after.status)) {
          violations.push(`game ${i} step ${step}: ${before.status} -> ${after.status}`);
          break;
        }

        // 6) OVER implies full board without matches.
        if (after.status === 'OVER') {
          if (hasMoves(after.board) || after.board.some((t) => t === null)) {
            violations.push(`game ${i} step ${step}: OVER with moves available`);
            break;
          }
        }

        state = after;
        if (state.status === 'WON' || state.status === 'OVER') break;
      }
    }

    expect(violations.slice(0, 20).join('\n'), `checked ${games} games`).toBe('');
  }, 120_000);

  it('random boards stay valid after moves (structure checks)', () => {
    const violations: string[] = [];
    let seed = 0xbadc0de;
    for (let i = 0; i < 5_000 && violations.length < 20; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const board: (Tile | null)[] = [];
      let id = 1;
      for (let p = 0; p < 16; p++) {
        const v = (seed >> ((p * 2) % 16)) & 3;
        if (v === 0) {
          board.push(null);
        } else {
          const value = 2 ** (1 + ((seed >> (p % 8)) & 9));
          board.push({ id: id++, value, c: p % SIZE, r: Math.floor(p / SIZE) });
        }
      }
      const state = stateFromBoard(board, seed);
      const sumBefore = sum(board);
      const countBefore = board.filter((t) => t !== null).length;
      for (const dir of DIRS) {
        const after = applyMove(state, dir);
        for (let idx = 0; idx < after.board.length; idx++) {
          const t = after.board[idx];
          if (t && (t.c !== idx % SIZE || t.r !== Math.floor(idx / SIZE))) {
            violations.push(`case ${i} ${dir}: bad coords`);
          }
        }
        if (after !== state) {
          const delta = sum(after.board) - sumBefore;
          if (delta !== 2 && delta !== 4) violations.push(`case ${i} ${dir}: sum delta ${delta}`);
          const merges = countBefore - after.board.filter((t) => t !== null).length + 1;
          if (merges < 0 || merges > 8) violations.push(`case ${i} ${dir}: merges ${merges}`);
        }
      }
    }
    expect(violations.slice(0, 20).join('\n')).toBe('');
  }, 120_000);

  it('invalid move leaves state bit-identical', () => {
    let seed = 7;
    for (let i = 0; i < 2_000; i++) {
      seed = (seed * 48271) >>> 0;
      const board: (Tile | null)[] = [];
      for (let p = 0; p < 16; p++) {
        const value = 2 ** (1 + ((seed + p) % 10));
        board.push({ id: p + 1, value, c: p % SIZE, r: Math.floor(p / SIZE) });
      }
      if (hasMoves(board)) continue;
      const state = stateFromBoard(board, seed);
      const snapshot = JSON.stringify(state);
      for (const dir of DIRS) {
        if (applyMove(state, dir) !== state) {
          throw new Error(`case ${i}: board with no moves moved on ${dir}`);
        }
      }
      if (JSON.stringify(state) !== snapshot) {
        throw new Error(`case ${i}: state mutated by invalid moves`);
      }
    }
  }, 60_000);
});
