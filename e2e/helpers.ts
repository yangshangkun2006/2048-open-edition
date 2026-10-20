import type { Page } from '@playwright/test';

// Shared helpers: board injection via localStorage (schema v2, per FR-05)
// using the compact notation from the PRD golden vectors (0 = empty, greedy
// longest-power-of-two parsing).

const POWERS = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2];

export interface TileInfo {
  value: number;
  c: number;
  r: number;
}

export async function tiles(page: Page): Promise<TileInfo[]> {
  const list = await page.locator('.tile').evaluateAll((els) =>
    els.map((el) => {
      const e = el as HTMLElement;
      return { value: Number(e.dataset.value), c: Number(e.dataset.c), r: Number(e.dataset.r) };
    }),
  );
  // DOM order is not contractual (nodes persist by id); compare by position.
  return list.sort((a, b) => a.r * 4 + a.c - (b.r * 4 + b.c));
}

export function tileCount(page: Page): Promise<number> {
  return page.locator('.tile').count();
}

export interface InjectOptions {
  score?: number;
  moves?: number;
  status?: 'PLAYING' | 'WON' | 'POST_WIN' | 'OVER';
  won?: boolean;
}

export function gameStateJson(spec: string, opts: InjectOptions = {}): string {
  const rows = spec.split('/');
  if (rows.length !== 4) throw new Error(`bad board spec: ${spec}`);

  let id = 1;
  let maxTile = 0;
  const board: ({ id: number; value: number } | null)[][] = rows.map((row) => {
    const cells: ({ id: number; value: number } | null)[] = [];
    let rest = row.trim();
    while (rest.length > 0 && cells.length < 4) {
      if (rest.startsWith('0')) {
        rest = rest.slice(1);
        cells.push(null);
        continue;
      }
      const p = POWERS.find((v) => rest.startsWith(String(v)));
      if (p === undefined) throw new Error(`bad board spec cell: ${spec}`);
      if (p > maxTile) maxTile = p;
      cells.push({ id: id++, value: p });
      rest = rest.slice(String(p).length);
    }
    if (rest.length > 0) throw new Error(`bad board spec row: ${spec}`);
    return cells;
  });

  return JSON.stringify({
    schemaVersion: 2,
    board,
    score: opts.score ?? 0,
    status: opts.status ?? 'PLAYING',
    won: opts.won ?? false,
    moves: opts.moves ?? 0,
    maxTile,
    seed: 42,
    rngState: 42,
    elapsedMs: 0,
    startedAt: 0,
    updatedAt: Date.now(),
  });
}

export async function injectBoard(page: Page, spec: string, opts: InjectOptions = {}): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    ['2048:v2:game', gameStateJson(spec, opts)] as [string, string],
  );
  await page.goto('/');
}

export async function injectBest(page: Page, best: number): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    ['2048:v2:best', String(best)] as [string, string],
  );
}
