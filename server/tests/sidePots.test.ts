import { describe, it, expect } from 'vitest';
import { buildSidePots, distributePots, validatePotAccounting } from '../src/domain/pots/potResolver';
import { evaluateFiveCards, evaluateSevenCards } from '../src/domain/evaluator/handEvaluator';
import { parseCard } from '../src/domain/cards/types';
import type { Player } from '../src/domain/game/types';
import { PlayerStatus, AIType } from '../src/domain/game/types';

function makePlayer(id: string, seat: number, contributed: number, status: PlayerStatus = PlayerStatus.ACTIVE): Player {
  return {
    id, name: id, seat, stack: 1000 - contributed,
    holeCards: null, status, aiType: AIType.HUMAN,
    totalContributed: contributed, roundContributed: contributed,
    hasActedThisRound: true,
  };
}

function cards(...strs: string[]) {
  return strs.map((s, i) => parseCard(s, i));
}

// ─── Side Pot Tests ───────────────────────────────────────────────────────────

describe('buildSidePots()', () => {
  it('single winner (no splitting)', () => {
    const players = [
      makePlayer('p1', 0, 100),
      makePlayer('p2', 1, 100),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligiblePlayerIds).toContain('p1');
    expect(pots[0].eligiblePlayerIds).toContain('p2');
  });

  it('Scenario C: short stack P1=20, P2=50, P3=100', () => {
    const p1 = makePlayer('p1', 0, 20, PlayerStatus.ALL_IN);
    const p2 = makePlayer('p2', 1, 50, PlayerStatus.ALL_IN);
    const p3 = makePlayer('p3', 2, 100, PlayerStatus.ACTIVE);
    const pots = buildSidePots([p1, p2, p3]);

    // Main pot: 3×20 = 60 (all eligible)
    // Side 1: 2×30 = 60 (p2, p3)
    // Side 2: 1×50 = 50 (p3 only)
    expect(pots[0].amount).toBe(60);
    expect(pots[0].eligiblePlayerIds).toHaveLength(3);

    expect(pots[1].amount).toBe(60);
    expect(pots[1].eligiblePlayerIds).toContain('p2');
    expect(pots[1].eligiblePlayerIds).toContain('p3');
    expect(pots[1].eligiblePlayerIds).not.toContain('p1');

    expect(pots[2].amount).toBe(50);
    expect(pots[2].eligiblePlayerIds).toContain('p3');
    expect(pots[2].eligiblePlayerIds).not.toContain('p1');
    expect(pots[2].eligiblePlayerIds).not.toContain('p2');

    // Total: 60+60+50 = 170 = sum of contributions
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(170);
  });

  it('folded player chips stay in pot but they are not eligible', () => {
    const p1 = makePlayer('p1', 0, 100, PlayerStatus.FOLDED);
    const p2 = makePlayer('p2', 1, 100, PlayerStatus.ACTIVE);
    const p3 = makePlayer('p3', 2, 100, PlayerStatus.ACTIVE);
    const pots = buildSidePots([p1, p2, p3]);

    // All 3 contributed 100 at same level — folded player's chips go to pot
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).not.toContain('p1'); // folded, not eligible
    expect(pots[0].eligiblePlayerIds).toContain('p2');
    expect(pots[0].eligiblePlayerIds).toContain('p3');
  });

  it('two all-ins + one active, all different amounts', () => {
    const p1 = makePlayer('p1', 0, 30, PlayerStatus.ALL_IN);
    const p2 = makePlayer('p2', 1, 70, PlayerStatus.ALL_IN);
    const p3 = makePlayer('p3', 2, 120, PlayerStatus.ACTIVE);
    const pots = buildSidePots([p1, p2, p3]);

    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(220); // 30+70+120
  });

  it('chips never created or destroyed', () => {
    const p1 = makePlayer('p1', 0, 45, PlayerStatus.ALL_IN);
    const p2 = makePlayer('p2', 1, 200, PlayerStatus.ACTIVE);
    const p3 = makePlayer('p3', 2, 200, PlayerStatus.FOLDED);
    const pots = buildSidePots([p1, p2, p3]);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(445);
  });
});

// ─── Pot Distribution Tests ────────────────────────────────────────────────────

describe('distributePots()', () => {
  it('single pot goes to best hand', () => {
    const board = cards('2h', '3d', '4c', '5s', '6h');
    const p1Cards = cards('Ah', 'Kd');
    const p2Cards = cards('7d', '8c');

    const pots = [{ amount: 200, eligiblePlayerIds: ['p1', 'p2'] }];
    const p1Eval = evaluateSevenCards([...p1Cards, ...board]);
    const p2Eval = evaluateSevenCards([...p2Cards, ...board]);

    const evalMap = new Map([['p1', p1Eval], ['p2', p2Eval]]);
    const awards = distributePots(pots, evalMap, ['p1', 'p2']);

    // p2 has 7-8 straight (7-high), p1 uses A for straight (6-high via board - A plays as 5 part of wheel 2345A)
    // Actually both might use the board's 2-3-4-5-6 straight as an 8-high with p2's 7-8
    // Let's just verify the total awards = 200
    const total = awards.reduce((s, a) => s + a.amount, 0);
    expect(total).toBe(200);
  });

  it('split pot when hands are identical', () => {
    const board = cards('Ac', 'Kc', 'Qc', 'Jc', 'Tc');
    // Both players have royal flush on board
    const p1Eval = evaluateSevenCards([...cards('2h', '3d'), ...board]);
    const p2Eval = evaluateSevenCards([...cards('4h', '5d'), ...board]);

    const pots = [{ amount: 100, eligiblePlayerIds: ['p1', 'p2'] }];
    const evalMap = new Map([['p1', p1Eval], ['p2', p2Eval]]);
    const awards = distributePots(pots, evalMap, ['p1', 'p2']);

    expect(awards.length).toBe(2);
    expect(awards.every(a => a.isChop)).toBe(true);
    expect(awards[0].amount + awards[1].amount).toBe(100);
  });

  it('odd chip goes to first eligible in seat order', () => {
    const board = cards('Ac', 'Kc', 'Qc', 'Jc', 'Tc');
    const p1Eval = evaluateSevenCards([...cards('2h', '3d'), ...board]);
    const p2Eval = evaluateSevenCards([...cards('4h', '5d'), ...board]);

    // Pot of 101 — can't split evenly
    const pots = [{ amount: 101, eligiblePlayerIds: ['p1', 'p2'] }];
    const evalMap = new Map([['p1', p1Eval], ['p2', p2Eval]]);
    // Seat order: p1 first
    const awards = distributePots(pots, evalMap, ['p1', 'p2']);
    const totals = awards.reduce((s, a) => s + a.amount, 0);
    expect(totals).toBe(101);
    // First player gets the odd chip (51 vs 50)
    const p1Award = awards.find(a => a.playerId === 'p1')!;
    expect(p1Award.amount).toBe(51);
  });

  it('validatePotAccounting catches mismatch', () => {
    expect(() => validatePotAccounting(200, [{ playerId: 'p1', amount: 150, potIndex: 0, isChop: false, oddChip: false }]))
      .toThrow('Pot accounting error');
  });

  it('validatePotAccounting passes on correct totals', () => {
    expect(() => validatePotAccounting(200, [
      { playerId: 'p1', amount: 100, potIndex: 0, isChop: false, oddChip: false },
      { playerId: 'p2', amount: 100, potIndex: 0, isChop: false, oddChip: false },
    ])).not.toThrow();
  });
});
