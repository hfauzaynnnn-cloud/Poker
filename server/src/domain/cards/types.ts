// ─── Card Types ──────────────────────────────────────────────────────────────

export enum Rank {
  TWO   = 2,
  THREE = 3,
  FOUR  = 4,
  FIVE  = 5,
  SIX   = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE  = 9,
  TEN   = 10,
  JACK  = 11,
  QUEEN = 12,
  KING  = 13,
  ACE   = 14,
}

export enum Suit {
  CLUBS    = 'c',
  DIAMONDS = 'd',
  HEARTS   = 'h',
  SPADES   = 's',
}

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique within a deck: 0-51 */
  id: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RANK_CHARS: Record<Rank, string> = {
  [Rank.TWO]:   '2', [Rank.THREE]: '3', [Rank.FOUR]:  '4', [Rank.FIVE]:  '5',
  [Rank.SIX]:   '6', [Rank.SEVEN]: '7', [Rank.EIGHT]: '8', [Rank.NINE]:  '9',
  [Rank.TEN]:   'T', [Rank.JACK]:  'J', [Rank.QUEEN]: 'Q', [Rank.KING]:  'K',
  [Rank.ACE]:   'A',
};

const CHAR_TO_RANK: Record<string, Rank> = Object.fromEntries(
  Object.entries(RANK_CHARS).map(([k, v]) => [v, Number(k) as Rank])
);

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.CLUBS]:    '♣',
  [Suit.DIAMONDS]: '♦',
  [Suit.HEARTS]:   '♥',
  [Suit.SPADES]:   '♠',
};

export const SUIT_COLORS: Record<Suit, 'red' | 'black'> = {
  [Suit.CLUBS]:    'black',
  [Suit.DIAMONDS]: 'red',
  [Suit.HEARTS]:   'red',
  [Suit.SPADES]:   'black',
};

export function cardLabel(card: Card): string {
  return `${RANK_CHARS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardLabelShort(card: Card): string {
  return `${RANK_CHARS[card.rank]}${card.suit}`;
}

export function rankName(rank: Rank): string {
  const names: Record<Rank, string> = {
    [Rank.TWO]: 'Two', [Rank.THREE]: 'Three', [Rank.FOUR]: 'Four',
    [Rank.FIVE]: 'Five', [Rank.SIX]: 'Six', [Rank.SEVEN]: 'Seven',
    [Rank.EIGHT]: 'Eight', [Rank.NINE]: 'Nine', [Rank.TEN]: 'Ten',
    [Rank.JACK]: 'Jack', [Rank.QUEEN]: 'Queen', [Rank.KING]: 'King',
    [Rank.ACE]: 'Ace',
  };
  return names[rank];
}

export function rankNamePlural(rank: Rank): string {
  const r = rankName(rank);
  if (rank === Rank.SIX) return 'Sixes';
  return r.endsWith('s') ? r : r + 's';
}

/**
 * Parse a short card string like "Ah", "Ks", "2c", "Td"
 */
export function parseCard(str: string, id = 0): Card {
  if (str.length < 2 || str.length > 2) {
    throw new Error(`Invalid card string: ${str}`);
  }
  const rankChar = str[0].toUpperCase();
  const suitChar = str[1].toLowerCase();

  const rank = CHAR_TO_RANK[rankChar];
  if (rank === undefined) throw new Error(`Unknown rank char: ${rankChar}`);

  const suit = Object.values(Suit).find(s => s === suitChar) as Suit | undefined;
  if (!suit) throw new Error(`Unknown suit char: ${suitChar}`);

  return { rank, suit, id };
}

export const ALL_RANKS: Rank[] = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

export const ALL_SUITS: Suit[] = [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES];
