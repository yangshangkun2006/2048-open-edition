import { describe, expect, it } from 'vitest';
import type { Dir, GameState } from './types';
import { applyMove, continueGame, hasMoves } from './reducer';
import { parseBoard, stateFromBoard } from './test-helpers';

function makeState(boardSpec: string, overrides: Partial<GameState> = {}): GameState {
  const s = stateFromBoard(parseBoard(boardSpec));
  return { ...s, ...overrides };
}

describe('state machine (PRD §8.2)', () => {
  it('PLAYING -> WON on first 2048 merge', () => {
    const s = makeState('1024102424/0000/0000/0000');
    const after = applyMove(s, 'left');
    expect(after.status).toBe('WON');
    expect(after.won).toBe(true);
  });

  it('WON blocks further moves until keep-going', () => {
    const s = makeState('1024102424/0000/0000/0000');
    const won = applyMove(s, 'left');
    expect(won.status).toBe('WON');
    expect(applyMove(won, 'right')).toBe(won);
  });

  it('continueGame: WON -> POST_WIN, no new tile, timer resumes (shell)', () => {
    const s = makeState('1024102424/0000/0000/0000');
    const won = applyMove(s, 'left');
    const before = won.board;
    const post = continueGame(won);
    expect(post.status).toBe('POST_WIN');
    expect(post.board).toBe(before); // no spawn
    expect(post.score).toBe(won.score);
  });

  it('continueGame only applies from WON', () => {
    const s = makeState('2000/0000/0000/0000');
    expect(continueGame(s)).toBe(s);
    const over = makeState('24816/42168/81624/16842', { status: 'OVER' });
    expect(continueGame(over)).toBe(over);
  });

  it('POST_WIN: second 2048 does not re-trigger WON', () => {
    const s = makeState('1024102424/0000/0000/0000', { status: 'POST_WIN', won: true });
    const after = applyMove(s, 'left');
    expect(after.status).toBe('POST_WIN'); // no re-popup (PRD §6.7)
    expect(after.won).toBe(true);
    expect(after.score).toBe(2048);
  });

  it('POST_WIN -> OVER keeps the win badge', () => {
    // Full board whose only match is a 2+2 pair at row 0; after merge + spawn
    // the board is full without matches (for spawn value 2 or 4).
    const s = makeState('22816/832232/162328/416832', { status: 'POST_WIN', won: true });
    expect(hasMoves(s.board)).toBe(true);
    const after = applyMove(s, 'left');
    expect(after.status).toBe('OVER');
    expect(after.won).toBe(true);
    expect(after.score).toBe(4);
  });

  it('OVER blocks all moves', () => {
    const s = makeState('24816/42168/81624/16842', { status: 'OVER' });
    for (const dir of ['left', 'right', 'up', 'down'] as Dir[]) {
      expect(applyMove(s, dir)).toBe(s);
    }
  });

  it('win and over in the same move: status OVER, won badge set', () => {
    const s = makeState('10241024816/416232/24328/16842');
    const after = applyMove(s, 'left');
    expect(after.won).toBe(true);
    expect(after.status).toBe('OVER');
  });
});
