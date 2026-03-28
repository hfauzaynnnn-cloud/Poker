import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import type { GameState, LegalActions, EquityResult, OutsResult } from '../types';
import { ActionType } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const STATS_KEY = 'poker_session_stats';

export interface SessionStats {
  handsPlayed: number;
  handsWon: number;
  showdownsWon: number;
  biggestPot: number;
}

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { handsPlayed: 0, handsWon: 0, showdownsWon: 0, biggestPot: 0 };
}

function saveStats(s: SessionStats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

const SESSION_KEY = 'poker_active_session';
interface ActiveSession { roomId: string; roomCode: string; playerId: string; }

function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSession(s: ActiveSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

interface PokerStore {
  socket: Socket | null;
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  gameState: GameState | null;
  legalActions: LegalActions | null;
  equity: EquityResult | null;
  potOdds: number;
  outs: OutsResult | null;
  error: string | null;
  connected: boolean;
  trainingMode: boolean;
  actionLog: string[];
  stats: SessionStats;

  // Actions
  connect: () => void;
  disconnect: () => void;
  createRoom: (playerName: string, opts: CreateRoomOpts) => void;
  joinRoom: (code: string, playerName: string) => void;
  startGame: () => void;
  sendAction: (action: ActionType, amount?: number) => void;
  requestEquity: () => void;
  setTrainingMode: (on: boolean) => void;
  clearError: () => void;
  resetStats: () => void;
}

interface CreateRoomOpts {
  smallBlind?: number;
  bigBlind?: number;
  startingStack?: number;
  numAI?: number;
  aiType?: string;
}

export const usePokerStore = create<PokerStore>((set, get) => ({
  socket: null,
  roomId: null,
  roomCode: null,
  playerId: null,
  gameState: null,
  legalActions: null,
  equity: null,
  potOdds: 0,
  outs: null,
  error: null,
  connected: false,
  trainingMode: false,
  actionLog: [],
  stats: loadStats(),

  connect: () => {
    if (get().socket?.connected) return;

    const socket = io(SERVER_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      set({ connected: true });
      const session = loadSession();
      if (session) {
        socket.emit('reconnect_player', { roomCode: session.roomCode, playerId: session.playerId });
      }
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('room_created', (data: { roomId: string; roomCode: string; playerId: string; state: GameState }) => {
      saveSession({ roomId: data.roomId, roomCode: data.roomCode, playerId: data.playerId });
      set({ roomId: data.roomId, roomCode: data.roomCode, playerId: data.playerId, gameState: data.state, error: null });
    });

    socket.on('room_joined', (data: { roomId: string; roomCode: string; playerId: string; state: GameState }) => {
      saveSession({ roomId: data.roomId, roomCode: data.roomCode, playerId: data.playerId });
      set({ roomId: data.roomId, roomCode: data.roomCode, playerId: data.playerId, gameState: data.state, error: null });
    });

    socket.on('reconnect_failed', (data: { message: string }) => {
      saveSession(null);
      set({ roomId: null, roomCode: null, playerId: null, gameState: null, error: data.message });
    });

    socket.on('player_joined', (data: { playerName: string; state: GameState }) => {
      set(s => ({
        gameState: data.state,
        actionLog: [...s.actionLog, `👤 ${data.playerName} joined the table`],
      }));
    });

    socket.on('player_reconnected', (data: { playerName: string }) => {
      set(s => ({
         actionLog: [...s.actionLog, `🔌 ${data.playerName} reconnected`]
      }));
    });

    socket.on('game_state', (data: { state: GameState }) => {
      const prev = get().gameState;
      const curr = data.state;
      const pid = get().playerId;
      const log: string[] = [];

      // Detect new actions for log
      if (prev && curr.actionHistory.length > prev.actionHistory.length) {
        const newActions = curr.actionHistory.slice(prev.actionHistory.length);

        // Street separator
        if (newActions.length > 0) {
          const firstNew = newActions[0];
          const prevLast = prev.actionHistory[prev.actionHistory.length - 1];
          if (!prevLast || firstNew.street !== prevLast.street) {
            const streetLabel = firstNew.street.toUpperCase();
            if (firstNew.street !== 'preflop') {
              log.push(`--- ${streetLabel} ---`);
            }
          }
        }

        for (const a of newActions) {
          const line = formatActionLine(a);
          log.push(line);
        }
      }

      // Hand start separator
      if (prev && curr.handNumber > prev.handNumber) {
        log.unshift(`--- Hand #${curr.handNumber} ---`);
      }

      // Winner announcement
      if (curr.winnerText && curr.winnerText !== prev?.winnerText) {
        log.push(`🏆 ${curr.winnerText}`);
      }

      // Update session stats
      let stats = get().stats;
      if (curr.phase === 'hand_over' && prev?.phase === 'playing' && pid) {
        const updatedStats = { ...stats };

        // Detect hand played
        if (curr.handNumber !== prev.handNumber || curr.winnerText !== prev.winnerText) {
          updatedStats.handsPlayed = stats.handsPlayed + 1;

          // Detect if I won
          if (curr.winnerText) {
            const myPlayer = curr.players.find(p => p.id === pid);
            const awards = curr.showdownResult?.awards ?? [];
            const iWon = awards.some(a => a.playerId === pid);
            const myPot = awards.filter(a => a.playerId === pid).reduce((s, a) => s + a.amount, 0);
            const foldWin = curr.winnerText && !curr.showdownResult && curr.winnerText.includes(myPlayer?.name ?? '__NONE__');

            if (iWon || foldWin) {
              updatedStats.handsWon = stats.handsWon + 1;
              if (curr.showdownResult) updatedStats.showdownsWon = stats.showdownsWon + 1;
              if (myPot > stats.biggestPot) updatedStats.biggestPot = myPot;
            }
          }
        }
        stats = updatedStats;
        saveStats(updatedStats);
      }

      set(s => ({
        gameState: curr,
        actionLog: [...s.actionLog.slice(-150), ...log],
        equity: null,
        outs: null,
        stats,
      }));

      // Auto-fetch legal actions & equity
      if (pid && curr.actionSeat !== null) {
        const ap = curr.players.find(p => p.seat === curr.actionSeat);
        if (ap?.id === pid) {
          socket.emit('get_legal_actions', { roomId: get().roomId, playerId: pid });
          if (get().trainingMode) {
            socket.emit('get_equity', { roomId: get().roomId, playerId: pid });
          }
        } else {
          set({ legalActions: null });
        }
      }
    });

    socket.on('legal_actions', (legal: LegalActions) => {
      set({ legalActions: legal });
    });

    socket.on('equity_result', (data: { equity: EquityResult; potOdds: number; outs: OutsResult | null }) => {
      set({ equity: data.equity, potOdds: data.potOdds, outs: data.outs });
    });

    socket.on('player_disconnected', () => {
      set(s => ({
        actionLog: [...s.actionLog, `⚠️ A player disconnected`],
      }));
    });

    socket.on('error', (data: { message: string }) => {
      set({ error: data.message });
    });

    set({ socket });
  },

  disconnect: () => {
      get().socket?.disconnect();
      saveSession(null);
      set({ socket: null, connected: false, roomId: null, roomCode: null, playerId: null, gameState: null });
  },

  createRoom: (playerName, opts) => {
    const s = get();
    if (!s.socket?.connected) s.connect();
    setTimeout(() => {
      get().socket?.emit('create_room', { playerName, ...opts });
    }, 300);
  },

  joinRoom: (code, playerName) => {
    const s = get();
    if (!s.socket?.connected) s.connect();
    setTimeout(() => {
      get().socket?.emit('join_room', { roomCode: code.toUpperCase(), playerName });
    }, 300);
  },

  startGame: () => {
    const { socket, roomId } = get();
    socket?.emit('start_game', { roomId });
  },

  sendAction: (action, amount = 0) => {
    const { socket, roomId, playerId } = get();
    socket?.emit('player_action', { roomId, playerId, action, amount });
    set({ legalActions: null });
  },

  requestEquity: () => {
    const { socket, roomId, playerId } = get();
    socket?.emit('get_equity', { roomId, playerId });
  },

  setTrainingMode: (on) => set({ trainingMode: on }),
  clearError: () => set({ error: null }),
  resetStats: () => {
    const fresh: SessionStats = { handsPlayed: 0, handsWon: 0, showdownsWon: 0, biggestPot: 0 };
    saveStats(fresh);
    set({ stats: fresh });
  },
}));

function formatActionLine(a: { playerName: string; actionType: string; amount: number; street: string }): string {
  switch (a.actionType) {
    case 'post_blind': return `${a.playerName} posts $${a.amount}`;
    case 'fold':       return `${a.playerName} folds`;
    case 'check':      return `${a.playerName} checks`;
    case 'call':       return `${a.playerName} calls $${a.amount}`;
    case 'bet':        return `${a.playerName} bets $${a.amount}`;
    case 'raise':      return `${a.playerName} raises to $${a.amount}`;
    case 'all_in':     return `${a.playerName} is ALL-IN $${a.amount}`;
    default:           return `${a.playerName} ${a.actionType}`;
  }
}
