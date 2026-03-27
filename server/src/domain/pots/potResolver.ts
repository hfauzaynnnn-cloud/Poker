import { PlayerId, Pot, PotAward, ShowdownResult, Player, PlayerStatus } from '../game/types';
import { HandEvaluation, compareHands } from '../evaluator/handEvaluator';

/**
 * Builds the correct side pots from each player's total contribution for this hand.
 * Algorithm: peel contribution layers in order from smallest to largest.
 *
 * Example: P1 contributed 20 (all-in), P2 contributed 50 (all-in), P3 contributed 100
 *   Layer 1 (0→20): all 3 eligible → pot = 3×20 = 60
 *   Layer 2 (20→50): P2, P3 eligible → pot = 2×30 = 60
 *   Layer 3 (50→100): P3 only → pot = 1×50 = 50 (returned to P3 if uncontested)
 */
export function buildSidePots(
  players: Player[],
): Pot[] {
  // Only count players who contributed > 0
  const contributors = players.filter(p => p.totalContributed > 0);

  // Unique sorted contribution levels
  const levels = Array.from(
    new Set(contributors.map(p => p.totalContributed))
  ).sort((a, b) => a - b);

  const pots: Pot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const layerSize = level - prevLevel;
    // Players eligible for pots up to this level
    const eligible = contributors.filter(p => p.totalContributed >= level && p.status !== PlayerStatus.FOLDED);
    // All players who contributed at this layer (including folded — chips stay in pot)
    const contributors_at_layer = contributors.filter(p => p.totalContributed >= level);

    if (eligible.length === 0) {
      // No one eligible — chips go to nobody (shouldn't happen in valid game)
      prevLevel = level;
      continue;
    }

    const potAmount = contributors_at_layer.length * layerSize;

    // If only one eligible player, return overage to them
    if (eligible.length === 1) {
      // Un-contested pot: return chips to the player (adjust their stack later)
      // We still create the pot entry but mark it so cleanup can return chips
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligible.map(p => p.id),
      });
    } else {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligible.map(p => p.id),
      });
    }

    prevLevel = level;
  }

  return pots;
}

/**
 * Distribute each pot to winner(s) based on hand evaluations.
 * Handles splits and odd-chip rules.
 * Odd chip rule: leftover chip goes to first eligible winner clockwise from button.
 */
export function distributePots(
  pots: Pot[],
  playerEvals: Map<PlayerId, HandEvaluation>,
  seatOrder: PlayerId[],  // players ordered by seat, starting from player after button
): PotAward[] {
  const awards: PotAward[] = [];

  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const eligible = pot.eligiblePlayerIds.filter(id => playerEvals.has(id));

    if (eligible.length === 0) continue;

    // Find the best hand among eligible players
    let bestEval: HandEvaluation | null = null;
    for (const pid of eligible) {
      const ev = playerEvals.get(pid)!;
      if (!bestEval || compareHands(ev, bestEval) > 0) {
        bestEval = ev;
      }
    }

    // All players tied for best
    const winners = eligible.filter(pid => compareHands(playerEvals.get(pid)!, bestEval!) === 0);

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;

    // Order winners by seat (clockwise from button) for odd chip assignment
    const orderedWinners = seatOrder.filter(id => winners.includes(id));

    for (let i = 0; i < orderedWinners.length; i++) {
      const wid = orderedWinners[i];
      const isChop = winners.length > 1;
      const oddChip = i === 0 && remainder > 0;
      awards.push({
        playerId: wid,
        amount: share + (oddChip ? remainder : 0),
        potIndex,
        handEval: playerEvals.get(wid),
        isChop,
        oddChip,
      });
    }
  }

  return awards;
}

/**
 * Return uncontested single-eligible-player pots directly to that player.
 * This handles the case where a player over-bet and no one matched.
 */
export function returnUncontestedChips(
  pots: Pot[],
  playerEvals: Map<PlayerId, HandEvaluation>,
  seatOrder: PlayerId[],
): { awards: PotAward[]; remainingPots: Pot[] } {
  const awards: PotAward[] = [];
  const remainingPots: Pot[] = [];

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    const nonFoldedEligible = pot.eligiblePlayerIds.filter(id => playerEvals.has(id));
    if (nonFoldedEligible.length === 1) {
      awards.push({
        playerId: nonFoldedEligible[0],
        amount: pot.amount,
        potIndex: i,
        handEval: playerEvals.get(nonFoldedEligible[0]),
        isChop: false,
        oddChip: false,
      });
    } else {
      remainingPots.push(pot);
    }
  }

  return { awards, remainingPots };
}

/** Sanity check: total in === total out */
export function validatePotAccounting(
  inputTotal: number,
  awards: PotAward[],
): void {
  const outputTotal = awards.reduce((s, a) => s + a.amount, 0);
  if (inputTotal !== outputTotal) {
    throw new Error(
      `Pot accounting error: ${inputTotal} in, ${outputTotal} out (diff ${inputTotal - outputTotal})`
    );
  }
}
