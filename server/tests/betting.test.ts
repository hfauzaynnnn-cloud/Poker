import { describe, it, expect } from 'vitest';
import { getLegalActions, applyBettingAction, isBettingRoundComplete } from '../src/domain/betting/bettingEngine';
import { createInitialGameState, startNewHand } from '../src/domain/game/handController';
import { Deck } from '../src/domain/deck/deck';
import { AIType, ActionType, PlayerStatus } from '../src/domain/game/types';
import type { GameState } from '../src/domain/game/types';

function makeGame(numPlayers = 3, sb = 10, bb = 20, stack = 500): GameState {
  const defs = Array.from({ length: numPlayers }, (_, i) => ({
    id: `p${i + 1}`, name: `Player ${i + 1}`, aiType: AIType.HUMAN,
  }));
  const state = createInitialGameState(defs, { smallBlind: sb, bigBlind: bb, startingStack: stack, maxPlayers: 9, aiDelay: 0 });
  const deck = Deck.seeded(123);
  return startNewHand(state, deck);
}

// ─── Legal Action Tests ───────────────────────────────────────────────────────

describe('getLegalActions()', () => {
  it('first to act preflop can fold, call, or raise', () => {
    const state = makeGame(3);
    // Preflop: UTG is first to act (seat 2 in 3-player: seats 0=SB, 1=BB, 2=UTG)
    const actingSeat = state.actionSeat!;
    const actor = state.players.find(p => p.seat === actingSeat)!;
    const legal = getLegalActions(state, actor.id);

    expect(legal.canFold).toBe(true);
    expect(legal.canCall).toBe(true);   // Must call BB
    expect(legal.canRaise).toBe(true);
    expect(legal.canCheck).toBe(false); // Facing a bet (BB)
    expect(legal.callAmount).toBeGreaterThanOrEqual(20); // need to call BB=20
  });

  it('BB gets option to check after everyone calls', () => {
    let state = makeGame(3);
    // UTG calls
    const utg = state.players.find(p => p.seat === state.actionSeat)!;
    const { state: s2 } = applyBettingAction(state, utg.id, ActionType.CALL, 20);
    // SB calls
    const sb = s2.players.find(p => p.seat === s2.actionSeat)!;
    const { state: s3 } = applyBettingAction(s2, sb.id, ActionType.CALL, 10);
    // BB should be able to check
    const bb = s3.players.find(p => p.seat === s3.actionSeat)!;
    const legal = getLegalActions(s3, bb.id);
    expect(legal.canCheck).toBe(true);
  });

  it('cannot check when facing a bet', () => {
    const state = makeGame(3);
    const actingSeat = state.actionSeat!;
    const actor = state.players.find(p => p.seat === actingSeat)!;
    const legal = getLegalActions(state, actor.id);
    expect(legal.canCheck).toBe(false); // facing BB
  });

  it('min raise must be at least 2×BB on clean raise', () => {
    const state = makeGame(3, 10, 20, 500);
    const actingSeat = state.actionSeat!;
    const actor = state.players.find(p => p.seat === actingSeat)!;
    const legal = getLegalActions(state, actor.id);
    // minRaise = current bet + last raise size = 20 + 20 = 40 total, minus already contributed (0) = 40
    expect(legal.raiseMin).toBeGreaterThanOrEqual(40);
  });

  it('short stack must go all-in if stack <= toCall', () => {
    const defs = [
      { id: 'p1', name: 'P1', aiType: AIType.HUMAN },
      { id: 'p2', name: 'P2', aiType: AIType.HUMAN },
    ];
    let state = createInitialGameState(defs, { smallBlind: 10, bigBlind: 20, startingStack: 1000, maxPlayers: 9, aiDelay: 0 });
    // Manually give p1 only 15 chips (less than BB=20)
    state = {
      ...state,
      players: state.players.map(p => p.id === 'p1' ? { ...p, stack: 15 } : p),
    };
    const deck2 = Deck.seeded(5);
    const inPlay = startNewHand(state, deck2);
    const actor = inPlay.players.find(p => p.seat === inPlay.actionSeat)!;
    const legal = getLegalActions(inPlay, actor.id);
    if (actor.stack < 20) {
      expect(legal.mustGoAllIn).toBe(true);
    }
  });
});

// ─── Action Application Tests ─────────────────────────────────────────────────

describe('applyBettingAction()', () => {
  it('fold marks player as folded', () => {
    const state = makeGame(3);
    const actor = state.players.find(p => p.seat === state.actionSeat)!;
    const { state: after } = applyBettingAction(state, actor.id, ActionType.FOLD);
    const p = after.players.find(p => p.id === actor.id)!;
    expect(p.status).toBe(PlayerStatus.FOLDED);
  });

  it('call deducts chips from stack', () => {
    const state = makeGame(3);
    const actor = state.players.find(p => p.seat === state.actionSeat)!;
    const legal = getLegalActions(state, actor.id);
    const stackBefore = actor.stack;
    const { state: after } = applyBettingAction(state, actor.id, ActionType.CALL, legal.callAmount);
    const p = after.players.find(p => p.id === actor.id)!;
    expect(p.stack).toBe(stackBefore - legal.callAmount);
    expect(p.roundContributed).toBe(legal.callAmount);
  });

  it('raise increases current bet', () => {
    const state = makeGame(3);
    const actor = state.players.find(p => p.seat === state.actionSeat)!;
    const { state: after } = applyBettingAction(state, actor.id, ActionType.RAISE, 60);
    expect(after.currentBet).toBeGreaterThan(state.currentBet);
  });

  it('going all-in marks player ALL_IN', () => {
    const state = makeGame(3, 10, 20, 100);
    const actor = state.players.find(p => p.seat === state.actionSeat)!;
    const { state: after } = applyBettingAction(state, actor.id, ActionType.RAISE, actor.stack);
    const p = after.players.find(p => p.id === actor.id)!;
    expect(p.status).toBe(PlayerStatus.ALL_IN);
    expect(p.stack).toBe(0);
  });

  it('check throws when facing a bet', () => {
    const state = makeGame(3);
    const actor = state.players.find(p => p.seat === state.actionSeat)!;
    expect(() => applyBettingAction(state, actor.id, ActionType.CHECK)).toThrow();
  });
});

// ─── Round Completion Tests ───────────────────────────────────────────────────

describe('isBettingRoundComplete()', () => {
  it('not complete when action is pending', () => {
    const state = makeGame(3);
    expect(isBettingRoundComplete(state)).toBe(false);
  });

  it('complete when all players have acted', () => {
    let state = makeGame(2); // heads-up
    const p1 = state.players.find(p => p.seat === state.actionSeat)!;
    const { state: s2 } = applyBettingAction(state, p1.id, ActionType.CALL, 10);
    // p2 should now be able to check (BB's option)
    const p2 = s2.players.find(p => p.seat === s2.actionSeat)!;
    const { state: s3 } = applyBettingAction(s2, p2.id, ActionType.CHECK);
    expect(isBettingRoundComplete(s3)).toBe(true);
  });
});
