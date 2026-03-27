import { Card, Rank, Suit, rankName, rankNamePlural } from '../cards/types';

// ─── Hand Categories ──────────────────────────────────────────────────────────

export enum HandCategory {
  HIGH_CARD       = 1,
  ONE_PAIR        = 2,
  TWO_PAIR        = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT        = 5,
  FLUSH           = 6,
  FULL_HOUSE      = 7,
  FOUR_OF_A_KIND  = 8,
  STRAIGHT_FLUSH  = 9,
}

export interface HandEvaluation {
  category: HandCategory;
  /** Higher = stronger for sorting */
  categoryRank: number;
  /** Ordered tiebreak values — compare element-by-element */
  tiebreaks: number[];
  /** The winning 5-card selection */
  chosenCards: Card[];
  /** Human-readable label */
  label: string;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

/** All C(n,2) index pairs */
function combinations<T>(arr: T[], r: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, current: T[]) {
    if (current.length === r) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }
  helper(0, []);
  return result;
}

/** Evaluate the best 5-card hand from exactly 7 cards */
export function evaluateSevenCards(cards: Card[]): HandEvaluation {
  if (cards.length < 5) throw new Error('Need at least 5 cards to evaluate');
  const combos = combinations(cards, 5);
  let best: HandEvaluation | null = null;
  for (const combo of combos) {
    const eval5 = evaluateFiveCards(combo);
    if (!best || compareHands(eval5, best) > 0) {
      best = eval5;
    }
  }
  return best!;
}

/** Evaluate exactly 5 cards */
export function evaluateFiveCards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) throw new Error(`Expected 5 cards, got ${cards.length}`);

  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including wheel: A-2-3-4-5)
  const isStraight = checkStraight(ranks);
  const straightHighCard = getStraightHigh(ranks);

  if (isFlush && isStraight) {
    const label = straightHighCard === Rank.ACE
      ? 'Royal Flush'
      : `Straight Flush, ${rankName(straightHighCard as Rank)} high`;
    return {
      category: HandCategory.STRAIGHT_FLUSH,
      categoryRank: HandCategory.STRAIGHT_FLUSH,
      tiebreaks: [straightHighCard],
      chosenCards: sortForStraight(cards, ranks),
      label,
    };
  }

  // Count rank frequencies
  const freq = rankFrequency(ranks);
  const groups = Object.entries(freq)
    .map(([r, c]) => ({ rank: Number(r) as Rank, count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Four of a Kind
  if (groups[0].count === 4) {
    const quadRank = groups[0].rank;
    const kicker = groups[1].rank;
    return {
      category: HandCategory.FOUR_OF_A_KIND,
      categoryRank: HandCategory.FOUR_OF_A_KIND,
      tiebreaks: [quadRank, kicker],
      chosenCards: cards,
      label: `Four of a Kind, ${rankNamePlural(quadRank)}`,
    };
  }

  // Full House
  if (groups[0].count === 3 && groups[1].count === 2) {
    const tripsRank = groups[0].rank;
    const pairRank = groups[1].rank;
    return {
      category: HandCategory.FULL_HOUSE,
      categoryRank: HandCategory.FULL_HOUSE,
      tiebreaks: [tripsRank, pairRank],
      chosenCards: cards,
      label: `Full House, ${rankNamePlural(tripsRank)} full of ${rankNamePlural(pairRank)}`,
    };
  }

  // Flush
  if (isFlush) {
    return {
      category: HandCategory.FLUSH,
      categoryRank: HandCategory.FLUSH,
      tiebreaks: ranks,
      chosenCards: cards.sort((a, b) => b.rank - a.rank),
      label: `${rankName(ranks[0])}-high Flush`,
    };
  }

  // Straight
  if (isStraight) {
    return {
      category: HandCategory.STRAIGHT,
      categoryRank: HandCategory.STRAIGHT,
      tiebreaks: [straightHighCard],
      chosenCards: sortForStraight(cards, ranks),
      label: `Straight, ${rankName(straightHighCard as Rank)} high`,
    };
  }

  // Three of a Kind
  if (groups[0].count === 3) {
    const tripsRank = groups[0].rank;
    const kickers = groups.slice(1).map(g => g.rank).sort((a, b) => b - a);
    return {
      category: HandCategory.THREE_OF_A_KIND,
      categoryRank: HandCategory.THREE_OF_A_KIND,
      tiebreaks: [tripsRank, ...kickers],
      chosenCards: cards,
      label: `Three of a Kind, ${rankNamePlural(tripsRank)}`,
    };
  }

  // Two Pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    const high = Math.max(groups[0].rank, groups[1].rank) as Rank;
    const low = Math.min(groups[0].rank, groups[1].rank) as Rank;
    const kicker = groups[2].rank;
    return {
      category: HandCategory.TWO_PAIR,
      categoryRank: HandCategory.TWO_PAIR,
      tiebreaks: [high, low, kicker],
      chosenCards: cards,
      label: `Two Pair, ${rankNamePlural(high)} and ${rankNamePlural(low)}`,
    };
  }

  // One Pair
  if (groups[0].count === 2) {
    const pairRank = groups[0].rank;
    const kickers = groups.slice(1).map(g => g.rank).sort((a, b) => b - a);
    return {
      category: HandCategory.ONE_PAIR,
      categoryRank: HandCategory.ONE_PAIR,
      tiebreaks: [pairRank, ...kickers],
      chosenCards: cards,
      label: `Pair of ${rankNamePlural(pairRank)}`,
    };
  }

  // High Card
  return {
    category: HandCategory.HIGH_CARD,
    categoryRank: HandCategory.HIGH_CARD,
    tiebreaks: ranks,
    chosenCards: cards.sort((a, b) => b.rank - a.rank),
    label: `${rankName(ranks[0])}-high`,
  };
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal */
export function compareHands(a: HandEvaluation, b: HandEvaluation): 1 | 0 | -1 {
  if (a.categoryRank !== b.categoryRank) {
    return a.categoryRank > b.categoryRank ? 1 : -1;
  }
  for (let i = 0; i < Math.min(a.tiebreaks.length, b.tiebreaks.length); i++) {
    if (a.tiebreaks[i] !== b.tiebreaks[i]) {
      return a.tiebreaks[i] > b.tiebreaks[i] ? 1 : -1;
    }
  }
  return 0;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rankFrequency(ranks: Rank[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (const r of ranks) freq[r] = (freq[r] ?? 0) + 1;
  return freq;
}

function checkStraight(sortedRanks: Rank[]): boolean {
  // Normal straight
  const normal = sortedRanks[0] - sortedRanks[4] === 4 &&
    new Set(sortedRanks).size === 5;
  if (normal) return true;
  // Wheel: A-2-3-4-5
  const isWheel =
    sortedRanks[0] === Rank.ACE &&
    sortedRanks[1] === Rank.FIVE &&
    sortedRanks[2] === Rank.FOUR &&
    sortedRanks[3] === Rank.THREE &&
    sortedRanks[4] === Rank.TWO;
  return isWheel;
}

function getStraightHigh(sortedRanks: Rank[]): number {
  // Wheel: 5-high
  if (
    sortedRanks[0] === Rank.ACE &&
    sortedRanks[1] === Rank.FIVE
  ) return Rank.FIVE;
  return sortedRanks[0];
}

function sortForStraight(cards: Card[], sortedRanks: Rank[]): Card[] {
  // Wheel: put Ace last
  if (sortedRanks[0] === Rank.ACE && sortedRanks[1] === Rank.FIVE) {
    const noAce = cards.filter(c => c.rank !== Rank.ACE).sort((a, b) => b.rank - a.rank);
    const ace = cards.filter(c => c.rank === Rank.ACE);
    return [...noAce, ...ace];
  }
  return cards.sort((a, b) => b.rank - a.rank);
}
