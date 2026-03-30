// Shared types mirrored from server — keep in sync with server/src/domain/game/types.ts
// Note: Using const objects instead of enums for Vite erasableSyntaxOnly compat

export const PlayerStatus = {
  ACTIVE:      'active',
  FOLDED:      'folded',
  ALL_IN:      'all_in',
  SITTING_OUT: 'sitting_out',
  ELIMINATED:  'eliminated',
} as const;
export type PlayerStatus = typeof PlayerStatus[keyof typeof PlayerStatus];

export const AIType = {
  HUMAN:            'human',
  RANDOM:           'random',
  TIGHT_PASSIVE:    'tight_passive',
  LOOSE_AGGRESSIVE: 'loose_aggressive',
  PROBABILITY:      'probability',
} as const;
export type AIType = typeof AIType[keyof typeof AIType];

export const Street = {
  PREFLOP:  'preflop',
  FLOP:     'flop',
  TURN:     'turn',
  RIVER:    'river',
  SHOWDOWN: 'showdown',
  FINISHED: 'finished',
} as const;
export type Street = typeof Street[keyof typeof Street];

export const ActionType = {
  FOLD:       'fold',
  CHECK:      'check',
  CALL:       'call',
  BET:        'bet',
  RAISE:      'raise',
  ALL_IN:     'all_in',
  POST_BLIND: 'post_blind',
} as const;
export type ActionType = typeof ActionType[keyof typeof ActionType];

export interface CardData {
  rank: number;
  suit: string;
  id: number;
}

export type HoleCards = [CardData, CardData] | ['??', '??'] | null;

export interface Player {
  id: string;
  name: string;
  seat: number;
  stack: number;
  holeCards: HoleCards;
  status: PlayerStatus;
  aiType: AIType;
  totalContributed: number;
  roundContributed: number;
  hasActedThisRound: boolean;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface Action {
  playerId: string;
  playerName: string;
  actionType: ActionType;
  amount: number;
  street: Street;
  handNumber: number;
  sequenceIndex: number;
  timestamp: number;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  betMin: number;
  betMax: number;
  canRaise: boolean;
  raiseMin: number;
  raiseMax: number;
  mustGoAllIn: boolean;
}

export interface GameSettings {
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  maxPlayers: number;
  aiDelay: number;
}

export interface ShowdownResult {
  awards: Array<{
    playerId: string;
    amount: number;
    potIndex: number;
    handEval?: { label: string };
    isChop?: boolean;
  }>;
  playerEvals: Record<string, { label: string; category: number }>;
}

export interface GameState {
  gameId: string;
  handNumber: number;
  settings: GameSettings;
  players: Player[];
  buttonSeat: number;
  communityCards: CardData[];
  pots: Pot[];
  street: Street;
  actionSeat: number | null;
  currentBet: number;
  lastFullRaiseSize: number;
  actionHistory: Action[];
  showdownResult: ShowdownResult | null;
  phase: 'waiting' | 'playing' | 'hand_over' | 'game_over';
  winnerText: string | null;
  sequenceCounter: number;
}

export interface EquityResult {
  winPct: number;
  tiePct: number;
  lossPct: number;
  method: string;
  elapsedMs: number;
}

export interface OutsResult {
  outs: number;
  draws: string[];
  ruleOf4Pct: number;
  ruleOf2Pct: number;
}
