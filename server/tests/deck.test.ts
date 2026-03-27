import { describe, it, expect } from 'vitest';
import { buildDeck, Deck } from '../src/domain/deck/deck';
import { Rank, Suit, parseCard, cardLabel } from '../src/domain/cards/types';

// ─── Deck Tests ───────────────────────────────────────────────────────────────

describe('buildDeck()', () => {
  it('produces exactly 52 cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
  });

  it('produces all unique IDs (0-51)', () => {
    const deck = buildDeck();
    const ids = new Set(deck.map(c => c.id));
    expect(ids.size).toBe(52);
    expect(Math.min(...ids)).toBe(0);
    expect(Math.max(...ids)).toBe(51);
  });

  it('contains every rank×suit combination', () => {
    const deck = buildDeck();
    const keys = new Set(deck.map(c => `${c.rank}${c.suit}`));
    expect(keys.size).toBe(52);
    // Spot-check
    expect(keys.has(`${Rank.ACE}${Suit.SPADES}`)).toBe(true);
    expect(keys.has(`${Rank.TWO}${Suit.CLUBS}`)).toBe(true);
    expect(keys.has(`${Rank.KING}${Suit.HEARTS}`)).toBe(true);
  });
});

describe('Deck class', () => {
  it('Deck.create() shuffles — order differs from sorted deck', () => {
    // Over many attempts, at least one pair should differ
    const base = buildDeck().map(c => c.id);
    let differs = false;
    for (let i = 0; i < 5; i++) {
      const shuffled = Deck.create().peek().map(c => c.id);
      if (shuffled.some((id, idx) => id !== base[idx])) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('Deck.seeded() is deterministic', () => {
    const a = Deck.seeded(42).peek().map(c => c.id);
    const b = Deck.seeded(42).peek().map(c => c.id);
    expect(a).toEqual(b);
  });

  it('Deck.seeded() with different seeds produces different orders', () => {
    const a = Deck.seeded(1).peek().map(c => c.id);
    const b = Deck.seeded(2).peek().map(c => c.id);
    expect(a).not.toEqual(b);
  });

  it('deal() returns cards in order', () => {
    const deck = Deck.seeded(99);
    const ordered = deck.peek();
    for (let i = 0; i < 5; i++) {
      const dealt = deck.deal();
      expect(dealt.id).toBe(ordered[i].id);
    }
  });

  it('deal() throws when empty', () => {
    const deck = Deck.seeded(1);
    for (let i = 0; i < 52; i++) deck.deal();
    expect(() => deck.deal()).toThrow();
  });

  it('burn() consumes a card without returning it', () => {
    const deck = Deck.seeded(5);
    const first = deck.peek()[0];
    deck.burn();
    const second = deck.deal();
    expect(second.id).not.toBe(first.id);
    expect(deck.remaining).toBe(50);
  });

  it('no duplicates in 52 deals', () => {
    const deck = Deck.create();
    const dealt: number[] = [];
    for (let i = 0; i < 52; i++) dealt.push(deck.deal().id);
    expect(new Set(dealt).size).toBe(52);
  });
});

// ─── Card Parsing ─────────────────────────────────────────────────────────────

describe('parseCard()', () => {
  it('parses Ah', () => {
    const c = parseCard('Ah');
    expect(c.rank).toBe(Rank.ACE);
    expect(c.suit).toBe(Suit.HEARTS);
  });
  it('parses 2c', () => {
    const c = parseCard('2c');
    expect(c.rank).toBe(Rank.TWO);
    expect(c.suit).toBe(Suit.CLUBS);
  });
  it('parses Td', () => {
    const c = parseCard('Td');
    expect(c.rank).toBe(Rank.TEN);
    expect(c.suit).toBe(Suit.DIAMONDS);
  });
  it('parses Ks', () => {
    const c = parseCard('Ks');
    expect(c.rank).toBe(Rank.KING);
    expect(c.suit).toBe(Suit.SPADES);
  });
  it('throws on invalid rank', () => {
    expect(() => parseCard('Xh')).toThrow();
  });
  it('throws on invalid suit', () => {
    expect(() => parseCard('Ax')).toThrow();
  });
});
