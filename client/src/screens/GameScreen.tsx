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
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #0a1f0a 0%, #050c05 100%)' }}
    >
      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', flexShrink: 0,
        background: 'linear-gradient(180deg,#0d1f0d,#070f07)',
        borderBottom: '1px solid #1a3a1a',
        gap: '8px',
      }}>
        {/* Left: logo + hand info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontWeight: 900, fontSize: '15px', flexShrink: 0 }}>
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

        {/* Right: room code, controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Room code with copy */}
          {roomCode && (
            <button
              onClick={handleCopyCode}
              title="Copy invite link"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: codeCopied ? 'rgba(22,101,52,0.4)' : 'rgba(0,0,0,0.4)',
                outline: codeCopied ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.25s',
              }}
            >
              <span style={{ color: '#fdf4a5', fontWeight: 900, fontSize: '12px', letterSpacing: '0.2em' }}>
                {roomCode}
              </span>
              <span style={{ fontSize: '11px' }}>{codeCopied ? '✅' : '📋'}</span>
            </button>
          )}

          {/* Connection dot */}
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
          }} className={connected ? '' : 'animate-pulse'} title={connected ? 'Connected' : 'Disconnected'} />

          {/* Training mode */}
          <button
            onClick={() => { setTrainingMode(!trainingMode); SFX.click(); }}
            title="Training mode (shows equity / pot odds)"
            style={{
              padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: trainingMode ? 'rgba(88,28,135,0.5)' : 'rgba(30,30,30,0.5)',
              color: trainingMode ? '#c4b5fd' : '#6b7280', fontSize: '12px', fontWeight: 700,
              outline: trainingMode ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.07)',
              transition: 'all 0.2s',
            }}
          >🎓</button>

          {/* Shortcuts help */}
          <button
            onClick={() => setShowShortcuts(v => !v)}
            style={{
              padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'rgba(30,30,30,0.5)', color: '#6b7280', fontSize: '11px', fontWeight: 700,
              outline: '1px solid rgba(255,255,255,0.07)',
            }}
            title="Keyboard shortcuts"
          >⌨</button>

          {/* Sidebar toggle (mobile) */}
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(v => !v)}
            style={{
              padding: '4px 7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'rgba(30,30,30,0.5)', color: '#6b7280', fontSize: '12px', fontWeight: 700,
              outline: '1px solid rgba(255,255,255,0.07)',
            }}
          >📋</button>
        </div>
      </div>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
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

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Main column: table + actions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>

          {/* Waiting room */}
          {waitingForPlayers && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', gap: '10px' }}
              className="animate-slide-down">
              <div style={{
                padding: '10px 16px', borderRadius: '14px', textAlign: 'center',
                background: 'rgba(6,20,6,0.85)', border: '1px solid rgba(74,222,128,0.15)',
              }}>
                <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 6px' }}>
                  {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} seated
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>Share code:</span>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      background: codeCopied ? 'rgba(22,101,52,0.4)' : 'rgba(0,0,0,0.5)',
                      border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
                      outline: '1px solid rgba(250,204,21,0.3)', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <span style={{ color: '#fde68a', fontWeight: 900, letterSpacing: '0.3em', fontSize: '15px' }}>{roomCode}</span>
                    <span style={{ fontSize: '13px' }}>{codeCopied ? '✅' : '📋'}</span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => { startGame(); SFX.click(); }}
                disabled={gameState.players.filter(p => p.stack > 0).length < 2}
                style={{
                  padding: '12px 32px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  fontWeight: 900, fontSize: '15px', letterSpacing: '0.3px',
                  background: 'linear-gradient(135deg,#16a34a,#15803d)',
                  boxShadow: '0 4px 24px rgba(22,163,74,0.4)',
                  color: '#fff', transition: 'all 0.2s',
                  opacity: gameState.players.filter(p => p.stack > 0).length < 2 ? 0.4 : 1,
                }}
              >
                Start Game 🎲
              </button>
            </div>
          )}

          {/* Poker Table */}
          <div style={{ padding: '0 4px', flexShrink: 0 }} className="landscape-shrink">
            <PokerTable gameState={gameState} myPlayerId={playerId} />
          </div>

          {/* Turn indicator */}
          {gameState.phase === 'playing' && currentActingPlayer && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              {isMyTurn ? (
                <span style={{ color: '#fde68a', fontWeight: 700, fontSize: '13px', animation: 'glow 1.5s ease-in-out infinite' }}>
                  ⟳ Your turn!
                </span>
              ) : (
                <span style={{ color: '#4b5563', fontSize: '12px' }}>
                  Waiting for <span style={{ color: '#9ca3af', fontWeight: 600 }}>{currentActingPlayer.name}</span>…
                </span>
              )}
            </div>
          )}

          {/* My hole cards (large, bottom) */}
          {myPlayer?.holeCards && myPlayer.holeCards[0] !== '??' && myPlayer.status !== 'folded' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
              <div style={{ display: 'flex', gap: '6px', transform: isMyTurn ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.3s' }}>
                {(myPlayer.holeCards as any[]).filter(c => c !== '??').map((card, i) => (
                  <div key={i} style={{ filter: isMyTurn ? 'drop-shadow(0 0 12px rgba(251,191,36,0.6))' : 'none', transition: 'filter 0.3s' }}>
                    <CardComponent card={card} size="lg" dealt delay={i * 100} />
                  </div>
                ))}
              </div>
              {isShowdown && (gameState.showdownResult?.playerEvals as any)?.[myPlayer.id] && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '10px',
                  background: 'rgba(120,80,0,0.5)', border: '1px solid rgba(250,204,21,0.3)',
                  color: '#fde68a', animation: 'bounceIn 0.5s both',
                }}>
                  {(gameState.showdownResult!.playerEvals as any)[myPlayer.id]?.label}
                </span>
              )}
            </div>
          )}

          {/* Training mode info */}
          {trainingMode && isMyTurn && (equity || outs) && (
            <div style={{
              margin: '0 10px 6px', padding: '10px 12px', borderRadius: '12px',
              background: 'rgba(88,28,135,0.2)', border: '1px solid rgba(168,85,247,0.25)',
            }}>
              <div style={{ fontWeight: 800, color: '#c4b5fd', marginBottom: '6px', fontSize: '12px' }}>🎓 Training Mode</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {equity && (
                  <span style={{
                    padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                    background: equity.winPct > 50 ? 'rgba(22,101,52,0.6)' : 'rgba(127,29,29,0.6)',
                    color: equity.winPct > 50 ? '#86efac' : '#fca5a5',
                    border: `1px solid ${equity.winPct > 50 ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    Equity {equity.winPct.toFixed(1)}%
                  </span>
                )}
                {potOdds > 0 && legalActions?.canCall && (
                  <span style={{
                    padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                    background: equity && equity.winPct > potOdds ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
                    color: equity && equity.winPct > potOdds ? '#86efac' : '#fde68a',
                    border: '1px solid rgba(245,158,11,0.25)',
                  }}>
                    Pot Odds {potOdds.toFixed(1)}% {equity && (equity.winPct > potOdds ? '✓' : '✗')}
                  </span>
                )}
                {outs && outs.outs > 0 && (
                  <span style={{
                    padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                    background: 'rgba(23,37,84,0.6)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)',
                  }}>
                    {outs.outs} outs ≈{outs.ruleOf4Pct}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Panel */}
          {isMyTurn && legalActions && (
            <div style={{ padding: '0 8px 8px' }} className="action-panel-shrink">
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

          <div style={{ height: '8px', flexShrink: 0 }} />
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
                <span style={{ fontWeight: 700, color: p.stack <= 0 ? '#f87171' : '#4ade80' }}>${p.stack.toLocaleString()}</span>
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
