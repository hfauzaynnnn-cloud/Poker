import { GameState, Player, PlayerStatus, LegalActions, PlayerId, ActionType } from '../game/types';

/**
 * Returns the legal actions for the player at `playerId` given the current game state.
 * This is the single source of truth for action legality — used by both UI and AI.
 */
export function getLegalActions(state: GameState, playerId: PlayerId): LegalActions {
  const player = getPlayer(state, playerId);

  if (player.status !== PlayerStatus.ACTIVE || state.actionSeat !== player.seat) {
    // Not this player's turn or player is not active
    return noActions();
  }

  const toCall = Math.max(0, state.currentBet - player.roundContributed);
  const effectiveToCall = Math.min(toCall, player.stack);
  const canCallExact = toCall > 0 && player.stack > toCall;

  // Always can fold (unless no bet and prefer check)
  const canFold = true;
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && player.stack >= toCall;

  // Min raise = current bet + last full raise size
  const minRaiseTotal = state.currentBet + Math.max(state.lastFullRaiseSize, state.settings.bigBlind);
  const minRaiseAmount = minRaiseTotal - player.roundContributed;
  const maxRaiseAmount = player.stack; // all-in

  const canBet = state.currentBet === 0 && player.stack > 0;
  const betMin = state.settings.bigBlind;
  const betMax = player.stack;

  const canRaise = state.currentBet > 0 && player.stack > toCall && player.stack >= minRaiseAmount;

  // If player can't afford the min raise but has more than the call amount, they can only go all-in
  const mustGoAllIn = player.stack <= toCall;

  return {
    canFold,
    canCheck,
    canCall: canCall || (toCall > 0 && player.stack <= toCall), // can call all-in for less
    callAmount: effectiveToCall,
    canBet,
    betMin,
    betMax,
    canRaise,
    raiseMin: canRaise ? minRaiseAmount : 0,
    raiseMax: maxRaiseAmount,
    mustGoAllIn,
  };
}

/**
 * Validates then applies an action to the game state, returning the updated state.
 * Throws on illegal actions.
 */
export function applyBettingAction(
  state: GameState,
  playerId: PlayerId,
  actionType: ActionType,
  amount: number = 0
): { state: GameState; chipsAdded: number } {

  const legal = getLegalActions(state, playerId);
  const player = getPlayer(state, playerId);

  let chipsAdded = 0;
  const players = state.players.map(p => ({ ...p }));
  const me = players.find(p => p.id === playerId)!;

  let currentBet = state.currentBet;
  let lastFullRaiseSize = state.lastFullRaiseSize;
  let actionSeat = state.actionSeat;

  switch (actionType) {
    case ActionType.FOLD:
      me.status = PlayerStatus.FOLDED;
      break;

    case ActionType.CHECK:
      if (!legal.canCheck) throw new Error(`Cannot check — facing bet of ${state.currentBet}`);
      me.hasActedThisRound = true;
      break;

    case ActionType.CALL: {
      const callAmt = Math.min(legal.callAmount, me.stack);
      me.stack -= callAmt;
      me.roundContributed += callAmt;
      me.totalContributed += callAmt;
      chipsAdded = callAmt;
      if (me.stack === 0) me.status = PlayerStatus.ALL_IN;
      me.hasActedThisRound = true;
      break;
    }

    case ActionType.BET: {
      if (!legal.canBet) throw new Error('Cannot bet');
      const betAmt = Math.min(amount, me.stack);
      if (betAmt < legal.betMin && betAmt < me.stack)
        throw new Error(`Bet of ${betAmt} is below minimum ${legal.betMin}`);
      me.stack -= betAmt;
      me.roundContributed += betAmt;
      me.totalContributed += betAmt;
      chipsAdded = betAmt;
      currentBet = me.roundContributed;
      lastFullRaiseSize = betAmt;
      if (me.stack === 0) me.status = PlayerStatus.ALL_IN;
      me.hasActedThisRound = true;
      // Re-open action for other players
      players.forEach(p => {
        if (p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
          p.hasActedThisRound = false;
        }
      });
      break;
    }

    case ActionType.RAISE:
    case ActionType.ALL_IN: {
      const raiseAmt = Math.min(amount, me.stack);
      const prevBet = state.currentBet;
      me.stack -= raiseAmt;
      me.roundContributed += raiseAmt;
      me.totalContributed += raiseAmt;
      chipsAdded = raiseAmt;

      const newTotalBet = me.roundContributed;
      const raiseIncrement = newTotalBet - prevBet;
      const isFullRaise = raiseIncrement >= lastFullRaiseSize;

      currentBet = Math.max(currentBet, newTotalBet);
      if (isFullRaise) {
        lastFullRaiseSize = raiseIncrement;
        // Full raise — re-open action for all players who have already acted
        players.forEach(p => {
          if (p.id !== playerId && p.status === PlayerStatus.ACTIVE) {
            p.hasActedThisRound = false;
          }
        });
      }
      // Short all-in: does NOT re-open action
      if (me.stack === 0) me.status = PlayerStatus.ALL_IN;
      me.hasActedThisRound = true;
      break;
    }

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }

  // Determine next player to act
  const nextSeat = getNextActionSeat(players, me.seat, state);

  return {
    chipsAdded,
    state: {
      ...state,
      players,
      currentBet,
      lastFullRaiseSize,
      actionSeat: nextSeat,
    },
  };
}

/**
 * Returns true when all active non-all-in players have acted
 * and no one owes more chips to the pot.
 */
export function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(
    p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
  );
  const activeBetters = activePlayers.filter(p => p.status === PlayerStatus.ACTIVE);

  if (activeBetters.length === 0) return true; // everyone all-in or folded

  // Every active player must have acted and matched the current bet
  return activeBetters.every(
    p => p.hasActedThisRound && p.roundContributed >= state.currentBet
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlayer(state: GameState, id: PlayerId): Player {
  const p = state.players.find(p => p.id === id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

function noActions(): LegalActions {
  return {
    canFold: false, canCheck: false, canCall: false,
    callAmount: 0, canBet: false, betMin: 0, betMax: 0,
    canRaise: false, raiseMin: 0, raiseMax: 0, mustGoAllIn: false,
  };
}

export function getNextActionSeat(
  players: Player[],
  currentSeat: number,
  state: GameState
): number | null {
  const total = players.length;
  for (let offset = 1; offset < total; offset++) {
    const seat = (currentSeat + offset) % total;
    const p = players.find(p => p.seat === seat);
    if (p && p.status === PlayerStatus.ACTIVE) return seat;
  }
  return null; // No more active players
}
