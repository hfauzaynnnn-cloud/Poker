import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePokerStore } from '../store/pokerStore';
import PokerTable from '../components/PokerTable';
import ActionPanel from '../components/ActionPanel';
import CardComponent from '../components/CardComponent';
import { toastSuccess } from '../components/Toast';
import { SFX } from '../services/SoundManager';

const STREET_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  preflop:  { bg: 'rgba(55,48,163,0.8)',  text: '#c7d2fe', label: 'Pre-Flop' },
  flop:     { bg: 'rgba(6,78,59,0.8)',    text: '#6ee7b7', label: 'Flop'     },
  turn:     { bg: 'rgba(120,53,15,0.8)',  text: '#fde68a', label: 'Turn'     },
  river:    { bg: 'rgba(127,29,29,0.8)',  text: '#fca5a5', label: 'River'    },
  showdown: { bg: 'rgba(88,28,135,0.8)',  text: '#e9d5ff', label: 'Showdown' },
  finished: { bg: 'rgba(30,30,30,0.6)',   text: '#9ca3af', label: ''         },
};

// Removed unused fmtStack

function copyToClipboard(text: string, onDone: () => void) {
  navigator.clipboard.writeText(text).then(onDone).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    onDone();
  });
}

export const GameScreen: React.FC = () => {
  const {
    gameState, playerId, roomCode, legalActions, equity, potOdds, outs,
    sendAction, startGame, trainingMode, setTrainingMode, actionLog, stats, connected,
  } = usePokerStore();

  const logRef     = useRef<HTMLDivElement>(null);
  const prevPhase  = useRef<string>('');
  const prevWinner = useRef<string>('');
  const prevStreet = useRef<string>('');
  const prevHand   = useRef<number>(0);

  const [tab, setTab]               = useState<'log' | 'stats'>('log');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [actionLog]);

  // Sound effects from game state changes
  useEffect(() => {
    if (!gameState) return;
    // New hand
    if (gameState.handNumber > prevHand.current) {
      SFX.newHand();
      prevHand.current = gameState.handNumber;
    }
    // Winner
    if (gameState.winnerText && gameState.winnerText !== prevWinner.current) {
      const isMyWin = gameState.showdownResult?.awards?.some(a => a.playerId === playerId);
      if (isMyWin) SFX.win();
      prevWinner.current = gameState.winnerText;
    }
    // Street change
    if (gameState.street !== prevStreet.current && gameState.street !== 'finished') {
      SFX.cardFlip();
      prevStreet.current = gameState.street;
    }
    prevPhase.current = gameState.phase;
  }, [gameState?.handNumber, gameState?.winnerText, gameState?.street]);

  const handleCopyCode = useCallback(() => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?join=${roomCode}`;
    copyToClipboard(shareUrl, () => {
      setCodeCopied(true);
      toastSuccess(`Invite link copied! Share with friends`);
      SFX.copy();
      setTimeout(() => setCodeCopied(false), 2500);
    });
  }, [roomCode]);

  if (!gameState) return null;

  const myPlayer          = gameState.players.find(p => p.id === playerId);
  const isMyTurn          = !!(myPlayer && gameState.actionSeat === myPlayer.seat && gameState.phase === 'playing');
  const waitingForPlayers = gameState.phase === 'waiting';
  const currentActingPlayer = gameState.players.find(p => p.seat === gameState.actionSeat);
  const totalPot          = gameState.pots.reduce((s, p) => s + p.amount, 0)
    + gameState.players.reduce((s, p) => s + p.roundContributed, 0);
  const isShowdown        = gameState.phase === 'hand_over' && gameState.showdownResult !== null;
  const streetInfo        = STREET_COLORS[gameState.street] ?? STREET_COLORS.finished;

  return (
    <div
      className="min-h-screen flex overflow-hidden w-full h-full"
      style={{ background: 'radial-gradient(ellipse at top, #0a1f0a 0%, #050c05 100%)' }}
    >
      {/* ── Keyboard shortcuts overlay (Highest Z) ── */}
      {showShortcuts && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="glass animate-bounce-in"
            style={{ borderRadius: '18px', padding: '24px', maxWidth: '320px', width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontWeight: 900, fontSize: '16px', marginBottom: '16px', color: '#f3f4f6' }}>⌨ Keyboard Shortcuts</h3>
            {[
              ['F', 'Fold'],
              ['C', 'Call / Check'],
              ['R', 'Raise / Bet'],
            ].map(([key, action]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>{action}</span>
                <kbd style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 800,
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e5e7eb',
                }}>{key}</kbd>
              </div>
            ))}
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                marginTop: '12px', width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                background: 'rgba(255,255,255,0.08)', color: '#9ca3af', cursor: 'pointer', fontSize: '13px',
              }}
            >Close</button>
          </div>
        </div>
      )}

      {/* ── Main Game Canvas (Full-Bleed) ── */}
      <div className="relative flex-1 flex flex-col overflow-hidden" style={{ minHeight: '100dvh' }}>
        
        {/* Table Canvas (Layer 0) */}
        <div className="absolute inset-0 z-0 p-2 sm:p-4">
          <PokerTable gameState={gameState} myPlayerId={playerId} />
        </div>

        {/* Top Floating HUD (Layer 10) */}
        <div className="absolute top-0 left-0 w-full z-10 p-2 sm:p-4 border-b border-[#1a3a1a]/40 flex justify-between items-start pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(5,12,5,0.95) 0%, rgba(5,12,5,0) 100%)' }}>
          {/* Left: logo + info */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <span style={{ fontWeight: 900, fontSize: '15px' }}>
              🃏 <span style={{
                background: 'linear-gradient(90deg,#4ade80,#facc15)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Poker</span>
            </span>
            <span style={{ color: '#374151', fontSize: '11px' }}>#{gameState.handNumber}</span>
            {gameState.street !== 'finished' && gameState.phase === 'playing' && (
              <span style={{
                padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                background: streetInfo.bg, color: streetInfo.text,
              }}>
                {streetInfo.label}
              </span>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {roomCode && (
              <button onClick={handleCopyCode} title="Copy invite link"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: codeCopied ? 'rgba(22,101,52,0.6)' : 'rgba(0,0,0,0.5)', outline: codeCopied ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.1)',
                }}>
                <span style={{ color: '#fdf4a5', fontWeight: 900, fontSize: '12px', letterSpacing: '0.1em' }}>{roomCode}</span>
                <span style={{ fontSize: '11px' }}>{codeCopied ? '✅' : '📋'}</span>
              </button>
            )}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
            }} className={connected ? '' : 'animate-pulse'} />

            <button onClick={() => { setTrainingMode(!trainingMode); SFX.click(); }} title="Training mode"
              style={{
                padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: trainingMode ? 'rgba(88,28,135,0.7)' : 'rgba(30,30,30,0.6)', color: trainingMode ? '#c4b5fd' : '#6b7280', fontSize: '12px',
                outline: trainingMode ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
              }}>🎓</button>
            <button onClick={() => setShowShortcuts(v => !v)} title="Shortcuts"
              style={{ padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(30,30,30,0.6)', color: '#6b7280', fontSize: '11px', outline: '1px solid rgba(255,255,255,0.1)' }}>⌨</button>
            <button className="lg:hidden" onClick={() => setSidebarOpen(v => !v)}
              style={{ padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(30,30,30,0.6)', color: '#6b7280', fontSize: '12px', outline: '1px solid rgba(255,255,255,0.1)' }}>📋</button>
            <button onClick={() => { usePokerStore.getState().leaveRoom(); }} title="Leave Table"
              style={{ padding: '4px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '12px', outline: '1px solid rgba(239,68,68,0.4)', fontWeight: 800 }}>🚪 Leave</button>
          </div>
        </div>

        {/* Center Canvas Overlay (Waiting Room) */}

          {waitingForPlayers && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center p-4 gap-3 animate-slide-down pointer-events-auto">
                <div style={{ padding: '12px 20px', borderRadius: '16px', textAlign: 'center', background: 'rgba(6,20,6,0.95)', border: '1px solid rgba(74,222,128,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 8px', fontWeight: 600 }}>
                    {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} seated
                  </p>
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Copy Code to invite:</span>
                    <button onClick={handleCopyCode} style={{ background: codeCopied ? 'rgba(22,101,52,0.5)' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', outline: '1px solid rgba(250,204,21,0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#fde68a', fontWeight: 900, letterSpacing: '0.3em', fontSize: '16px' }}>{roomCode}</span>
                    </button>
                  </div>
                </div>
                <button onClick={() => { startGame(); SFX.click(); }} disabled={gameState.players.filter(p => p.stack > 0).length < 2}
                  style={{ padding: '14px 40px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase', background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 8px 32px rgba(22,163,74,0.4)', color: '#fff', transition: 'all 0.2s', opacity: gameState.players.filter(p => p.stack > 0).length < 2 ? 0.4 : 1 }}>
                  Start Game 🎲
                </button>
              </div>
            </div>
          )}

          {/* Game Over / Restart Canvas Overlay */}
          {gameState.phase === 'game_over' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="flex flex-col items-center p-6 gap-4 animate-bounce-in pointer-events-auto" style={{ background: 'linear-gradient(135deg, rgba(88,28,135,0.95), rgba(30,10,60,0.95))', borderRadius: '24px', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', maxWidth: '90%' }}>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900, background: 'linear-gradient(90deg, #facc15, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center' }}>
                  🏆 Game Over
                </h2>
                <p style={{ margin: 0, color: '#e9d5ff', fontSize: '15px', textAlign: 'center', fontWeight: 600 }}>
                  {gameState.players.filter(p => p.stack > 0).map(p => p.name).join(', ')} won all the chips!
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={() => { usePokerStore.getState().playAgain(); SFX.click(); }}
                    style={{ padding: '14px 28px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase', background: 'linear-gradient(135deg,#f59e0b,#ea580c)', boxShadow: '0 8px 32px rgba(234,88,12,0.4)', color: '#fff', transition: 'all 0.2s' }}>
                    Play Again 🔄
                  </button>
                  <button onClick={() => { usePokerStore.getState().leaveRoom(); }}
                    style={{ padding: '14px 28px', borderRadius: '999px', border: '2px solid rgba(239,68,68,0.5)', cursor: 'pointer', fontWeight: 900, fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase', background: 'rgba(0,0,0,0.5)', color: '#fca5a5', transition: 'all 0.2s' }}>
                    Leave Table 🚪
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Turn Indicator Floating Top-Center */}
          {gameState.phase === 'playing' && currentActingPlayer && (
            <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              {isMyTurn ? (
                <div style={{ padding: '4px 16px', borderRadius: '999px', background: 'rgba(120,53,15,0.8)', border: '1px solid rgba(251,191,36,0.6)', color: '#fde68a', fontWeight: 900, fontSize: '14px', animation: 'glow 1.5s ease-in-out infinite', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  ⟳ Your turn!
                </div>
              ) : (
                <div style={{ padding: '4px 16px', borderRadius: '999px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  Waiting for <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{currentActingPlayer.name}</span>…
                </div>
              )}
            </div>
          )}

          {/* My Hero Hole Cards (Bottom-Center, Absolute Canvas) */}
          {myPlayer?.holeCards && myPlayer.holeCards[0] !== '??' && myPlayer.status !== 'folded' && (
            <div className="absolute bottom-1 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
              {isShowdown && (gameState.showdownResult?.playerEvals as any)?.[myPlayer.id] && (
                <span style={{ fontSize: '12px', fontWeight: 900, padding: '6px 14px', borderRadius: '999px', background: 'rgba(120,80,0,0.8)', border: '1px solid rgba(250,204,21,0.5)', color: '#fde68a', animation: 'bounceIn 0.5s both', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }} className="pointer-events-auto">
                  {(gameState.showdownResult!.playerEvals as any)[myPlayer.id]?.label}
                </span>
              )}
              <div style={{ display: 'flex', gap: '8px', transform: isMyTurn ? 'scale(1.2) translateY(-8px)' : 'scale(1.05)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} className="pointer-events-auto drop-shadow-2xl">
                {(myPlayer.holeCards as any[]).filter(c => c !== '??').map((card, i) => (
                  <div key={i} style={{ filter: isMyTurn ? 'drop-shadow(0 0 16px rgba(251,191,36,0.8))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))', transition: 'filter 0.3s' }}>
                    <CardComponent card={card} size="lg" dealt delay={i * 100} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training Mode Overlay (Floating Left) */}
          {trainingMode && isMyTurn && (equity || outs) && (
            <div className="absolute bottom-24 sm:bottom-4 left-4 z-40 pointer-events-none">
              <div className="pointer-events-auto p-3 rounded-2xl glass" style={{ background: 'rgba(88,28,135,0.7)', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ fontWeight: 900, color: '#e9d5ff', marginBottom: '8px', fontSize: '13px' }}>🎓 Analysis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {equity && (
                    <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: equity.winPct > 50 ? 'rgba(22,101,52,0.8)' : 'rgba(127,29,29,0.8)', color: equity.winPct > 50 ? '#86efac' : '#fca5a5', border: `1px solid ${equity.winPct > 50 ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                      Eq: {equity.winPct.toFixed(1)}%
                    </span>
                  )}
                  {potOdds > 0 && legalActions?.canCall && (
                    <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: equity && equity.winPct > potOdds ? 'rgba(22,101,52,0.8)' : 'rgba(120,53,15,0.8)', color: equity && equity.winPct > potOdds ? '#86efac' : '#fde68a', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Pot Odds: {potOdds.toFixed(1)}% {equity && (equity.winPct > potOdds ? '✓' : '✗')}
                    </span>
                  )}
                  {outs && outs.outs > 0 && (
                    <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: 'rgba(30,58,138,0.8)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.4)' }}>
                      {outs.outs} Outs ≈{outs.ruleOf4Pct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Panel (Absolute Bottom-Right corner) */}
          {isMyTurn && legalActions && (
            <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 z-50 animate-slide-up action-panel-shrink">
              <div className="glass shadow-2xl rounded-2xl p-2 sm:p-4 border border-green-500/20" style={{ background: 'rgba(5, 15, 5, 0.95)', minWidth: '280px' }}>
                <ActionPanel
                  legal={legalActions}
                  gameState={gameState}
                  onAction={sendAction}
                  equity={trainingMode && equity ? equity.winPct : null}
                  potOdds={trainingMode ? potOdds : undefined}
                  outsCount={trainingMode && outs ? outs.outs : undefined}
                />
              </div>
            </div>
          )}

        </div>

        {/* ── Desktop Sidebar ── */}
        <div className="hidden lg:flex" style={{
          width: '224px', flexDirection: 'column', flexShrink: 0,
          background: 'rgba(4,12,4,0.92)', borderLeft: '1px solid #1a3a1a',
        }}>
          <SidebarContent
            tab={tab} setTab={setTab} logRef={logRef}
            actionLog={actionLog} stats={stats} myPlayer={myPlayer}
            gameState={gameState} playerId={playerId} totalPot={totalPot}
            roomCode={roomCode} onCopyCode={handleCopyCode} codeCopied={codeCopied}
          />
        </div>

        {/* ── Mobile Sidebar Overlay ── */}
        {sidebarOpen && (
          <div
            className="lg:hidden"
            style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(3,10,3,0.97)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a3a1a' }}>
              <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '14px' }}>Game Info</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SidebarContent
                tab={tab} setTab={setTab} logRef={logRef}
                actionLog={actionLog} stats={stats} myPlayer={myPlayer}
                gameState={gameState} playerId={playerId} totalPot={totalPot}
                roomCode={roomCode} onCopyCode={handleCopyCode} codeCopied={codeCopied}
              />
            </div>
          </div>
        )}
    </div>
  );
};

interface SidebarProps {
  tab: 'log' | 'stats';
  setTab: (t: 'log' | 'stats') => void;
  logRef: React.RefObject<HTMLDivElement | null>;
  actionLog: string[];
  stats: any;
  myPlayer: any;
  gameState: any;
  playerId: string | null;
  totalPot: number;
  roomCode: string | null;
  onCopyCode: () => void;
  codeCopied: boolean;
}

const SidebarContent: React.FC<SidebarProps> = ({
  tab, setTab, logRef, actionLog, stats, myPlayer, gameState, playerId, totalPot,
  roomCode, onCopyCode, codeCopied,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Tab bar */}
    <div style={{ display: 'flex', borderBottom: '1px solid #1a3a1a', flexShrink: 0 }}>
      {(['log', 'stats'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)} style={{
          flex: 1, padding: '8px', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.5px', background: 'none',
          border: 'none', cursor: 'pointer', transition: 'color 0.2s',
          color: tab === t ? '#4ade80' : '#4b5563',
          borderBottom: tab === t ? '2px solid #22c55e' : '2px solid transparent',
        }}>
          {t === 'log' ? '📋 Log' : '📊 Stats'}
        </button>
      ))}
    </div>

    {tab === 'log' && (
      <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {actionLog.length === 0 && (
          <p style={{ color: '#374151', fontSize: '11px', fontStyle: 'italic', padding: '6px' }}>No actions yet…</p>
        )}
        {actionLog.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: '11px', lineHeight: 1.5, padding: '1px 4px', borderRadius: '4px',
              color: line.startsWith('🏆') ? '#fde68a'
                : line.startsWith('---') ? '#374151'
                : line.includes('raises') || line.includes('bets') ? '#fef08a'
                : line.includes('folds') ? '#f87171'
                : line.includes('calls') ? '#93c5fd'
                : line.includes('checks') ? '#d1d5db'
                : line.includes('posts') ? '#6b7280'
                : '#9ca3af',
              background: line.startsWith('🏆') ? 'rgba(133,77,14,0.2)' : 'transparent',
              fontWeight: line.startsWith('🏆') ? 700 : 400,
              borderTop: line.startsWith('---') ? '1px solid #1a3a1a' : 'none',
              marginTop: line.startsWith('---') ? '4px' : 0,
              paddingTop: line.startsWith('---') ? '4px' : '1px',
            }}
          >{line}</div>
        ))}
      </div>
    )}

    {tab === 'stats' && (
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {myPlayer && (
          <>
            <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Session</div>
            {[
              { label: 'Stack',    value: `$${myPlayer.stack.toLocaleString()}`, color: myPlayer.stack >= gameState.settings.startingStack ? '#4ade80' : '#f87171' },
              { label: 'P&L',     value: `${myPlayer.stack - gameState.settings.startingStack >= 0 ? '+' : ''}$${(myPlayer.stack - gameState.settings.startingStack).toLocaleString()}`, color: myPlayer.stack >= gameState.settings.startingStack ? '#4ade80' : '#f87171' },
              { label: 'Hands',   value: String(stats.handsPlayed) },
              { label: 'Won',     value: String(stats.handsWon) },
              { label: 'Win %',   value: stats.handsPlayed > 0 ? `${((stats.handsWon / stats.handsPlayed) * 100).toFixed(0)}%` : '–' },
              { label: 'Best Pot',value: stats.biggestPot > 0 ? `$${stats.biggestPot.toLocaleString()}` : '–' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                <span style={{ color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: (row as any).color ?? '#d1d5db' }}>{row.value}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ borderTop: '1px solid #1a3a1a', marginTop: '10px', paddingTop: '10px' }}>
          <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Players</div>
          {[...gameState.players]
            .sort((a: any, b: any) => b.stack - a.stack)
            .map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', color: p.id === playerId ? '#a5b4fc' : '#9ca3af' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                  {p.name}{p.id === playerId ? ' (me)' : ''}
                </span>
                <span style={{ fontWeight: 700, color: p.stack <= 0 ? '#f87171' : '#4ade80' }}>
                  ${p.stack.toLocaleString()}
                  {p.id !== playerId && myPlayer && myPlayer.stack > 0 && (
                    <button onClick={() => {
                      const str = prompt(`How many chips to gift ${p.name}? (Your max: ${myPlayer.stack})`);
                      if (!str) return;
                      const amt = parseInt(str.replace(/\D/g, ''), 10);
                      if (isNaN(amt) || amt <= 0 || amt > myPlayer.stack) {
                        alert('Invalid amount');
                        return;
                      }
                      usePokerStore.getState().giftChips(p.id, amt);
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '6px', fontSize: '12px' }} title="Gift Chips">🎁</button>
                  )}
                </span>
              </div>
            ))}
        </div>

        {totalPot > 0 && (
          <div style={{ borderTop: '1px solid #1a3a1a', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
            <span style={{ color: '#6b7280' }}>Total Pot</span>
            <span style={{ color: '#fcd34d' }}>${totalPot.toLocaleString()}</span>
          </div>
        )}
      </div>
    )}

    {/* Bottom: invite code */}
    <div style={{ flexShrink: 0, borderTop: '1px solid #1a3a1a', padding: '8px 10px' }}>
      {roomCode && (
        <button
          onClick={onCopyCode}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: codeCopied ? 'rgba(22,101,52,0.3)' : 'rgba(0,0,0,0.4)',
            outline: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#fde68a', fontWeight: 900, letterSpacing: '0.25em', fontSize: '13px' }}>{roomCode}</span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{codeCopied ? '✅ Copied' : '📋 Copy invite'}</span>
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
        <span style={{ color: '#374151', fontSize: '10px' }}>Connected</span>
      </div>
    </div>
  </div>
);

export default GameScreen;
