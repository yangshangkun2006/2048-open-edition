import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import { migrateBestV1, migrateGameV1, parseGame, serializeGame } from './serialize';
import { newGame } from './reducer';
import { parseBoard, stateFromBoard } from './test-helpers';

function roundTrip(state: GameState): GameState {
  const parsed = parseGame(serializeGame(state));
  if (!parsed) throw new Error('round-trip failed');
  return parsed;
}

describe('serialize / parse (FR-05 schema v2)', () => {
  it('round-trips a full state', () => {
    const state = newGame(0xdeadbeef, 1000);
    const parsed = roundTrip(state);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.score).toBe(state.score);
    expect(parsed.status).toBe(state.status);
    expect(parsed.won).toBe(state.won);
    expect(parsed.moves).toBe(state.moves);
    expect(parsed.maxTile).toBe(state.maxTile);
    expect(parsed.seed).toBe(state.seed);
    expect(parsed.rngState).toBe(state.rngState);
    expect(parsed.elapsedMs).toBe(state.elapsedMs);
    expect(parsed.startedAt).toBe(state.startedAt);
    expect(parsed.updatedAt).toBe(state.updatedAt);
    expect(parsed.board.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      const a = state.board[i];
      const b = parsed.board[i];
      if (!a || !b) {
        expect(a).toBe(b);
      } else {
        expect({ id: b.id, value: b.value, c: b.c, r: b.r }).toEqual(a);
      }
    }
  });

  it('strips c/r in the stored JSON (FR-05 storage shape)', () => {
    const state = stateFromBoard(parseBoard('2200/0000/0000/0000'));
    const raw = JSON.parse(serializeGame(state)) as Record<string, unknown>;
    const rows = raw.board as Record<string, unknown>[][];
    const cell = rows[0]![0] as Record<string, unknown>;
    expect(cell.id).toBe(1);
    expect(cell.value).toBe(2);
    expect(cell.c).toBeUndefined();
    expect(cell.r).toBeUndefined();
  });

  it('rejects wrong schema version', () => {
    const raw = JSON.parse(serializeGame(newGame(1))) as Record<string, unknown>;
    raw.schemaVersion = 1;
    expect(parseGame(JSON.stringify(raw))).toBeNull();
  });

  it('rejects malformed boards', () => {
    const base = JSON.parse(serializeGame(newGame(1))) as Record<string, unknown>;

    const wrongRows = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    (wrongRows.board as unknown[]).pop();
    expect(parseGame(JSON.stringify(wrongRows))).toBeNull();

    const wrongCols = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    ((wrongCols.board as unknown[][])[0]!).pop();
    expect(parseGame(JSON.stringify(wrongCols))).toBeNull();
  });

  it('rejects non-power-of-two tile values and value 1', () => {
    const base = JSON.parse(serializeGame(newGame(1))) as Record<string, unknown>;
    const bad = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    (bad.board as Record<string, unknown>[][])[0]![0] = { id: 1, value: 3 };
    expect(parseGame(JSON.stringify(bad))).toBeNull();

    const one = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    (one.board as Record<string, unknown>[][])[0]![0] = { id: 1, value: 1 };
    expect(parseGame(JSON.stringify(one))).toBeNull();
  });

  it('rejects duplicate tile ids', () => {
    const raw = JSON.parse(serializeGame(stateFromBoard(parseBoard('2200/0000/0000/0000')))) as Record<string, unknown>;
    (raw.board as Record<string, unknown>[][])[0]![1] = { id: 1, value: 2 };
    expect(parseGame(JSON.stringify(raw))).toBeNull();
  });

  it('rejects invalid scalars', () => {
    const base = JSON.parse(serializeGame(newGame(1))) as Record<string, unknown>;
    const cases: Array<[string, unknown]> = [
      ['score', -1],
      ['score', '100'],
      ['status', 'PAUSED'],
      ['won', 'true'],
      ['moves', -1],
      ['moves', 1.5],
      ['seed', -1],
      ['seed', 2 ** 32],
      ['rngState', 1.5],
      ['elapsedMs', -5],
    ];
    for (const [key, value] of cases) {
      const bad = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
      bad[key] = value;
      expect(parseGame(JSON.stringify(bad)), `reject ${key}=${String(value)}`).toBeNull();
    }
  });

  it('rejects non-JSON and non-object input', () => {
    expect(parseGame('not json')).toBeNull();
    expect(parseGame('null')).toBeNull();
    expect(parseGame('[1,2,3]')).toBeNull();
  });
});

describe('v1 migration (R-04 / FR-05 AC-05)', () => {
  function v1Save(overrides: Record<string, unknown> = {}): string {
    const cells = [
      { x: 0, y: 0, value: 2 },
      { x: 1, y: 0, value: 4 },
      null,
    ];
    while (cells.length < 16) cells.push(null);
    return JSON.stringify({
      grid: { size: 4, cells },
      score: 36,
      over: false,
      won: true,
      keepPlaying: false,
      ...overrides,
    });
  }

  it('maps v1 grid.cells to v2 board', () => {
    const s = migrateGameV1(v1Save(), 5000);
    expect(s).not.toBeNull();
    expect(s!.board[0]?.value).toBe(2);
    expect(s!.board[1]?.value).toBe(4);
    expect(s!.score).toBe(36);
    expect(s!.status).toBe('WON');
    expect(s!.won).toBe(true);
    expect(s!.schemaVersion).toBe(2);
    expect(s!.updatedAt).toBe(5000);
  });

  it('maps over / keepPlaying status variants', () => {
    expect(migrateGameV1(v1Save({ over: true }))!.status).toBe('OVER');
    expect(migrateGameV1(v1Save({ won: true, keepPlaying: true }))!.status).toBe('POST_WIN');
    expect(migrateGameV1(v1Save({ won: false }))!.status).toBe('PLAYING');
  });

  it('rejects malformed v1 saves', () => {
    expect(migrateGameV1('nope')).toBeNull();
    expect(migrateGameV1(JSON.stringify({ grid: { cells: [] } }))).toBeNull();
    const bad = JSON.parse(v1Save()) as Record<string, unknown>;
    (bad.grid as Record<string, unknown>).cells = [{ x: 9, y: 9, value: 2 }];
    expect(migrateGameV1(JSON.stringify(bad))).toBeNull();
    const badValue = JSON.parse(v1Save()) as Record<string, unknown>;
    (badValue.grid as Record<string, unknown>).cells = [{ x: 0, y: 0, value: 7 }];
    expect(migrateGameV1(JSON.stringify(badValue))).toBeNull();
  });

  it('migrates bestScore string to number', () => {
    expect(migrateBestV1('2048')).toBe(2048);
    expect(migrateBestV1('12.9')).toBe(12);
    expect(migrateBestV1('abc')).toBeNull();
    expect(migrateBestV1('-5')).toBeNull();
    expect(migrateBestV1(null)).toBeNull();
  });
});
