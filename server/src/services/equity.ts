import { Card, Rank, Suit } from '../domain/cards/types';
import { evaluateSevenCards } from '../domain/evaluator/handEvaluator';
import { Deck, buildDeck } from '../domain/deck/deck';

export interface EquityRequest {
  heroCards: [Card, Card];
  opponentCards?: [Card, Card][];        // Known opponent hands
  boardCards: Card[];                    // 0-5 known community cards
  numOpponents?: number;                 // For Monte Carlo (unknown hands)
  iterations?: number;
  seed?: number;
}

export interface EquityResult {
  winPct: number;
  tiePct: number;
  lossPct: number;
  wins: number;
  ties: number;
  losses: number;
  total: number;
  method: 'exact' | 'montecarlo';
  elapsedMs: number;
}

/**
 * Auto-selects exact enumeration or Monte Carlo based on remaining state space.
 */
export function calculateEquity(req: EquityRequest): EquityResult {
  const boardLeft = 5 - req.boardCards.length;
  const knownCards = req.heroCards.length + (req.boardCards.length);
  const remainingDeck = 52 - knownCards - (req.opponentCards?.flat().length ?? 0);

  if (req.opponentCards && req.opponentCards.length > 0 && boardLeft <= 2) {
    return calculateEquityExact(req);
  }
  return calculateEquityMonteCarlo(req, req.iterations ?? 20000, req.seed);
}

/**
 * Exact enumeration: enumerate all possible remaining board cards.
 * Only practical when opponent hands are known and few cards remain.
 */
export function calculateEquityExact(req: EquityRequest): EquityResult {
  const start = Date.now();
  const knownCardIds = new Set<number>([
    ...req.heroCards.map(c => c.id),
    ...(req.opponentCards?.flat().map(c => c.id) ?? []),
    ...req.boardCards.map(c => c.id),
  ]);

  const available = buildDeck().filter(c => !knownCardIds.has(c.id));
  const boardLeft = 5 - req.boardCards.length;

  const opponents = req.opponentCards ?? [];
  let wins = 0, ties = 0, losses = 0;

  const boardCombos = combinations(available, boardLeft);

  for (const extra of boardCombos) {
    const board = [...req.boardCards, ...extra];
    const heroEval = evaluateSevenCards([...req.heroCards, ...board]);

    let heroWins = true, heroTies = false;
    for (const opp of opponents) {
      const oppEval = evaluateSevenCards([...opp, ...board]);
      const cmp = compareEvals(heroEval, oppEval);
      if (cmp < 0) { heroWins = false; heroTies = false; break; }
      if (cmp === 0) { heroWins = false; heroTies = true; }
    }
    if (heroWins) wins++;
    else if (heroTies) ties++;
    else losses++;
  }

  const total = wins + ties + losses;
  return {
    wins, ties, losses, total,
    winPct: (wins / total) * 100,
    tiePct: (ties / total) * 100,
    lossPct: (losses / total) * 100,
    method: 'exact',
    elapsedMs: Date.now() - start,
  };
}

/**
 * Monte Carlo equity estimation: random runouts.
 */
export function calculateEquityMonteCarlo(
  req: EquityRequest,
  iterations = 20000,
  seed?: number,
): EquityResult {
  const start = Date.now();
  const knownCardIds = new Set<number>([
    ...req.heroCards.map(c => c.id),
    ...(req.opponentCards?.flat().map(c => c.id) ?? []),
    ...req.boardCards.map(c => c.id),
  ]);

  const available = buildDeck().filter(c => !knownCardIds.has(c.id));
  const numOpponents = req.opponentCards?.length ?? (req.numOpponents ?? 1);
  const boardLeft = 5 - req.boardCards.length;
  const cardsNeededPerSim = boardLeft + (req.opponentCards ? 0 : numOpponents * 2);

  let wins = 0, ties = 0, losses = 0;
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffle([...available], rng);
    const drawn = shuffled.slice(0, cardsNeededPerSim);

    let idx = 0;
    // Deal opponent cards if unknown
    const oppHands: [Card, Card][] = req.opponentCards
      ? req.opponentCards
      : Array.from({ length: numOpponents }, () => [drawn[idx++], drawn[idx++]] as [Card, Card]);

    const board = [...req.boardCards, ...drawn.slice(idx, idx + boardLeft)];
    if (board.length !== 5) continue;

    const heroEval = evaluateSevenCards([...req.heroCards, ...board]);
    let heroWins = true, heroTies = false;

    for (const opp of oppHands) {
      const oppEval = evaluateSevenCards([...opp, ...board]);
      const cmp = compareEvals(heroEval, oppEval);
      if (cmp < 0) { heroWins = false; heroTies = false; break; }
      if (cmp === 0) { heroWins = false; heroTies = true; }
    }

    if (heroWins) wins++;
    else if (heroTies) ties++;
    else losses++;
  }

  const total = wins + ties + losses || 1;
  return {
    wins, ties, losses, total,
    winPct: (wins / total) * 100,
    tiePct: (ties / total) * 100,
    lossPct: (losses / total) * 100,
    method: 'montecarlo',
    elapsedMs: Date.now() - start,
  };
}

// ─── Pot Odds & EV ───────────────────────────────────────────────────────────

export function calcPotOdds(pot: number, callAmount: number): number {
  if (callAmount <= 0) return 0;
  return (callAmount / (pot + callAmount)) * 100;
}

export function calcEV(winProb: number, totalPotWon: number, callAmount: number): number {
  const loseProb = 1 - winProb;
  return winProb * totalPotWon - loseProb * callAmount;
}

export function isProfitableCall(equityPct: number, potOddsPct: number): boolean {
  return equityPct > potOddsPct;
}

// ─── Outs Calculator ─────────────────────────────────────────────────────────

export interface OutsResult {
  outs: number;
  draws: string[];
  ruleOf4Pct: number;  // after flop
  ruleOf2Pct: number;  // after turn
}

export function calculateOuts(holeCards: [Card, Card], board: Card[]): OutsResult {
  const all = [...holeCards, ...board];
  const suits = all.map(c => c.suit);
  const ranks = all.map(c => c.rank);
  const draws: string[] = [];
  let outs = 0;

  // Flush draw: 4 of same suit
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] ?? 0) + 1;
  const flushSuit = Object.entries(suitCounts).find(([, c]) => c === 4);
  if (flushSuit) {
    outs += 9;
    draws.push('Flush draw (9 outs)');
  }

  // Straight draws
  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);
  const { oesd, gutshot } = checkStraightDraws(uniqueRanks);
  if (oesd && !gutshot) {
    outs += 8;
    draws.push('Open-ended straight draw (8 outs)');
  } else if (gutshot) {
    outs += 4;
    draws.push('Gutshot straight draw (4 outs)');
  }

  // Dedup (flush+straight combo)
  if (flushSuit && (oesd || gutshot)) {
    // Subtract 2 for straight flush outs already counted in flush outs
    outs -= 2;
    draws.push('(combo draw — 2 outs deducted for overlap)');
  }

  return {
    outs,
    draws,
    ruleOf4Pct: outs * 4,
    ruleOf2Pct: outs * 2,
  };
}

function checkStraightDraws(sortedRanks: number[]): { oesd: boolean; gutshot: boolean } {
  // Check for 4-consecutive (OESD) or 4 within a window of 5 (gutshot)
  let oesd = false, gutshot = false;
  for (let high = 5; high <= 14; high++) {
    const window = [high - 4, high - 3, high - 2, high - 1, high];
    const hits = window.filter(r => sortedRanks.includes(r)).length;
    const gaps = window.filter(r => !sortedRanks.includes(r)).length;
    if (hits === 4 && gaps === 1) {
      const missingIdx = window.findIndex(r => !sortedRanks.includes(r));
      if (missingIdx === 0 || missingIdx === 4) oesd = true;
      else gutshot = true;
    }
  }
  return { oesd, gutshot };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function combinations<T>(arr: T[], r: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, current: T[]) {
    if (current.length === r) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]); helper(i + 1, current); current.pop();
    }
  }
  helper(0, []);
  return result;
}

function compareEvals(a: any, b: any): number {
  if (a.categoryRank !== b.categoryRank) return a.categoryRank > b.categoryRank ? 1 : -1;
  for (let i = 0; i < Math.min(a.tiebreaks.length, b.tiebreaks.length); i++) {
    if (a.tiebreaks[i] !== b.tiebreaks[i]) return a.tiebreaks[i] > b.tiebreaks[i] ? 1 : -1;
  }
  return 0;
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
