import { Card, Rank, Suit, ALL_RANKS, ALL_SUITS } from '../cards/types';

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      cards.push({ rank, suit, id: id++ });
    }
  }
  return cards; // 52 cards, id 0–51
}

/** Fisher-Yates in-place shuffle */
function fisherYates(cards: Card[], rng: () => number): Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Deck {
  private cards: Card[];
  private cursor: number = 0;

  private constructor(cards: Card[]) {
    this.cards = cards;
  }

  /** Standard random-shuffle deck */
  static create(): Deck {
    const cards = buildDeck();
    return new Deck(fisherYates(cards, Math.random));
  }

  /** Deterministic deck for testing */
  static seeded(seed: number): Deck {
    const cards = buildDeck();
    const rng = mulberry32(seed);
    return new Deck(fisherYates(cards, rng));
  }

  /** Inject a specific ordered deck (for debug / tests) */
  static fromOrdered(cards: Card[]): Deck {
    return new Deck([...cards]);
  }

  reset(): void {
    const cards = buildDeck();
    this.cards = fisherYates(cards, Math.random);
    this.cursor = 0;
  }

  resetSeeded(seed: number): void {
    const cards = buildDeck();
    this.cards = fisherYates(cards, mulberry32(seed));
    this.cursor = 0;
  }

  /** Remaining cards not yet dealt */
  get remaining(): number {
    return this.cards.length - this.cursor;
  }

  deal(): Card {
    if (this.cursor >= this.cards.length) {
      throw new Error('Deck is empty — cannot deal');
    }
    return this.cards[this.cursor++];
  }

  burn(): void {
    if (this.cursor >= this.cards.length) {
      throw new Error('Deck is empty — cannot burn');
    }
    this.cursor++;
  }

  /** Returns the ordered card list (useful for tests / debug) */
  peek(): Card[] {
    return [...this.cards];
  }

  /** All remaining (undealt) cards */
  peekRemaining(): Card[] {
    return this.cards.slice(this.cursor);
  }
}
