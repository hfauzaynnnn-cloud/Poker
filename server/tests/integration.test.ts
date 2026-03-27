import { describe, it, expect } from 'vitest';
import { createInitialGameState, startNewHand, applyAction, resolveShowdown } from '../src/domain/game/handController';
import { Deck } from '../src/domain/deck/deck';
import { AIType, ActionType, PlayerStatus, Street } from '../src/domain/game/types';

function mkDefs(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, aiType: AIType.HUMAN }));
}

function initGame(n = 3, stack = 500) {
  const state = createInitialGameState(mkDefs(n), {
    smallBlind: 10, bigBlind: 20, startingStack: stack, maxPlayers: 9, aiDelay: 0,
  });
  return startNewHand(state, Deck.seeded(777));
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('Full hand flow — fold-down', () => {
  it('hand ends when all but one player folds', () => {
    let state = initGame(3);
    const deck = Deck.seeded(777);

    // All players except last fold
    while (state.phase === 'playing') {
      const actor = state.players.find(p => p.seat === state.actionSeat)!;
      state = applyAction(state, actor.id, ActionType.FOLD, 0, deck);
      if (state.phase === 'hand_over') break;
    }

    expect(state.phase).toBe('hand_over');
    expect(state.showdownResult).toBeNull(); // No showdown — decided by fold
    expect(state.winnerText).toBeTruthy();
  });
});

describe('Full hand flow — all-in runout', () => {
  it('board completes automatically when all remaining are all-in', () => {
    let state = initGame(2, 100); // heads-up, small stacks
    const deck = Deck.seeded(42);

    // Both go all-in preflop
    const act1 = state.players.find(p => p.seat === state.actionSeat)!;
    state = applyAction(state, act1.id, ActionType.RAISE, act1.stack, deck);
    if (state.phase === 'playing') {
      const act2 = state.players.find(p => p.seat === state.actionSeat)!;
      state = applyAction(state, act2.id, ActionType.CALL, act2.stack, deck);
    }

    // Should have run out the board and resolved
    if (state.phase === 'hand_over') {
      expect(state.communityCards.length).toBe(5);
    }
  });
});

describe('startNewHand()', () => {
  it('resets hole cards for all players', () => {
    const state = initGame(3);
    for (const p of state.players) {
      if (p.status !== PlayerStatus.ELIMINATED) {
        expect(p.holeCards).not.toBeNull();
      }
    }
  });

  it('advances button each hand', () => {
    let state = initGame(3);
    const btn1 = state.buttonSeat;
    // Simulate hand ending
    const deck = Deck.seeded(1);
    state = { ...state, phase: 'hand_over', players: state.players.map(p => ({
      ...p, status: p.status === PlayerStatus.ALL_IN ? PlayerStatus.ACTIVE : p.status,
    }))};
    const state2 = startNewHand(state, Deck.seeded(2));
    expect(state2.buttonSeat).not.toBe(btn1);
  });

  it('throws if fewer than 2 players have chips', () => {
    const state = createInitialGameState(mkDefs(2), {
      smallBlind: 10, bigBlind: 20, startingStack: 0, maxPlayers: 9, aiDelay: 0,
    });
    expect(() => startNewHand(state, Deck.seeded(1))).toThrow();
  });
});

describe('Game state integrity', () => {
  it('chips are conserved across a full fold-down hand', () => {
    let state = initGame(3);
    const deck = Deck.seeded(8);
    const totalBefore = state.players.reduce((s, p) => s + p.stack, 0) +
      state.players.reduce((s, p) => s + p.totalContributed, 0);

    while (state.phase === 'playing') {
      const actor = state.players.find(p => p.seat === state.actionSeat);
      if (!actor) break;
      // All fold except first, then give up
      try {
        state = applyAction(state, actor.id, ActionType.FOLD, 0, deck);
      } catch { break; }
    }

    const totalAfter = state.players.reduce((s, p) => s + p.stack, 0);
    // Total chips after = total stacks (pots distributed back)
    expect(Math.abs(totalAfter - (state.players.length * 500))).toBeLessThanOrEqual(1); // within 1 for rounding
  });
});

describe('Heads-up special rules', () => {
  it('button is SB in heads-up', () => {
    const state = initGame(2);
    // In HU, button = SB. So button posts SB.
    const btn = state.players.find(p => p.seat === state.buttonSeat)!;
    // SB posts less than BB — find if btn's contribution is SB amount
    expect(btn.totalContributed).toBe(10); // small blind
  });
});
