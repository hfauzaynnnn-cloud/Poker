import React, { useEffect, useRef, useState } from 'react';
import { usePokerStore } from '../store/pokerStore';
import PokerTable from '../components/PokerTable';
import ActionPanel from '../components/ActionPanel';
import CardComponent from '../components/CardComponent';

const STREET_COLORS: Record<string, string> = {
  preflop:  'bg-indigo-900/80 text-indigo-200',
  flop:     'bg-emerald-900/80 text-emerald-200',
  turn:     'bg-amber-900/80 text-amber-200',
  river:    'bg-rose-900/80 text-rose-200',
  showdown: 'bg-purple-900/80 text-purple-200',
  finished: 'bg-gray-900/80 text-gray-200',
};

export const GameScreen: React.FC = () => {
  const {
    gameState, playerId, roomCode, legalActions, equity, potOdds, outs,
    sendAction, startGame, trainingMode, setTrainingMode, actionLog, stats,
  } = usePokerStore();

  const logRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'log' | 'stats'>('log');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [actionLog]);

  if (!gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const isMyTurn = myPlayer && gameState.actionSeat === myPlayer.seat && gameState.phase === 'playing';
  const waitingForPlayers = gameState.phase === 'waiting';
  const currentActionPlayer = gameState.players.find(p => p.seat === gameState.actionSeat);
  const totalPot = gameState.pots.reduce((s, p) => s + p.amount, 0) +
    gameState.players.reduce((s, p) => s + p.roundContributed, 0);
  const isShowdown = gameState.phase === 'hand_over' && gameState.showdownResult !== null;
  const streetColorClass = STREET_COLORS[gameState.street] ?? 'bg-gray-900/80 text-gray-200';

  return (
    <div className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #0a1f0a 0%, #050c05 100%)' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#0d1f0d,#070f07)', borderBottom: '1px solid #1a3a1a' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-black text-base tracking-tight flex-shrink-0">
            🃏 <span style={{ background: 'linear-gradient(90deg,#4ade80,#facc15)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Poker</span>
          </span>
          <span className="hidden sm:block text-gray-600 text-xs">#{gameState.handNumber}</span>
          {gameState.street !== 'finished' && gameState.phase === 'playing' && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase tracking-wide ${streetColorClass}`}>
              {gameState.street}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-300 font-black text-xs tracking-[0.2em] hidden sm:block">{roomCode}</span>
          <button
            onClick={() => setTrainingMode(!trainingMode)}
            className={`px-2 py-1 rounded-full text-xs font-bold transition-all border ${trainingMode ? 'bg-purple-900/60 text-purple-300 border-purple-600' : 'bg-gray-800/60 text-gray-400 border-gray-700'}`}
          >🎓</button>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="lg:hidden px-2 py-1 rounded-full text-xs font-bold bg-gray-800/60 text-gray-400 border border-gray-700"
          >📋</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">

        {/* Table + Actions */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

          {waitingForPlayers && (
            <div className="flex flex-col items-center py-4 gap-3">
              <p className="text-gray-400 text-sm text-center px-4">
                {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} seated — share code{' '}
                <span className="text-yellow-300 font-bold tracking-[0.3em]">{roomCode}</span>
              </p>
              <button
                onClick={startGame}
                disabled={gameState.players.filter(p => p.stack > 0).length < 2}
                className="px-8 py-3 font-bold rounded-xl text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.4)' }}
              >Start Game 🎲</button>
            </div>
          )}

          <div className="px-1 sm:px-2 flex-shrink-0">
            <PokerTable gameState={gameState} myPlayerId={playerId} />
          </div>

          {gameState.phase === 'playing' && currentActionPlayer && (
            <div className="text-center py-1">
              {isMyTurn
                ? <span className="text-yellow-300 font-bold text-sm animate-pulse">⟳ Your turn!</span>
                : <span className="text-gray-500 text-xs">Waiting for <span className="text-gray-300">{currentActionPlayer.name}</span>…</span>
              }
            </div>
          )}

          {myPlayer?.holeCards && myPlayer.holeCards[0] !== '??' && myPlayer.status !== 'folded' && (
            <div className="flex justify-center items-center gap-3 py-1">
              <div className={`flex gap-2 transition-all ${isMyTurn ? 'scale-110' : ''}`}>
                {(myPlayer.holeCards as any[]).filter(c => c !== '??').map((card, i) => (
                  <div key={i} className={isMyTurn ? 'drop-shadow-[0_0_14px_rgba(251,191,36,0.7)]' : ''}>
                    <CardComponent card={card} size="lg" />
                  </div>
                ))}
              </div>
              {isShowdown && (gameState.showdownResult?.playerEvals as any)?.[myPlayer.id] && (
                <span className="text-yellow-200 font-bold text-xs px-3 py-1 rounded-xl"
                  style={{ background: 'rgba(120,80,0,0.4)', border: '1px solid rgba(250,204,21,0.3)' }}>
                  {(gameState.showdownResult!.playerEvals as any)[myPlayer.id]?.label}
                </span>
              )}
            </div>
          )}

          {trainingMode && isMyTurn && (equity || outs) && (
            <div className="mx-3 mb-2 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(88,28,135,0.2)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <div className="font-bold text-purple-300 mb-2">🎓 Training</div>
              <div className="flex flex-wrap gap-2">
                {equity && (
                  <span className={`px-2 py-1 rounded-lg font-semibold ${equity.winPct > 50 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                    Equity {equity.winPct.toFixed(1)}%
                  </span>
                )}
                {potOdds > 0 && legalActions?.canCall && (
                  <span className={`px-2 py-1 rounded-lg font-semibold ${equity && equity.winPct > potOdds ? 'bg-green-900/60 text-green-300' : 'bg-orange-900/60 text-orange-300'}`}>
                    Pot odds {potOdds.toFixed(1)}% {equity && (equity.winPct > potOdds ? '✓' : '✗')}
                  </span>
                )}
                {outs && outs.outs > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-blue-900/60 text-blue-300 font-semibold">
                    {outs.outs} outs ≈{outs.ruleOf4Pct}%
                  </span>
                )}
              </div>
            </div>
          )}

          {isMyTurn && legalActions && (
            <div className="px-2 pb-2">
              <ActionPanel
                legal={legalActions}
                gameState={gameState}
                onAction={sendAction}
                equity={trainingMode && equity ? equity.winPct : null}
                potOdds={trainingMode ? potOdds : undefined}
                outsCount={trainingMode && outs ? outs.outs : undefined}
              />
            </div>
          )}

          <div className="h-2 flex-shrink-0" />
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-60 flex-col flex-shrink-0"
          style={{ background: 'rgba(5,15,5,0.9)', borderLeft: '1px solid #1a3a1a' }}>
          <SidebarContent tab={tab} setTab={setTab} logRef={logRef}
            actionLog={actionLog} stats={stats} myPlayer={myPlayer}
            gameState={gameState} playerId={playerId} totalPot={totalPot} />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden absolute inset-0 z-50 flex flex-col"
            style={{ background: 'rgba(3,10,3,0.97)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1a3a1a' }}>
              <span className="text-green-400 font-bold text-sm">Game Info</span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SidebarContent tab={tab} setTab={setTab} logRef={logRef}
                actionLog={actionLog} stats={stats} myPlayer={myPlayer}
                gameState={gameState} playerId={playerId} totalPot={totalPot} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SidebarContent: React.FC<{
  tab: 'log' | 'stats';
  setTab: (t: 'log' | 'stats') => void;
  logRef: React.RefObject<HTMLDivElement | null>;
  actionLog: string[];
  stats: any;
  myPlayer: any;
  gameState: any;
  playerId: string | null;
  totalPot: number;
}> = ({ tab, setTab, logRef, actionLog, stats, myPlayer, gameState, playerId, totalPot }) => (
  <div className="flex flex-col h-full">
    <div className="flex border-b flex-shrink-0" style={{ borderColor: '#1a3a1a' }}>
      {(['log', 'stats'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)}
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${tab === t ? 'text-green-400 border-b-2 border-green-500' : 'text-gray-600 hover:text-gray-400'}`}>
          {t === 'log' ? '📋 Log' : '📊 Stats'}
        </button>
      ))}
    </div>

    {tab === 'log' && (
      <div ref={logRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {actionLog.length === 0 && <p className="text-gray-700 text-xs italic p-2">No actions yet…</p>}
        {actionLog.map((line, i) => (
          <div key={i} className={`text-xs leading-5 px-1 rounded ${
            line.startsWith('🏆') ? 'text-yellow-300 font-bold bg-yellow-900/20 py-0.5' :
            line.startsWith('---') ? 'text-gray-600 border-t border-gray-800 pt-1 mt-1' :
            line.includes('raises') || line.includes('bets') ? 'text-yellow-200' :
            line.includes('folds') ? 'text-red-400' :
            line.includes('calls') ? 'text-blue-400' :
            line.includes('checks') ? 'text-gray-300' :
            line.includes('posts') ? 'text-gray-600' : 'text-gray-400'
          }`}>{line}</div>
        ))}
      </div>
    )}

    {tab === 'stats' && (
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {myPlayer && (
          <>
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Session</div>
            {[
              { label: 'Stack', value: `$${myPlayer.stack.toLocaleString()}`, color: myPlayer.stack >= gameState.settings.startingStack ? 'text-green-400' : 'text-red-400' },
              { label: 'Hands', value: String(stats.handsPlayed) },
              { label: 'Won', value: String(stats.handsWon) },
              { label: 'Win%', value: stats.handsPlayed > 0 ? `${((stats.handsWon / stats.handsPlayed) * 100).toFixed(1)}%` : '–' },
              { label: 'Best Pot', value: stats.biggestPot > 0 ? `$${stats.biggestPot}` : '–' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-xs py-0.5">
                <span className="text-gray-600">{row.label}</span>
                <span className={`font-bold ${(row as any).color ?? 'text-gray-300'}`}>{row.value}</span>
              </div>
            ))}
          </>
        )}
        <div className="border-t border-gray-800 pt-2">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Players</div>
          {[...gameState.players].sort((a: any, b: any) => b.stack - a.stack).map((p: any) => (
            <div key={p.id} className={`flex justify-between text-xs py-0.5 ${p.id === playerId ? 'text-blue-300' : 'text-gray-400'}`}>
              <span className="truncate max-w-[90px]">{p.name}{p.id === playerId ? ' (me)' : ''}</span>
              <span className={`font-bold ${p.stack <= 0 ? 'text-red-500' : 'text-green-400'}`}>${p.stack.toLocaleString()}</span>
            </div>
          ))}
        </div>
        {totalPot > 0 && (
          <div className="border-t border-gray-800 pt-2 flex justify-between text-xs font-bold">
            <span className="text-gray-500">Total Pot</span>
            <span className="text-yellow-300">${totalPot.toLocaleString()}</span>
          </div>
        )}
      </div>
    )}

    <div className="flex-shrink-0 border-t p-2 flex items-center gap-1.5" style={{ borderColor: '#1a3a1a' }}>
      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="text-gray-600 text-xs">Connected</span>
    </div>
  </div>
);

export default GameScreen;
