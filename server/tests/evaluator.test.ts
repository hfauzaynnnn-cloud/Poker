import { describe, it, expect } from 'vitest';
import {
  evaluateFiveCards,
  evaluateSevenCards,
  compareHands,
  HandCategory,
} from '../src/domain/evaluator/handEvaluator';
import { parseCard } from '../src/domain/cards/types';

// Helper: parse multiple cards
function cards(...strs: string[]) {
  return strs.map((s, i) => parseCard(s, i));
}

// ─── Five-card Evaluator ──────────────────────────────────────────────────────

describe('evaluateFiveCards() — hand categories', () => {

  it('detects Royal Flush (A K Q J T suited)', () => {
    const h = evaluateFiveCards(cards('Ah', 'Kh', 'Qh', 'Jh', 'Th'));
    expect(h.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(h.label).toBe('Royal Flush');
  });

  it('detects Straight Flush (9-high)', () => {
    const h = evaluateFiveCards(cards('9s', '8s', '7s', '6s', '5s'));
    expect(h.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(h.label).toContain('Straight Flush');
    expect(h.label).toContain('Nine');
  });

  it('detects Wheel Straight Flush (A-2-3-4-5 suited)', () => {
    const h = evaluateFiveCards(cards('As', '2s', '3s', '4s', '5s'));
    expect(h.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(h.tiebreaks[0]).toBe(5); // 5-high
  });

  it('detects Four of a Kind', () => {
    const h = evaluateFiveCards(cards('Kd', 'Kh', 'Ks', 'Kc', 'Ah'));
    expect(h.category).toBe(HandCategory.FOUR_OF_A_KIND);
    expect(h.tiebreaks[0]).toBe(13); // Kings
    expect(h.tiebreaks[1]).toBe(14); // Ace kicker
  });

  it('detects Full House', () => {
    const h = evaluateFiveCards(cards('Qd', 'Qh', 'Qs', 'Td', 'Th'));
    expect(h.category).toBe(HandCategory.FULL_HOUSE);
    expect(h.tiebreaks[0]).toBe(12); // Queens
    expect(h.tiebreaks[1]).toBe(10); // Tens
    expect(h.label).toContain('Queens full of Tens');
  });

  it('detects Flush', () => {
    const h = evaluateFiveCards(cards('Ac', '9c', '7c', '5c', '3c'));
    expect(h.category).toBe(HandCategory.FLUSH);
    expect(h.tiebreaks[0]).toBe(14);
  });

  it('detects Straight (A-high)', () => {
    const h = evaluateFiveCards(cards('As', 'Ks', 'Qd', 'Jh', 'Tc'));
    expect(h.category).toBe(HandCategory.STRAIGHT);
    expect(h.tiebreaks[0]).toBe(14);
  });

  it('detects Straight (Wheel: A-2-3-4-5)', () => {
    const h = evaluateFiveCards(cards('Ah', '2d', '3c', '4s', '5h'));
    expect(h.category).toBe(HandCategory.STRAIGHT);
    expect(h.tiebreaks[0]).toBe(5); // 5-high, not 14
    expect(h.label).toContain('Five');
  });

  it('detects Three of a Kind', () => {
    const h = evaluateFiveCards(cards('8d', '8h', '8s', 'Kc', '2d'));
    expect(h.category).toBe(HandCategory.THREE_OF_A_KIND);
    expect(h.tiebreaks[0]).toBe(8);
  });

  it('detects Two Pair', () => {
    const h = evaluateFiveCards(cards('Ad', 'Ah', 'Ks', 'Kd', '7c'));
    expect(h.category).toBe(HandCategory.TWO_PAIR);
    expect(h.tiebreaks[0]).toBe(14); // Aces high pair
    expect(h.tiebreaks[1]).toBe(13); // Kings
    expect(h.tiebreaks[2]).toBe(7);  // Kicker
  });

  it('detects One Pair', () => {
    const h = evaluateFiveCards(cards('7d', '7h', 'Ac', 'Ks', '2d'));
    expect(h.category).toBe(HandCategory.ONE_PAIR);
    expect(h.tiebreaks[0]).toBe(7);
    expect(h.tiebreaks[1]).toBe(14); // Ace kicker
  });

  it('detects High Card', () => {
    const h = evaluateFiveCards(cards('Ah', '9d', '7c', '5s', '2h'));
    expect(h.category).toBe(HandCategory.HIGH_CARD);
    expect(h.tiebreaks[0]).toBe(14);
  });
});

// ─── Seven-card Evaluator ─────────────────────────────────────────────────────

describe('evaluateSevenCards()', () => {
  it('finds best 5-card hand from 7 cards', () => {
    // K K K A A  + 2 off-suit trash: best = Full House
    const h = evaluateSevenCards(cards('Kd', 'Kh', 'Ks', 'Ac', 'Ad', '2c', '3s'));
    expect(h.category).toBe(HandCategory.FULL_HOUSE);
    expect(h.tiebreaks[0]).toBe(13); // Kings
  });

  it('finds flush among a mix of suits', () => {
    const h = evaluateSevenCards(cards('Ah', 'Kh', '9h', '5h', '2h', '7d', 'Jc'));
    expect(h.category).toBe(HandCategory.FLUSH);
  });

  it('correctly identifies board plays (all five community)', () => {
    // Board is a straight: 5 6 7 8 9 — both players have J 2 (irrelevant)
    const board = cards('5c', '6d', '7h', '8s', '9c');
    const h1 = evaluateSevenCards([...cards('Jh', '2d'), ...board]);
    const h2 = evaluateSevenCards([...cards('Js', '2c'), ...board]);
    expect(h1.category).toBe(HandCategory.STRAIGHT);
    expect(compareHands(h1, h2)).toBe(0); // Tie
  });

  it('Scenario A: AA vs KK with board K 7 2 9 J → KKK wins', () => {
    const boardCards = cards('Kd', '7c', '2s', '9h', 'Jc');
    const p1 = evaluateSevenCards([...cards('As', 'Ah'), ...boardCards]);
    const p2 = evaluateSevenCards([...cards('Ks', 'Kh'), ...boardCards]);
    expect(p2.category).toBe(HandCategory.THREE_OF_A_KIND);
    expect(compareHands(p2, p1)).toBe(1); // P2 wins
  });
});

// ─── Hand Comparison ──────────────────────────────────────────────────────────

describe('compareHands()', () => {
  it('flush beats straight', () => {
    const flush = evaluateFiveCards(cards('2c', '4c', '6c', '8c', 'Tc'));
    const straight = evaluateFiveCards(cards('2h', '3d', '4c', '5s', '6h'));
    expect(compareHands(flush, straight)).toBe(1);
  });

  it('pair of aces beats pair of kings', () => {
    const acesPair = evaluateFiveCards(cards('Ah', 'Ad', '2c', '3d', '4s'));
    const kingsPair = evaluateFiveCards(cards('Kh', 'Kd', 'Ac', 'Qd', 'Js'));
    expect(compareHands(acesPair, kingsPair)).toBe(1);
  });

  it('pair of aces with K kicker beats pair of aces with Q kicker', () => {
    const aceK = evaluateFiveCards(cards('Ah', 'Ad', 'Kc', '3d', '2s'));
    const aceQ = evaluateFiveCards(cards('As', 'Ac', 'Qd', '3h', '2c'));
    expect(compareHands(aceK, aceQ)).toBe(1);
  });

  it('identical hands return 0', () => {
    const h1 = evaluateFiveCards(cards('Ah', 'Kh', 'Qh', 'Jh', 'Th'));
    const h2 = evaluateFiveCards(cards('Ad', 'Kd', 'Qd', 'Jd', 'Td'));
    expect(compareHands(h1, h2)).toBe(0);
  });

  it('wheel straight loses to 6-high straight', () => {
    const wheel = evaluateFiveCards(cards('Ah', '2d', '3c', '4s', '5h'));
    const six = evaluateFiveCards(cards('2d', '3c', '4s', '5h', '6d'));
    expect(compareHands(six, wheel)).toBe(1);
  });

  it('full house: higher trips wins', () => {
    const aaakkk = evaluateFiveCards(cards('As', 'Ad', 'Ah', 'Kc', 'Kd'));
    const kkkaa = evaluateFiveCards(cards('Ks', 'Kd', 'Kh', 'Ac', 'Ad'));
    expect(compareHands(aaakkk, kkkaa)).toBe(1);
  });

  it('Scenario D: full board royal flush — all players tie', () => {
    const board = cards('Ac', 'Kc', 'Qc', 'Jc', 'Tc');
    const p1 = evaluateSevenCards([...cards('2h', '3d'), ...board]);
    const p2 = evaluateSevenCards([...cards('4h', '5d'), ...board]);
    expect(compareHands(p1, p2)).toBe(0); // Both use board royal flush
  });
});
