import React, { useState } from 'react';
import { usePokerStore } from '../store/pokerStore';
import { AIType } from '../types';

const SUIT_ICONS = ['♠', '♥', '♦', '♣'];

const AI_OPTIONS = [
  { value: AIType.RANDOM,           label: 'Random',          desc: 'Makes random legal moves. Good for testing.',   icon: '🎲', color: 'text-gray-300' },
  { value: AIType.TIGHT_PASSIVE,    label: 'Tight Passive',   desc: 'Plays few hands, mostly calls. Low pressure.',  icon: '🐢', color: 'text-blue-300' },
  { value: AIType.LOOSE_AGGRESSIVE, label: 'Loose Aggressive',desc: 'Plays many hands, raises often. Very active.',  icon: '🔥', color: 'text-orange-300' },
  { value: AIType.PROBABILITY,      label: 'Probability-Based',desc: 'Uses equity & position. Closest to real play.', icon: '🧠', color: 'text-purple-300' },
];

export const MenuScreen: React.FC = () => {
  const { createRoom, joinRoom, error, clearError, connected } = usePokerStore();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [startStack, setStartStack] = useState(1000);
  const [numAI, setNumAI] = useState(2);
  const [aiType, setAiType] = useState<AIType>(AIType.PROBABILITY);

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(name.trim(), { smallBlind, bigBlind, startingStack: startStack, numAI, aiType });
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) return;
    joinRoom(joinCode.trim(), name.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #0d2a0d 0%, #050c05 50%, #020602 100%)' }}>

      {/* Ambient card decorations */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {SUIT_ICONS.map((suit, i) => (
          <div key={i} className="absolute text-green-900/20 font-bold"
            style={{
              fontSize: `${8 + i * 3}rem`,
              top: `${[10, 60, 5, 70][i]}%`,
              left: `${[5, 75, 60, 15][i]}%`,
              transform: `rotate(${[-15, 20, -30, 10][i]}deg)`,
            }}>
            {suit}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-4 select-none" style={{ filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.3))' }}>🃏</div>
          <h1 className="text-5xl font-black tracking-tight mb-1"
            style={{ background: 'linear-gradient(135deg, #4ade80, #facc15, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            POKER
          </h1>
          <p className="text-green-400/70 text-sm font-medium tracking-widest uppercase">No-Limit Texas Hold'em</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              style={connected ? { boxShadow: '0 0 6px #22c55e' } : {}} />
            <span className="text-gray-600 text-xs">{connected ? 'Connected to server' : 'Connecting…'}</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl flex items-center justify-between"
            style={{ background: 'rgba(127,29,29,0.5)', border: '1px solid rgba(239,68,68,0.5)' }}>
            <span className="text-red-200 text-sm">⚠️ {error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-2 text-lg leading-none">✕</button>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl p-6 backdrop-blur-sm"
          style={{
            background: 'rgba(6, 20, 6, 0.9)',
            border: '1px solid rgba(74,222,128,0.15)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(74,222,128,0.1)',
          }}>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.4)' }}>
            {(['create', 'join'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                  tab === t
                    ? t === 'create'
                      ? 'text-white shadow-lg'
                      : 'text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={tab === t ? {
                  background: t === 'create'
                    ? 'linear-gradient(135deg,#15803d,#166534)'
                    : 'linear-gradient(135deg,#1d4ed8,#1e40af)',
                  boxShadow: t === 'create'
                    ? '0 2px 12px rgba(22,163,74,0.3)'
                    : '0 2px 12px rgba(59,130,246,0.3)',
                } : {}}
              >
                {t === 'create' ? '🏠 Create Table' : '🚀 Join Table'}
              </button>
            ))}
          </div>

          {/* Name input (shared) */}
          <div className="mb-4">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Your Name</label>
            <input
              className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 text-sm font-medium transition-all outline-none"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(74,222,128,0.2)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(74,222,128,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(74,222,128,0.2)'}
              placeholder="Enter your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              onKeyDown={e => { if (e.key === 'Enter') tab === 'create' ? handleCreate() : handleJoin(); }}
            />
          </div>

          {tab === 'create' ? (
            <>
              {/* Game settings grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Small Blind', value: smallBlind, setter: setSmallBlind, min: 1 },
                  { label: 'Big Blind',   value: bigBlind,   setter: setBigBlind,   min: 1 },
                  { label: 'Starting Stack', value: startStack, setter: setStartStack, min: 10 },
                  { label: 'AI Opponents',   value: numAI,     setter: setNumAI,     min: 0, max: 8 },
                ].map(({ label, value, setter, min, max }) => (
                  <div key={label}>
                    <label className="block text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{label}</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-medium transition-all outline-none"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.15)' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(74,222,128,0.4)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(74,222,128,0.15)'}
                      value={value}
                      onChange={e => setter(Number(e.target.value))}
                      min={min}
                      max={max}
                    />
                  </div>
                ))}
              </div>

              {/* AI type selector */}
              <div className="mb-5">
                <label className="block text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">AI Difficulty</label>
                <div className="space-y-1.5">
                  {AI_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAiType(opt.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all `}
                      style={{
                        background: aiType === opt.value ? 'rgba(74,222,128,0.1)' : 'rgba(0,0,0,0.3)',
                        border: aiType === opt.value ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${opt.color}`}>{opt.label}</div>
                        <div className="text-gray-600 text-xs truncate">{opt.desc}</div>
                      </div>
                      {aiType === opt.value && <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-gray-600 text-xs text-center mb-4">
                Share your room code after creating so friends can join.
              </p>

              <button
                className="w-full py-3.5 font-black rounded-xl text-base tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleCreate}
                disabled={!name.trim()}
                style={{
                  background: 'linear-gradient(135deg,#15803d,#166534)',
                  boxShadow: name.trim() ? '0 4px 20px rgba(22,163,74,0.4)' : 'none',
                }}
              >
                Create Table 🎲
              </button>
            </>
          ) : (
            <>
              <div className="mb-5">
                <label className="block text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Room Code</label>
                <input
                  className="w-full px-4 py-4 rounded-xl text-white text-3xl font-black tracking-[0.4em] text-center uppercase placeholder-gray-700 transition-all outline-none"
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(59,130,246,0.3)', letterSpacing: '0.4em' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.3)'}
                  placeholder="XXXXXX"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                />
              </div>

              <p className="text-gray-600 text-xs text-center mb-5">
                Get the 6-letter code from whoever created the table.
              </p>

              <button
                className="w-full py-3.5 font-black rounded-xl text-base tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleJoin}
                disabled={!name.trim() || joinCode.length < 4}
                style={{
                  background: 'linear-gradient(135deg,#1d4ed8,#1e40af)',
                  boxShadow: (name.trim() && joinCode.length >= 4) ? '0 4px 20px rgba(59,130,246,0.4)' : 'none',
                }}
              >
                Join Table 🚀
              </button>
            </>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-5">
          All-in or fold — the math decides ♠♥♦♣
        </p>
      </div>
    </div>
  );
};

export default MenuScreen;
