import express from 'express';
import http from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

import { GameState, Player, PlayerStatus, AIType, ActionType, Street } from './domain/game/types';
import { createInitialGameState, startNewHand, applyAction, getLegalActions } from './domain/game/handController';
import { getAIDecision } from './services/aiDecisionMaker';
import { Deck } from './domain/deck/deck';
import { calculateEquity, calculateOuts, calcPotOdds } from './services/equity';

// ─── Room Management ──────────────────────────────────────────────────────────

interface Room {
  roomId: string;
  roomCode: string;
  state: GameState;
  deck: Deck;
  /** socket.id → playerId */
  socketToPlayer: Map<string, string>;
  /** playerId → socket.id */
  playerToSocket: Map<string, string>;
  aiTimeout: NodeJS.Timeout | null;
  settings: {
    smallBlind: number;
    bigBlind: number;
    startingStack: number;
    aiDelay: number;
  };
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── Server Setup ─────────────────────────────────────────────────────────────

const app = express();
const httpServer = http.createServer(app);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const io = new IOServer(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Socket Events ────────────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('create_room', (data: {
    playerName: string;
    smallBlind?: number;
    bigBlind?: number;
    startingStack?: number;
    numAI?: number;
    aiType?: AIType;
  }) => {
    const roomId = uuidv4();
    const roomCode = generateRoomCode();
    const playerId = uuidv4();

    const settings = {
      smallBlind: data.smallBlind ?? 10,
      bigBlind: data.bigBlind ?? 20,
      startingStack: data.startingStack ?? 1000,
      aiDelay: 1200,
    };

    // Add AI players if requested
    const playerDefs: { id: string; name: string; aiType: AIType }[] = [
      { id: playerId, name: data.playerName || 'Player 1', aiType: AIType.HUMAN },
    ];

    const numAI = Math.min(data.numAI ?? 0, 8);
    const aiNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    for (let i = 0; i < numAI; i++) {
      playerDefs.push({
        id: uuidv4(),
        name: aiNames[i],
        aiType: data.aiType ?? AIType.PROBABILITY,
      });
    }

    const state = createInitialGameState(playerDefs, {
      ...settings,
      maxPlayers: 9,
    });

    const room: Room = {
      roomId, roomCode, state,
      deck: Deck.create(),
      socketToPlayer: new Map([[socket.id, playerId]]),
      playerToSocket: new Map([[playerId, socket.id]]),
      aiTimeout: null,
      settings,
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('room_created', { roomId, roomCode, playerId, state: sanitizeState(state, playerId) });
    console.log(`[Room] Created ${roomCode} (${roomId})`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on('join_room', (data: { roomCode: string; playerName: string }) => {
    const room = findRoomByCode(data.roomCode);
    if (!room) {
      socket.emit('error', { message: `Room "${data.roomCode}" not found` });
      return;
    }
    if (room.state.phase === 'playing') {
      socket.emit('error', { message: 'Hand already in progress. Please wait.' });
      return;
    }

    const humanPlayers = room.state.players.filter(p => p.aiType === AIType.HUMAN);
    if (humanPlayers.length >= room.state.settings.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const playerId = uuidv4();
    const newPlayer: Player = {
      id: playerId,
      name: data.playerName || `Player ${humanPlayers.length + 1}`,
      seat: room.state.players.length,
      stack: room.settings.startingStack,
      holeCards: null,
      status: PlayerStatus.ACTIVE,
      aiType: AIType.HUMAN,
      totalContributed: 0,
      roundContributed: 0,
      hasActedThisRound: false,
    };

    room.state = {
      ...room.state,
      players: [...room.state.players, newPlayer],
    };
    room.socketToPlayer.set(socket.id, playerId);
    room.playerToSocket.set(playerId, socket.id);

    socket.join(room.roomId);

    socket.emit('room_joined', { roomId: room.roomId, roomCode: room.roomCode, playerId, state: sanitizeState(room.state, playerId) });
    io.to(room.roomId).emit('player_joined', { playerName: newPlayer.name, state: sanitizeState(room.state, null) });
    console.log(`[Room] ${newPlayer.name} joined ${room.roomCode}`);
  });

  // ── Reconnect Player ──────────────────────────────────────────────────────
  socket.on('reconnect_player', (data: { roomCode: string; playerId: string }) => {
    const room = findRoomByCode(data.roomCode);
    if (!room) {
      socket.emit('reconnect_failed', { message: 'Room no longer exists.' });
      return;
    }

    const playerIndex = room.state.players.findIndex(p => p.id === data.playerId);
    if (playerIndex === -1) {
      socket.emit('reconnect_failed', { message: 'Player not found in this room.' });
      return;
    }

    // Update status from sitting out to active (if applicable)
    const player = room.state.players[playerIndex];
    if (player.status === PlayerStatus.SITTING_OUT) {
      room.state = {
        ...room.state,
        players: room.state.players.map(p =>
          p.id === data.playerId ? { ...p, status: PlayerStatus.ACTIVE } : p
        )
      };
    }

    // Remap sockets
    room.socketToPlayer.set(socket.id, data.playerId);
    room.playerToSocket.set(data.playerId, socket.id);
    socket.join(room.roomId);

    socket.emit('room_joined', { roomId: room.roomId, roomCode: room.roomCode, playerId: data.playerId, state: sanitizeState(room.state, data.playerId) });
    io.to(room.roomId).emit('player_reconnected', { playerName: player.name });
    console.log(`[Room] ${player.name} reconnected to ${room.roomCode}`);
  });

  // ── Start Game ───────────────────────────────────────────────────────────
  socket.on('start_game', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.state.players.filter(p => p.stack > 0).length < 2) {
      socket.emit('error', { message: 'Need at least 2 players with chips' }); return;
    }

    try {
      room.deck = Deck.create();
      room.state = startNewHand(room.state, room.deck);
      broadcastState(room);
      scheduleAIIfNeeded(room);
    } catch (err: any) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Player Action ────────────────────────────────────────────────────────
  socket.on('player_action', (data: { roomId: string; playerId: string; action: ActionType; amount?: number }) => {
    const room = rooms.get(data.roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    const socketPlayerId = room.socketToPlayer.get(socket.id);
    if (socketPlayerId !== data.playerId) {
      socket.emit('error', { message: 'You can only act as yourself' }); return;
    }

    const player = room.state.players.find(p => p.id === data.playerId);
    if (!player) { socket.emit('error', { message: 'Player not found' }); return; }
    if (room.state.actionSeat !== player.seat) {
      socket.emit('error', { message: 'Not your turn' }); return;
    }

    try {
      if (room.aiTimeout) { clearTimeout(room.aiTimeout); room.aiTimeout = null; }
      room.state = applyAction(room.state, data.playerId, data.action, data.amount ?? 0, room.deck);
      broadcastState(room);

      if (room.state.phase === 'hand_over') {
        // Auto-start next hand after delay
        setTimeout(() => {
          if (rooms.has(room.roomId)) {
            try {
              room.deck = Deck.create();
              room.state = startNewHand(room.state, room.deck);
              broadcastState(room);
              scheduleAIIfNeeded(room);
            } catch {}
          }
        }, 4000);
      } else {
        scheduleAIIfNeeded(room);
      }
    } catch (err: any) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Get Legal Actions ────────────────────────────────────────────────────
  socket.on('get_legal_actions', (data: { roomId: string; playerId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) return;
    try {
      const legal = getLegalActions(room.state, data.playerId);
      socket.emit('legal_actions', legal);
    } catch {}
  });

  // ── Get Equity ───────────────────────────────────────────────────────────
  socket.on('get_equity', (data: { roomId: string; playerId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) return;
    const player = room.state.players.find(p => p.id === data.playerId);
    if (!player?.holeCards) return;

    try {
      const equity = calculateEquity({
        heroCards: player.holeCards,
        boardCards: room.state.communityCards,
        numOpponents: room.state.players.filter(
          p => p.id !== data.playerId && p.status === PlayerStatus.ACTIVE
        ).length,
        iterations: 5000,
      });

      const totalPot = room.state.pots.reduce((s, p) => s + p.amount, 0) +
        room.state.players.reduce((s, p) => s + p.roundContributed, 0);
      const actionPlayer = room.state.players.find(p => p.seat === room.state.actionSeat);
      const callAmt = actionPlayer
        ? Math.max(0, room.state.currentBet - actionPlayer.roundContributed)
        : 0;
      const potOdds = callAmt > 0 ? calcPotOdds(totalPot, callAmt) : 0;

      const outs = player.holeCards && room.state.communityCards.length >= 3
        ? calculateOuts(player.holeCards, room.state.communityCards)
        : null;

      socket.emit('equity_result', { equity, potOdds, outs });
    } catch {}
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    for (const [rid, room] of rooms.entries()) {
      if (room.socketToPlayer.has(socket.id)) {
        const pid = room.socketToPlayer.get(socket.id)!;
        room.socketToPlayer.delete(socket.id);
        // Mark player as sitting out (not eliminated)
        room.state = {
          ...room.state,
          players: room.state.players.map(p =>
            p.id === pid && p.status === PlayerStatus.ACTIVE ? { ...p, status: PlayerStatus.SITTING_OUT } : p
          ),
        };
        io.to(rid).emit('player_disconnected', { playerId: pid });
        break;
      }
    }
  });
});

// ─── AI Scheduling ────────────────────────────────────────────────────────────

function scheduleAIIfNeeded(room: Room): void {
  if (room.aiTimeout) return;
  if (room.state.actionSeat !== null) {
    const player = room.state.players.find(p => p.seat === room.state.actionSeat);
    if (!player || player.aiType === AIType.HUMAN) return;
    if (room.state.phase !== 'playing') return;

    room.aiTimeout = setTimeout(() => {
      room.aiTimeout = null;
      doAITurn(room);
    }, room.settings.aiDelay);
  }
}

function doAITurn(room: Room): void {
  const state = room.state;
  if (state.phase !== 'playing' || state.actionSeat === null) return;

  const player = state.players.find(p => p.seat === state.actionSeat);
  if (!player || player.aiType === AIType.HUMAN) return;

  try {
    const decision = getAIDecision(state, player);
    console.log(`[AI] ${player.name}: ${decision.actionType} ${decision.amount > 0 ? decision.amount : ''} — ${decision.reasoning}`);
    room.state = applyAction(room.state, player.id, decision.actionType, decision.amount, room.deck);
    broadcastState(room);

    if (room.state.phase === 'hand_over') {
      setTimeout(() => {
        if (rooms.has(room.roomId)) {
          try {
            room.deck = Deck.create();
            room.state = startNewHand(room.state, room.deck);
            broadcastState(room);
            scheduleAIIfNeeded(room);
          } catch {}
        }
      }, 4000);
    } else {
      scheduleAIIfNeeded(room);
    }
  } catch (err: any) {
    console.error(`[AI Error] ${err.message}`);
  }
}

// ─── State Broadcasting ───────────────────────────────────────────────────────

function broadcastState(room: Room): void {
  // Send each human player their personalized view (with their own hole cards)
  for (const [socketId, playerId] of room.socketToPlayer.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('game_state', { state: sanitizeState(room.state, playerId) });
    }
  }
}

/**
 * Sanitize state for a specific player:
 * - Show that player's hole cards
 * - Hide all other players' hole cards UNLESS it's showdown or hand_over with showdown
 */
function sanitizeState(state: GameState, playerId: string | null): any {
  const isShowdown = state.street === Street.FINISHED && state.showdownResult !== null;

  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      holeCards: p.id === playerId
        ? p.holeCards          // show own cards
        : isShowdown && p.status !== PlayerStatus.FOLDED
        ? p.holeCards          // reveal at showdown (non-folded)
        : p.holeCards
        ? ['??', '??']         // hidden
        : null,
    })),
  };
}

// ─── Room Lookup ──────────────────────────────────────────────────────────────

function findRoomByCode(code: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.roomCode === code.toUpperCase()) return room;
  }
  return undefined;
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🃏 Poker Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export { app, io };
