import { v4 as uuidv4 } from 'uuid';
import { Deck } from '../deck/deck';
import {
  GameState, Player, PlayerStatus, Street, ActionType, Action,
  Pot, PotAward, ShowdownResult, GameSettings, AIType, PlayerId, LegalActions,
} from './types';
import { getLegalActions, applyBettingAction, isBettingRoundComplete, getNextActionSeat } from '../betting/bettingEngine';
import { buildSidePots, distributePots, validatePotAccounting } from '../pots/potResolver';
import { evaluateSevenCards, HandEvaluation } from '../evaluator/handEvaluator';

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createInitialGameState(
  playerDefs: { id: string; name: string; aiType: AIType }[],
  settings: GameSettings,
): GameState {
  const players: Player[] = playerDefs.map((def, i) => ({
    id: def.id,
    name: def.name,
    seat: i,
    stack: settings.startingStack,
    holeCards: null,
    status: PlayerStatus.ACTIVE,
    aiType: def.aiType,
    totalContributed: 0,
    roundContributed: 0,
    hasActedThisRound: false,
  }));

  return {
    gameId: uuidv4(),
    handNumber: 0,
    settings,
    players,
    buttonSeat: 0,
    communityCards: [],
    pots: [],
    street: Street.FINISHED,
    actionSeat: null,
    currentBet: 0,
    lastFullRaiseSize: settings.bigBlind,
    actionHistory: [],
    allInThisRound: [],
    showdownResult: null,
    phase: 'waiting',
    winnerText: null,
    sequenceCounter: 0,
  };
}

// ─── Hand Start ───────────────────────────────────────────────────────────────

export function startNewHand(prevState: GameState, deck?: Deck): GameState {
  // TEMPORARY QA CHEAT: Magically auto-refill anyone who bankrupted in the previous hand to 1000 chips instantly
  let state = {
    ...prevState,
    players: prevState.players.map(p => ({
      ...p,
      stack: p.stack <= 0 && p.status !== PlayerStatus.SITTING_OUT ? 1000 : p.stack,
    }))
  };

  // Remove eliminated players
  const activePlayers = state.players.filter(
    p => p.stack > 0 && p.status !== PlayerStatus.ELIMINATED && p.status !== PlayerStatus.SITTING_OUT
  );

  if (activePlayers.length < 2) {
    throw new Error('Not enough players with chips to start a hand');
  }

  // Advance button
  const newButtonSeat = nextOccupiedSeat(activePlayers, prevState.buttonSeat);

  // Reset all player state for new hand
  const players: Player[] = state.players.map(p => ({
    ...p,
    holeCards: null,
    // Sitting out players remain sitting out, everyone else is Active or Eliminated (though QA cheat saves bankrupts)
    status: p.status === PlayerStatus.SITTING_OUT ? PlayerStatus.SITTING_OUT : (p.stack > 0 ? PlayerStatus.ACTIVE : PlayerStatus.ELIMINATED),
    totalContributed: 0,
    roundContributed: 0,
    hasActedThisRound: false,
  }));

  // New deck
  const d = deck ?? Deck.create();
  const handState: GameState = {
    ...state,
    handNumber: prevState.handNumber + 1,
    players,
    buttonSeat: newButtonSeat,
    communityCards: [],
    pots: [],
    street: Street.PREFLOP,
    actionSeat: null,
    currentBet: 0,
    lastFullRaiseSize: prevState.settings.bigBlind,
    actionHistory: [],
    allInThisRound: [],
    showdownResult: null,
    phase: 'playing',
    winnerText: null,
    sequenceCounter: 0,
  };

  // Post blinds
  const postBlinds = postBlindsToState(handState, d);
  // Deal hole cards
  const dealt = dealHoleCards(postBlinds.state, d);

  return dealt;
}

// ─── Blind Posting ────────────────────────────────────────────────────────────

function postBlindsToState(state: GameState, deck: Deck): { state: GameState } {
  const activePlayers = getActivePlayers(state);
  const count = activePlayers.length;

  let sbSeat: number, bbSeat: number, firstActionSeat: number;

  if (count === 2) {
    // Heads-up: button = SB, other = BB, preflop action starts with button
    sbSeat = state.buttonSeat;
    bbSeat = nextActiveSeat(state.players, sbSeat);
    firstActionSeat = sbSeat; // button acts first preflop in HU
  } else {
    sbSeat = nextActiveSeat(state.players, state.buttonSeat);
    bbSeat = nextActiveSeat(state.players, sbSeat);
    firstActionSeat = nextActiveSeat(state.players, bbSeat);
  }

  let players = [...state.players.map(p => ({ ...p }))];
  const actions: Action[] = [];
  let seq = state.sequenceCounter;

  function postBlind(seat: number, amount: number) {
    const p = players.find(pl => pl.seat === seat)!;
    const posted = Math.min(amount, p.stack);
    p.stack -= posted;
    p.roundContributed += posted;
    p.totalContributed += posted;
    if (p.stack === 0) p.status = PlayerStatus.ALL_IN;
    actions.push({
      playerId: p.id, playerName: p.name,
      actionType: ActionType.POST_BLIND,
      amount: posted,
      street: Street.PREFLOP,
      handNumber: state.handNumber,
      sequenceIndex: seq++,
      timestamp: Date.now(),
    });
  }

  postBlind(sbSeat, state.settings.smallBlind);
  postBlind(bbSeat, state.settings.bigBlind);

  const currentBet = state.settings.bigBlind;

  // BB has not acted (special: they get option)
  players.find(p => p.seat === bbSeat)!.hasActedThisRound = false;

  return {
    state: {
      ...state,
      players,
      currentBet,
      lastFullRaiseSize: state.settings.bigBlind,
      actionSeat: firstActionSeat,
      actionHistory: [...state.actionHistory, ...actions],
      sequenceCounter: seq,
    },
  };
}

// ─── Dealing ─────────────────────────────────────────────────────────────────

function dealHoleCards(state: GameState, deck: Deck): GameState {
  const players = state.players.map(p => ({ ...p }));
  const activePlayers = players.filter(
    p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
  ).sort((a, b) => a.seat - b.seat);

  // Deal 2 cards each (poker order: one card at a time, two rounds)
  const card1: Record<string, any> = {};
  const card2: Record<string, any> = {};

  for (const p of activePlayers) card1[p.id] = deck.deal();
  for (const p of activePlayers) card2[p.id] = deck.deal();

  for (const p of players) {
    if (card1[p.id]) {
      p.holeCards = [card1[p.id], card2[p.id]];
    }
  }

  return { ...state, players };
}

// ─── Street Advancement ───────────────────────────────────────────────────────

export function advanceStreet(state: GameState, deck: Deck): GameState {
  const nextStreet = getNextStreet(state.street);
  let communityCards = [...state.communityCards];

  // Deal community cards
  if (nextStreet === Street.FLOP) {
    deck.burn();
    communityCards.push(deck.deal(), deck.deal(), deck.deal());
  } else if (nextStreet === Street.TURN || nextStreet === Street.RIVER) {
    deck.burn();
    communityCards.push(deck.deal());
  }

  // Reset round contributions and acted flags
  const players = state.players.map(p => ({
    ...p,
    roundContributed: 0,
    hasActedThisRound: false,
  }));

  // Determine first to act post-flop: first active player left of button
  const firstSeat = getFirstPostFlopSeat(players, state.buttonSeat);

  return {
    ...state,
    street: nextStreet,
    communityCards,
    players,
    currentBet: 0,
    lastFullRaiseSize: state.settings.bigBlind,
    actionSeat: firstSeat,
    allInThisRound: [],
    sequenceCounter: state.sequenceCounter,
  };
}

// ─── Apply Player Action ──────────────────────────────────────────────────────

export function applyAction(
  state: GameState,
  playerId: PlayerId,
  actionType: ActionType,
  amount: number = 0,
  deck: Deck,
): GameState {
  // Validate it's the player's turn
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (state.actionSeat !== player.seat) throw new Error('Not your turn');
  if (player.status !== PlayerStatus.ACTIVE) throw new Error('Player is not active');

  const { state: afterAction, chipsAdded } = applyBettingAction(state, playerId, actionType, amount);

  // Build action record
  const action: Action = {
    playerId,
    playerName: player.name,
    actionType,
    amount: chipsAdded,
    street: state.street,
    handNumber: state.handNumber,
    sequenceIndex: state.sequenceCounter,
    timestamp: Date.now(),
  };

  let newState: GameState = {
    ...afterAction,
    actionHistory: [...afterAction.actionHistory, action],
    sequenceCounter: afterAction.sequenceCounter + 1,
  };

  // Check if hand ends by folds
  const nonFolded = newState.players.filter(
    p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
  );
  if (nonFolded.length === 1) {
    // Everyone folded — sole survivor wins
    newState = awardFoldWin(newState, nonFolded[0].id);
    return newState;
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(newState)) {
    newState = consolidatePots(newState);

    // Check if everyone is all-in → runout
    const activeBetters = newState.players.filter(p => p.status === PlayerStatus.ACTIVE);
    if (activeBetters.length === 0 || (activeBetters.length === 1 && newState.street !== Street.RIVER)) {
      // Run out automatically
      newState = runOutBoard(newState, deck);
      return resolveShowdown(newState);
    }

    if (newState.street === Street.RIVER) {
      return resolveShowdown(newState);
    }

    // Advance to next street
    newState = advanceStreet(newState, deck);

    // If only 1 or 0 active bettors after street advance, keep running out
    const stilActive = newState.players.filter(p => p.status === PlayerStatus.ACTIVE);
    if (stilActive.length === 0) {
      newState = runOutBoard(newState, deck);
      return resolveShowdown(newState);
    }
  }

  return newState;
}

// ─── Automatic Runout ─────────────────────────────────────────────────────────

export function runOutBoard(state: GameState, deck: Deck): GameState {
  let s = { ...state, communityCards: [...state.communityCards] };

  while (s.communityCards.length < 5) {
    if (s.communityCards.length === 0) {
      deck.burn();
      s.communityCards.push(deck.deal(), deck.deal(), deck.deal());
    } else if (s.communityCards.length < 5) {
      deck.burn();
      s.communityCards.push(deck.deal());
    }
  }

  s.street = Street.SHOWDOWN;
  return s;
}

// ─── Pot Consolidation ────────────────────────────────────────────────────────

function consolidatePots(state: GameState): GameState {
  const pots = buildSidePots(state.players);
  return { ...state, pots };
}

// ─── Showdown ─────────────────────────────────────────────────────────────────

export function resolveShowdown(state: GameState): GameState {
  const eligible = state.players.filter(
    p => p.status !== PlayerStatus.FOLDED && p.status !== PlayerStatus.ELIMINATED && p.holeCards
  );

  const pots = buildSidePots(state.players);

  // Evaluate each eligible player's hand
  const playerEvals = new Map<PlayerId, HandEvaluation>();
  for (const player of eligible) {
    const allCards = [...player.holeCards!, ...state.communityCards];
    playerEvals.set(player.id, evaluateSevenCards(allCards));
  }

  // Seat order from player after button (for odd chip rule)
  const seatOrder: PlayerId[] = getPlayersFromButton(state.players, state.buttonSeat)
    .filter(p => eligible.some(e => e.id === p.id))
    .map(p => p.id);

  const awards = distributePots(pots, playerEvals, seatOrder);

  // Apply awards to stacks
  const players = state.players.map(p => ({ ...p }));
  for (const award of awards) {
    const p = players.find(pl => pl.id === award.playerId)!;
    p.stack += award.amount;
  }

  // Mark eliminated players
  for (const p of players) {
    if (p.stack === 0 && p.status !== PlayerStatus.ELIMINATED) {
      p.status = PlayerStatus.ELIMINATED;
    }
  }

  // Build winner text
  const winnerText = buildWinnerText(awards, playerEvals, state.players);

  return {
    ...state,
    players,
    pots,
    street: Street.FINISHED,
    phase: 'hand_over',
    showdownResult: { awards, playerEvals },
    winnerText,
  };
}

// ─── Fold Win ─────────────────────────────────────────────────────────────────

function awardFoldWin(state: GameState, winnerId: PlayerId): GameState {
  const pots = buildSidePots(state.players);
  const totalPot = pots.reduce((s, p) => s + p.amount, 0);

  const players = state.players.map(p => ({ ...p }));
  const winner = players.find(p => p.id === winnerId)!;
  winner.stack += totalPot;

  // Mark eliminated
  for (const p of players) {
    if (p.stack === 0) p.status = PlayerStatus.ELIMINATED;
  }

  return {
    ...state,
    players,
    pots,
    street: Street.FINISHED,
    phase: 'hand_over',
    showdownResult: null,
    winnerText: `${winner.name} wins ${totalPot} chips (everyone else folded)`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextStreet(current: Street): Street {
  switch (current) {
    case Street.PREFLOP: return Street.FLOP;
    case Street.FLOP: return Street.TURN;
    case Street.TURN: return Street.RIVER;
    case Street.RIVER: return Street.SHOWDOWN;
    default: throw new Error(`Cannot advance from ${current}`);
  }
}

function getActivePlayers(state: GameState): Player[] {
  return state.players.filter(
    p => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
  );
}

function nextActiveSeat(players: Player[], fromSeat: number): number {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const seat = (fromSeat + i) % total;
    const p = players.find(pl => pl.seat === seat);
    if (p && (p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN)) {
      return seat;
    }
  }
  throw new Error('No next active seat found');
}

function nextOccupiedSeat(players: Player[], fromSeat: number): number {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const seat = (fromSeat + i) % total;
    const p = players.find(pl => pl.seat === seat);
    if (p && p.stack > 0) return seat;
  }
  return fromSeat;
}

function getFirstPostFlopSeat(players: Player[], buttonSeat: number): number | null {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const seat = (buttonSeat + i) % total;
    const p = players.find(pl => pl.seat === seat);
    if (p && p.status === PlayerStatus.ACTIVE) return seat;
  }
  return null;
}

function getPlayersFromButton(players: Player[], buttonSeat: number): Player[] {
  const total = players.length;
  const ordered: Player[] = [];
  for (let i = 1; i <= total; i++) {
    const seat = (buttonSeat + i) % total;
    const p = players.find(pl => pl.seat === seat);
    if (p) ordered.push(p);
  }
  return ordered;
}

function buildWinnerText(
  awards: PotAward[],
  playerEvals: Map<PlayerId, HandEvaluation>,
  players: Player[],
): string {
  const playerMap = new Map(players.map(p => [p.id, p]));
  const wins = new Map<PlayerId, number>();
  for (const a of awards) {
    wins.set(a.playerId, (wins.get(a.playerId) ?? 0) + a.amount);
  }

  return Array.from(wins.entries()).map(([id, amount]) => {
    const player = playerMap.get(id)!;
    const ev = playerEvals.get(id);
    const handStr = ev ? ` with ${ev.label}` : '';
    return `${player.name} wins ${amount} chips${handStr}`;
  }).join(' | ');
}

export { getLegalActions };
