import React, { useState, useEffect } from 'react';
import { usePokerStore } from '../store/pokerStore';
import { AIType } from '../types';
import { toastError } from '../components/Toast';
import { SFX } from '../services/SoundManager';

const SUIT_ICONS = ['♠', '♥', '♦', '♣'];

const AI_OPTIONS = [
  { value: AIType.RANDOM,           label: 'Random',           desc: 'Makes random legal moves.',          icon: '🎲', color: '#9ca3af' },
  { value: AIType.TIGHT_PASSIVE,    label: 'Tight Passive',    desc: 'Plays few hands, mostly calls.',     icon: '🐢', color: '#93c5fd' },
  { value: AIType.LOOSE_AGGRESSIVE, label: 'Loose Aggressive', desc: 'Raises often, very active.',         icon: '🔥', color: '#fdba74' },
  { value: AIType.PROBABILITY,      label: 'Probability-Based',desc: 'Uses equity & position. Realistic.', icon: '🧠', color: '#c4b5fd' },
];

// Removed unused URLs

// Removed unused getShareUrl

export const MenuScreen: React.FC = () => {
  const { createRoom, joinRoom, error, clearError, connected } = usePokerStore();

  // Read ?join= from URL → auto-switch to join tab and pre-fill code
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlJoinCode = urlParams.get('join')?.toUpperCase() ?? '';

  const [tab, setTab] = useState<'create' | 'join'>(urlJoinCode ? 'join' : 'create');
  const authUser = usePokerStore(s => s.authUser);
  const fetchMe = usePokerStore(s => s.fetchMe);
  const [joinCode, setJoinCode]     = useState(urlJoinCode);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind]     = useState(20);
  const [startStack, setStartStack] = useState(1000);
  const [numAI, setNumAI]           = useState(2);
  const [aiType, setAiType]         = useState<AIType>(AIType.PROBABILITY);
  const [creating, setCreating]     = useState(false);
  const [joining, setJoining]       = useState(false);

  // Fetch latest chips on mount
  useEffect(() => { 
    fetchMe();
  }, []);

  // Show errors as toasts and clear from store
  useEffect(() => {
    if (error) {
      toastError(error);
      clearError();
      setCreating(false);
      setJoining(false);
      SFX.error();
    }
  }, [error]);

  // Sync big blind to 2× small blind automatically
  const handleSmallBlindChange = (v: number) => {
    setSmallBlind(v);
    setBigBlind(v * 2);
  };

  const handleCreate = () => {
    if (!authUser) return;
    if (!connected) { toastError('Still connecting to server…'); SFX.error(); return; }
    // TEMPORARY QA CHEAT: Removed frontend chip validation so testers can build rooms
    setCreating(true);
    SFX.click();
    createRoom(authUser.username, { smallBlind, bigBlind, startingStack: startStack, numAI, aiType });
  };

  const handleJoin = () => {
    if (!authUser) return;
    if (joinCode.length < 6) { toastError('Enter the 6-letter room code'); SFX.error(); return; }
    if (!connected) { toastError('Still connecting to server…'); SFX.error(); return; }
    setJoining(true);
    SFX.click();
    joinRoom(joinCode.trim(), authUser.username);
  };

// Removed unused handleCopyServerUrl

  const switchTab = (t: 'create' | 'join') => {
    setTab(t);
    SFX.click();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #0d2a0d 0%, #050c05 55%, #020602 100%)' }}
    >
      {/* Ambient suit icons */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {SUIT_ICONS.map((suit, i) => (
          <div
            key={i}
            className="suit-ambient"
            style={{
              position: 'absolute',
              fontSize: `${8 + i * 3}rem`,
              color: 'rgba(74,222,128,0.07)',
              top: `${[10, 60, 5, 70][i]}%`,
              left: `${[5, 75, 60, 15][i]}%`,
              animationDelay: `${i * 4}s`,
              animationDuration: `${22 + i * 7}s`,
            }}
          >{suit}</div>
        ))}
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '5rem', marginBottom: '8px', filter: 'drop-shadow(0 0 24px rgba(74,222,128,0.35))' }}
            className="animate-float">🃏</div>
          <h1 style={{
            fontSize: '3.5rem', fontWeight: 900, margin: '0 0 4px',
            background: 'linear-gradient(135deg,#4ade80,#facc15,#f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-2px', lineHeight: 1,
          }}>POKER</h1>
          <p style={{ color: 'rgba(74,222,128,0.55)', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 10px' }}>
            No-Limit Texas Hold'em
          </p>

          {/* Connection indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '999px',
              background: connected ? 'rgba(22,101,52,0.3)' : 'rgba(127,29,29,0.3)',
              border: `1px solid ${connected ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <div style={{
                position: 'relative', width: '8px', height: '8px',
                borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
              }} className={connected ? 'pulse-ring' : ''} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: connected ? '#86efac' : '#fca5a5' }}>
                {connected ? 'Server Online' : 'Connecting…'}
              </span>
            </div>
            {/* Extremely precise debug URL the user requested so they know what DB Vercel is connected to */}
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
              {import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}
            </span>
          </div>
        </div>

        {/* ── Main card ── */}
        <div className="glass" style={{ borderRadius: '20px', padding: '24px' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px',
            padding: '4px', borderRadius: '14px', background: 'rgba(0,0,0,0.4)' }}>
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: tab === t
                    ? t === 'create'
                      ? 'linear-gradient(135deg,#15803d,#166534)'
                      : 'linear-gradient(135deg,#1d4ed8,#1e40af)'
                    : 'transparent',
                  color: tab === t ? '#fff' : '#6b7280',
                  boxShadow: tab === t
                    ? t === 'create' ? '0 2px 12px rgba(22,163,74,0.35)' : '0 2px 12px rgba(59,130,246,0.35)'
                    : 'none',
                }}
              >
                {t === 'create' ? '🏠 Create Table' : '🚀 Join Table'}
              </button>
            ))}
          </div>



          {/* ── CREATE TAB ── */}
          {tab === 'create' ? (
            <>
              {/* Blinds & stack config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Small Blind', value: smallBlind, setter: handleSmallBlindChange, min: 1, step: 5 },
                  { label: 'Big Blind',   value: bigBlind,   setter: setBigBlind,   min: 2, step: 10 },
                  { label: 'Starting Stack', value: startStack, setter: setStartStack, min: 100, step: 100 },
                  { label: 'AI Opponents',   value: numAI,     setter: setNumAI,     min: 0, max: 8, step: 1 },
                ].map(({ label, value, setter, min, max, step }) => (
                  <div key={label}>
                    <label style={{ display: 'block', color: '#6b7280', fontSize: '10px',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      {label}
                    </label>
                    <input
                      type="number"
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(74,222,128,0.12)',
                        color: '#fff', fontSize: '14px', fontWeight: 700, outline: 'none',
                        transition: 'border-color 0.2s', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(74,222,128,0.4)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(74,222,128,0.12)'}
                      value={value}
                      onChange={e => setter(Number(e.target.value))}
                      min={min} max={max} step={step}
                    />
                  </div>
                ))}
              </div>

              {/* AI difficulty */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  AI Difficulty
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {AI_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setAiType(opt.value); SFX.click(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', borderRadius: '10px', textAlign: 'left',
                        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: aiType === opt.value ? 'rgba(74,222,128,0.1)' : 'rgba(0,0,0,0.3)',
                        outline: aiType === opt.value ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{opt.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: opt.color, marginBottom: '1px' }}>{opt.label}</div>
                        <div style={{ fontSize: '11px', color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.desc}</div>
                      </div>
                      {aiType === opt.value && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ color: '#374151', fontSize: '12px', textAlign: 'center', marginBottom: '14px' }}>
                Share your 6-letter room code with friends after creating.
              </p>

              <button
                className="btn-press"
                onClick={handleCreate}
                disabled={creating}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  fontWeight: 900, fontSize: '15px', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#15803d,#166534)',
                  color: '#fff', letterSpacing: '0.5px',
                  boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
                  transition: 'all 0.2s', opacity: creating ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {creating ? (
                  <>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                      animation: 'spin 0.7s linear infinite' }} />
                    Creating…
                  </>
                ) : 'Create Table 🎲'}
              </button>
            </>
          ) : (
            /* ── JOIN TAB ── */
            <>
              {urlJoinCode && (
                <div style={{
                  marginBottom: '12px', padding: '8px 12px', borderRadius: '10px',
                  background: 'rgba(22,101,52,0.2)', border: '1px solid rgba(74,222,128,0.2)',
                  fontSize: '12px', color: '#86efac', fontWeight: 600,
                }}>
                  🔗 Joining via invite link — code pre-filled!
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Room Code
                </label>
                <input
                  style={{
                    width: '100%', padding: '16px', borderRadius: '12px',
                    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(59,130,246,0.3)',
                    color: '#fff', fontSize: '2rem', fontWeight: 900,
                    letterSpacing: '0.4em', textAlign: 'center', textTransform: 'uppercase',
                    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.7)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.3)'}
                  placeholder="XXXXXX"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                />
                {/* Individual code letter boxes visual hint */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      width: '32px', height: '4px', borderRadius: '2px',
                      background: i < joinCode.length ? '#3b82f6' : 'rgba(59,130,246,0.15)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
              </div>

              <p style={{ color: '#374151', fontSize: '12px', textAlign: 'center', marginBottom: '16px' }}>
                Get the 6-letter code from whoever created the table.
              </p>

              <button
                className="btn-press"
                onClick={handleJoin}
                disabled={joinCode.length < 6 || joining}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  fontWeight: 900, fontSize: '15px',
                  cursor: (joinCode.length >= 6) ? 'pointer' : 'not-allowed',
                  background: (joinCode.length >= 6) ? 'linear-gradient(135deg,#1d4ed8,#1e40af)' : 'rgba(55,65,81,0.5)',
                  color: '#fff', letterSpacing: '0.5px',
                  boxShadow: (joinCode.length >= 6) ? '0 4px 20px rgba(59,130,246,0.4)' : 'none',
                  transition: 'all 0.2s', opacity: joining ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {joining ? (
                  <>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                      animation: 'spin 0.7s linear infinite' }} />
                    Joining…
                  </>
                ) : 'Join Table 🚀'}
              </button>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <p style={{ color: '#374151', fontSize: '12px' }}>All-in or fold — the math decides ♠♥♦♣</p>
        </div>
      </div>
    </div>
  );
};

export default MenuScreen;
