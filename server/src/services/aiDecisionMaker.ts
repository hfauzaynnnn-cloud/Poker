import { GameState, Player, PlayerStatus, AIType, ActionType, LegalActions } from '../domain/game/types';
import { getLegalActions } from '../domain/game/handController';
import { HandCategory, evaluateSevenCards } from '../domain/evaluator/handEvaluator';
import { calculateEquityMonteCarlo, calcPotOdds, isProfitableCall } from './equity';
import { Card, Rank } from '../domain/cards/types';

export interface AIDecision {
  actionType: ActionType;
  amount: number;
  reasoning: string;
}

/**
 * Main AI dispatcher — selects the correct AI behavior per player type.
 */
export function getAIDecision(state: GameState, player: Player): AIDecision {
  const legal = getLegalActions(state, player.id);

  switch (player.aiType) {
    case AIType.RANDOM:         return randomAI(legal, player);
    case AIType.TIGHT_PASSIVE:  return tightPassiveAI(legal, player, state);
    case AIType.LOOSE_AGGRESSIVE: return looseAggressiveAI(legal, player, state);
    case AIType.PROBABILITY:    return probabilityAI(legal, player, state);
    default:                    return randomAI(legal, player);
  }
}

// ─── Random AI ────────────────────────────────────────────────────────────────

function randomAI(legal: LegalActions, player: Player): AIDecision {
  const choices: ActionType[] = [];
  if (legal.canFold) choices.push(ActionType.FOLD);
  if (legal.canCheck) choices.push(ActionType.CHECK);
  if (legal.canCall) choices.push(ActionType.CALL);
  if (legal.canRaise) choices.push(ActionType.RAISE);
  if (legal.canBet) choices.push(ActionType.BET);

  const choice = choices[Math.floor(Math.random() * choices.length)];
  const amount = choice === ActionType.RAISE
    ? legal.raiseMin + Math.floor(Math.random() * (legal.raiseMax - legal.raiseMin))
    : choice === ActionType.BET
    ? legal.betMin + Math.floor(Math.random() * (legal.betMax - legal.betMin))
    : legal.callAmount;

  return { actionType: choice, amount, reasoning: 'Random action' };
}

// ─── Tight Passive AI ─────────────────────────────────────────────────────────

function tightPassiveAI(legal: LegalActions, player: Player, state: GameState): AIDecision {
  if (!player.holeCards) return randomAI(legal, player);

  const strength = startingHandStrength(player.holeCards);

  if (strength <= 2) {
    // Weak hand — fold or check
    if (legal.canCheck) return { actionType: ActionType.CHECK, amount: 0, reasoning: 'Tight: weak hand, checking' };
    return { actionType: ActionType.FOLD, amount: 0, reasoning: 'Tight: weak hand, folding' };
  }

  if (strength >= 7) {
    // Premium: call or small raise
    if (legal.canCall && legal.callAmount <= player.stack * 0.2) {
      return { actionType: ActionType.CALL, amount: legal.callAmount, reasoning: 'Tight: strong hand, calling' };
    }
  }

  if (legal.canCheck) return { actionType: ActionType.CHECK, amount: 0, reasoning: 'Tight: checking' };
  if (legal.canCall && legal.callAmount <= player.stack * 0.15) {
    return { actionType: ActionType.CALL, amount: legal.callAmount, reasoning: 'Tight: calling small bet' };
  }
  return { actionType: ActionType.FOLD, amount: 0, reasoning: 'Tight: folding to pressure' };
}

// ─── Loose Aggressive AI ─────────────────────────────────────────────────────

function looseAggressiveAI(legal: LegalActions, player: Player, state: GameState): AIDecision {
  if (!player.holeCards) return randomAI(legal, player);

  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0) +
    state.players.reduce((s, p) => s + p.roundContributed, 0);

  // Aggressive: raise 2/3 pot frequently
  if (legal.canRaise && Math.random() < 0.55) {
    const raiseSize = Math.min(Math.floor(totalPot * 0.67), legal.raiseMax);
    const amt = Math.max(raiseSize, legal.raiseMin);
    return { actionType: ActionType.RAISE, amount: amt, reasoning: 'LAG: raising 2/3 pot aggressively' };
  }
  if (legal.canBet && Math.random() < 0.6) {
    const betSize = Math.min(Math.floor(totalPot * 0.67), legal.betMax);
    const amt = Math.max(betSize, legal.betMin);
    return { actionType: ActionType.BET, amount: amt, reasoning: 'LAG: betting aggressively' };
  }
  if (legal.canCall) return { actionType: ActionType.CALL, amount: legal.callAmount, reasoning: 'LAG: calling' };
  if (legal.canCheck) return { actionType: ActionType.CHECK, amount: 0, reasoning: 'LAG: checking' };
  return { actionType: ActionType.FOLD, amount: 0, reasoning: 'LAG: folding' };
}

// ─── Probability-Based AI ─────────────────────────────────────────────────────

function probabilityAI(legal: LegalActions, player: Player, state: GameState): AIDecision {
  if (!player.holeCards) return randomAI(legal, player);

  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0) +
    state.players.reduce((s, p) => s + p.roundContributed, 0);

  // Get equity estimate via Monte Carlo (fast: 3000 iterations for AI)
  const activePlayers = state.players.filter(
    p => p.id !== player.id && (p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN)
  );
  const numOpponents = activePlayers.length;

  let equity = 50;
  try {
    const result = calculateEquityMonteCarlo({
      heroCards: player.holeCards,
      boardCards: state.communityCards,
      numOpponents: Math.max(1, numOpponents),
    }, 2000);
    equity = result.winPct + result.tiePct * 0.5;
  } catch {}

  const potOddsPct = legal.callAmount > 0 ? calcPotOdds(totalPot, legal.callAmount) : 0;
  const spr = totalPot > 0 ? player.stack / totalPot : 10;
  const position = getPositionScore(state, player);
  const handStrength = evaluateCurrentHand(player.holeCards, state.communityCards);

  let reasoning = `equity=${equity.toFixed(1)}% potOdds=${potOddsPct.toFixed(1)}% pos=${position} SPR=${spr.toFixed(1)}`;

  // Decision tree
  if (equity > 70 || handStrength >= HandCategory.FLUSH) {
    // Strong hand — raise
    if (legal.canRaise) {
      const amount = Math.min(Math.floor(totalPot * 0.75), legal.raiseMax);
      return { actionType: ActionType.RAISE, amount: Math.max(amount, legal.raiseMin), reasoning: `Prob: strong hand raise — ${reasoning}` };
    }
    if (legal.canBet) {
      const amount = Math.min(Math.floor(totalPot * 0.65), legal.betMax);
      return { actionType: ActionType.BET, amount: Math.max(amount, legal.betMin), reasoning: `Prob: value bet — ${reasoning}` };
    }
  }

  if (isProfitableCall(equity, potOddsPct) || legal.canCheck) {
    if (legal.canCheck) return { actionType: ActionType.CHECK, amount: 0, reasoning: `Prob: checking — ${reasoning}` };
    if (legal.canCall) return { actionType: ActionType.CALL, amount: legal.callAmount, reasoning: `Prob: profitable call — ${reasoning}` };
  }

  // Bluff occasionally with position advantage
  if (position >= 2 && Math.random() < 0.25 && legal.canBet) {
    const amount = Math.min(Math.floor(totalPot * 0.5), legal.betMax);
    return { actionType: ActionType.BET, amount: Math.max(amount, legal.betMin), reasoning: `Prob: positional bluff — ${reasoning}` };
  }

  if (legal.canFold) return { actionType: ActionType.FOLD, amount: 0, reasoning: `Prob: fold — ${reasoning}` };
  if (legal.canCheck) return { actionType: ActionType.CHECK, amount: 0, reasoning: `Prob: forced check — ${reasoning}` };
  return { actionType: ActionType.CALL, amount: legal.callAmount, reasoning: `Prob: last resort call — ${reasoning}` };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns 1-10 score for starting hand strength */
function startingHandStrength(holeCards: [Card, Card]): number {
  const [a, b] = holeCards;
  const isPair = a.rank === b.rank;
  const isSuited = a.suit === b.suit;
  const high = Math.max(a.rank, b.rank);
  const low = Math.min(a.rank, b.rank);
  const gap = high - low;

  if (isPair) {
    if (high >= Rank.JACK) return 10;
    if (high >= Rank.NINE) return 7;
    return 4;
  }
  if (high === Rank.ACE) {
    if (low === Rank.KING) return isSuited ? 9 : 8;
    if (low >= Rank.QUEEN) return isSuited ? 8 : 7;
    if (low >= Rank.JACK) return isSuited ? 7 : 6;
    return isSuited ? 5 : 3;
  }
  if (high === Rank.KING && low >= Rank.QUEEN) return isSuited ? 7 : 6;
  if (isSuited && gap <= 2) return 5;
  if (gap <= 1 && high >= Rank.TEN) return 4;
  return 2;
}

/** Score position: 0=early, 1=middle, 2=late/button */
function getPositionScore(state: GameState, player: Player): number {
  const active = state.players.filter(
    p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
  ).length;
  const distFromButton = (player.seat - state.buttonSeat + state.players.length) % state.players.length;
  if (distFromButton === 0) return 2; // button
  if (distFromButton >= active - 1) return 2; // CO
  if (distFromButton <= 2) return 0; // EP
  return 1;
}

function evaluateCurrentHand(holeCards: [Card, Card], board: Card[]): HandCategory {
  if (board.length < 3) return HandCategory.HIGH_CARD;
  try {
    return evaluateSevenCards([...holeCards, ...board]).category;
  } catch {
    return HandCategory.HIGH_CARD;
  }
}
