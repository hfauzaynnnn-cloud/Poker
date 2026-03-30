// ─── Shared Game Types ────────────────────────────────────────────────────────

import { Card } from '../cards/types';
import { HandEvaluation } from '../evaluator/handEvaluator';

export type PlayerId = string;

export enum PlayerStatus {
  ACTIVE    = 'active',
  FOLDED    = 'folded',
  ALL_IN    = 'all_in',
  SITTING_OUT = 'sitting_out',
  ELIMINATED  = 'eliminated',
}

export enum AIType {
  HUMAN          = 'human',
  RANDOM         = 'random',
  TIGHT_PASSIVE  = 'tight_passive',
  LOOSE_AGGRESSIVE = 'loose_aggressive',
  PROBABILITY    = 'probability',
}

export interface Player {
  id: PlayerId;
  /** Primary Key ID from PostgreSQL/SQLite for global chip tracking */
  dbUserId?: string;
  name: string;
  seat: number;       // 0-based seat index
  stack: number;
  holeCards: [Card, Card] | null;
  status: PlayerStatus;
  aiType: AIType;
  /** Total chips committed to pots this hand (across all streets) */
  totalContributed: number;
  /** Chips committed in the current betting round */
  roundContributed: number;
  /** Whether we have had a chance to act this betting round */
  hasActedThisRound: boolean;
}

export enum Street {
  PREFLOP = 'preflop',
  FLOP    = 'flop',
  TURN    = 'turn',
  RIVER   = 'river',
  SHOWDOWN = 'showdown',
  FINISHED = 'finished',
}

export enum ActionType {
  FOLD    = 'fold',
  CHECK   = 'check',
  CALL    = 'call',
  BET     = 'bet',
  RAISE   = 'raise',
  ALL_IN  = 'all_in',
  /** Posted by engine automatically */
  POST_BLIND = 'post_blind',
}

export interface Action {
  playerId: PlayerId;
  playerName: string;
  actionType: ActionType;
  amount: number;
  street: Street;
  handNumber: number;
  sequenceIndex: number;
  timestamp: number;
}

export interface Pot {
  amount: number;
  /** playerIds eligible to win this pot */
  eligiblePlayerIds: PlayerId[];
}

export interface PotAward {
  playerId: PlayerId;
  amount: number;
  potIndex: number;
  handEval?: HandEvaluation;
  isChop?: boolean;
  oddChip?: boolean;
}

export interface ShowdownResult {
  awards: PotAward[];
  playerEvals: Map<PlayerId, HandEvaluation>;
}

export interface GameSettings {
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  maxPlayers: number;
  /** Milliseconds for AI to "think" (for UX only) */
  aiDelay: number;
}

export interface GameState {
  gameId: string;
  handNumber: number;
  settings: GameSettings;
  players: Player[];
  /** Seat index of button */
  buttonSeat: number;
  /** Community cards revealed so far */
  communityCards: Card[];
  /** All active pots */
  pots: Pot[];
  street: Street;
  /** Seat of the player whose turn it is */
  actionSeat: number | null;
  /** Current highest bet in this round */
  currentBet: number;
  /** Size of the last FULL raise (for min-raise tracking) */
  lastFullRaiseSize: number;
  /** Action history for the full hand */
  actionHistory: Action[];
  /** Set of player IDs that have gone all-in this round (needed for re-open logic) */
  allInThisRound: PlayerId[];
  showdownResult: ShowdownResult | null;
  /** Whether game is waiting for players */
  phase: 'waiting' | 'playing' | 'hand_over' | 'game_over';
  /** The hand winner announcement text */
  winnerText: string | null;
  sequenceCounter: number;
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
  /** True if only legal move is all-in for less */
  mustGoAllIn: boolean;
}
