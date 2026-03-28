import React, { useState, useEffect, useRef } from 'react';
import type { LegalActions, GameState } from '../types';
import { ActionType } from '../types';
import { SFX } from '../services/SoundManager';

interface ActionPanelProps {
  legal: LegalActions;
  gameState: GameState;
  onAction: (action: ActionType, amount?: number) => void;
  equity?: number | null;
  potOdds?: number;
  outsCount?: number;
}

const PRESETS = [
  { label: '1/4', factor: 0.25 },
  { label: '1/3', factor: 0.33 },
  { label: '½',   factor: 0.5  },
  { label: '2/3', factor: 0.67 },
  { label: 'Pot', factor: 1    },
  { label: 'All↑',factor: Infinity },
];

export const ActionPanel: React.FC<ActionPanelProps> = ({
  legal, gameState, onAction, equity, potOdds, outsCount,
}) => {
  const effectiveMin = legal.canRaise ? legal.raiseMin : legal.betMin;
  const effectiveMax = legal.canRaise ? legal.raiseMax : legal.betMax;
  const [raiseAmount, setRaiseAmount] = useState(effectiveMin || 0);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRaiseAmount(Math.max(effectiveMin, Math.min(effectiveMax, raiseAmount || effectiveMin)));
  }, [effectiveMin, effectiveMax]);

  const totalPot = gameState.pots.reduce((s, p) => s + p.amount, 0) +
    gameState.players.reduce((s, p) => s + p.roundContributed, 0);

  const showBetControls = (legal.canRaise || legal.canBet) && !legal.mustGoAllIn;
  const effectiveAction = legal.canRaise ? ActionType.RAISE : ActionType.BET;
  const isProfitable = equity != null && potOdds != null && potOdds > 0 && equity > potOdds;

  // Build preset buttons
  const presets = PRESETS.map(p => {
    const raw = p.factor === Infinity
      ? effectiveMax
      : Math.round(totalPot * p.factor);
    const val = Math.max(effectiveMin, Math.min(effectiveMax, raw));
    return { label: p.label, value: val };
  }).filter((p, i, arr) => i === 0 || p.value !== arr[i - 1].value);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingAmount) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') {
        if (legal.canFold) { handleAction(ActionType.FOLD); }
      } else if (e.key === 'c' || e.key === 'C') {
        if (legal.canCall) handleAction(ActionType.CALL, legal.callAmount);
        else if (legal.canCheck) handleAction(ActionType.CHECK);
      } else if (e.key === 'r' || e.key === 'R') {
        if (showBetControls) handleAction(effectiveAction, raiseAmount);
      } else if (e.key === 'a' || e.key === 'A') {
        if (legal.mustGoAllIn || legal.canCall) {
          if (legal.mustGoAllIn) handleAction(ActionType.CALL, legal.callAmount);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [legal, raiseAmount, editingAmount, showBetControls]);

  const handleAction = (action: ActionType, amount = 0) => {
    switch (action) {
      case ActionType.FOLD:  SFX.fold(); break;
      case ActionType.CHECK: SFX.check(); break;
      case ActionType.CALL:  legal.mustGoAllIn ? SFX.allIn() : SFX.chipClick(); break;
      case ActionType.RAISE:
      case ActionType.BET:   SFX.chipStack(); break;
    }
    onAction(action, amount);
  };

  const startEditing = () => {
    setEditValue(String(raiseAmount));
    setEditingAmount(true);
    setTimeout(() => { inputRef.current?.select(); }, 30);
  };

  const commitEdit = () => {
    const n = parseInt(editValue, 10);
    if (!isNaN(n)) {
      setRaiseAmount(Math.max(effectiveMin, Math.min(effectiveMax, n)));
    }
    setEditingAmount(false);
  };

  return (
    <div
      className="w-full rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: 'rgba(4,12,4,0.98)',
        border: '1px solid rgba(74,222,128,0.18)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Training info pills ── */}
      {(equity != null || outsCount != null) && (
        <div style={{ padding: '8px 12px 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {equity != null && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
              background: equity > 60 ? 'rgba(22,101,52,0.6)' : equity > 40 ? 'rgba(120,53,15,0.6)' : 'rgba(127,29,29,0.6)',
              color: equity > 60 ? '#86efac' : equity > 40 ? '#fcd34d' : '#fca5a5',
              border: `1px solid ${equity > 60 ? 'rgba(74,222,128,0.3)' : equity > 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              📊 Equity {equity.toFixed(1)}%
            </span>
          )}
          {potOdds != null && potOdds > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
              background: isProfitable ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
              color: isProfitable ? '#86efac' : '#fdba74',
              border: `1px solid ${isProfitable ? 'rgba(74,222,128,0.3)' : 'rgba(249,115,22,0.3)'}`,
            }}>
              Pot Odds {potOdds.toFixed(1)}% {isProfitable ? '✓ profitable' : '✗ unfav.'}
            </span>
          )}
          {outsCount != null && outsCount > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
              background: 'rgba(23,37,84,0.6)', color: '#93c5fd',
              border: '1px solid rgba(99,102,241,0.3)',
            }}>
              {outsCount} outs
            </span>
          )}
        </div>
      )}

      {/* ── Call amount info ── */}
      {legal.canCall && legal.callAmount > 0 && (
        <div style={{ padding: '6px 12px 0', fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
          Call <span style={{ color: '#fcd34d', fontWeight: 800 }}>${legal.callAmount.toLocaleString()}</span>
          {legal.mustGoAllIn && <span style={{ color: '#fb923c', fontWeight: 700, marginLeft: '6px' }}>— All-In!</span>}
        </div>
      )}

      {/* ── Raise slider & presets ── */}
      {showBetControls && (
        <div style={{ padding: '10px 12px 4px' }}>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { setRaiseAmount(p.value); SFX.click(); }}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: '8px', border: 'none',
                  fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  background: raiseAmount === p.value ? 'rgba(217,119,6,0.3)' : 'rgba(30,30,30,0.6)',
                  color: raiseAmount === p.value ? '#fcd34d' : '#6b7280',
                  outline: raiseAmount === p.value ? '1px solid rgba(217,119,6,0.5)' : '1px solid transparent',
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Slider + editable amount */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min={effectiveMin} max={effectiveMax} value={raiseAmount}
              step={Math.max(1, Math.floor(effectiveMax / 200))}
              onChange={e => setRaiseAmount(Number(e.target.value))}
              style={{
                flex: 1, height: '6px', borderRadius: '999px',
                background: `linear-gradient(to right, #d97706 0%, #d97706 ${((raiseAmount - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100}%, #374151 ${((raiseAmount - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100}%, #374151 100%)`,
              }}
            />
            {/* Tap-to-edit amount */}
            {editingAmount ? (
              <input
                ref={inputRef}
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
                style={{
                  width: '72px', padding: '4px 6px', borderRadius: '8px', textAlign: 'right',
                  background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(217,119,6,0.6)',
                  color: '#fcd34d', fontWeight: 800, fontSize: '14px', outline: 'none',
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={startEditing}
                title="Tap to type exact amount"
                style={{
                  minWidth: '68px', padding: '4px 6px', borderRadius: '8px', textAlign: 'right',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(217,119,6,0.25)',
                  color: '#fcd34d', fontWeight: 800, fontSize: '14px', cursor: 'text',
                }}
              >
                ${raiseAmount.toLocaleString()}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: '6px', padding: '8px 10px 10px' }}>
        {legal.canFold && (
          <button
            id="btn-fold"
            className="btn-press"
            onClick={() => handleAction(ActionType.FOLD)}
            style={{
              flex: 1, padding: '13px 4px', borderRadius: '14px', border: 'none',
              fontWeight: 900, fontSize: '13px', cursor: 'pointer', position: 'relative',
              background: 'linear-gradient(135deg,#7f1d1d,#991b1b)',
              boxShadow: '0 2px 12px rgba(127,29,29,0.5)',
              color: '#fecaca', letterSpacing: '0.5px',
            }}
          >
            Fold
            <span className="hotkey-badge" style={{ position: 'absolute', top: '4px', right: '5px' }}>F</span>
          </button>
        )}

        {legal.canCheck && (
          <button
            id="btn-check"
            className="btn-press"
            onClick={() => handleAction(ActionType.CHECK)}
            style={{
              flex: 1, padding: '13px 4px', borderRadius: '14px', border: 'none',
              fontWeight: 900, fontSize: '13px', cursor: 'pointer', position: 'relative',
              background: 'linear-gradient(135deg,#374151,#4b5563)',
              boxShadow: '0 2px 10px rgba(55,65,81,0.4)',
              color: '#e5e7eb', letterSpacing: '0.5px',
            }}
          >
            Check
            <span className="hotkey-badge" style={{ position: 'absolute', top: '4px', right: '5px' }}>C</span>
          </button>
        )}

        {legal.canCall && (
          <button
            id="btn-call"
            className="btn-press"
            onClick={() => handleAction(ActionType.CALL, legal.callAmount)}
            style={{
              flex: 1, padding: '13px 4px', borderRadius: '14px', border: 'none',
              fontWeight: 900, fontSize: '13px', cursor: 'pointer', position: 'relative',
              background: legal.mustGoAllIn
                ? 'linear-gradient(135deg,#7e22ce,#6b21a8)'
                : isProfitable
                  ? 'linear-gradient(135deg,#166534,#15803d)'
                  : 'linear-gradient(135deg,#1d4ed8,#1e40af)',
              boxShadow: legal.mustGoAllIn
                ? '0 2px 12px rgba(126,34,206,0.45)'
                : isProfitable
                  ? '0 2px 12px rgba(22,163,74,0.45)'
                  : '0 2px 12px rgba(29,78,216,0.4)',
              color: '#fff', letterSpacing: '0.3px',
            }}
          >
            {legal.mustGoAllIn ? '⚡ All-In' : `Call $${legal.callAmount.toLocaleString()}`}
            <span className="hotkey-badge" style={{ position: 'absolute', top: '4px', right: '5px' }}>C</span>
          </button>
        )}

        {showBetControls && (
          <button
            id="btn-raise"
            className="btn-press"
            onClick={() => handleAction(effectiveAction, raiseAmount)}
            style={{
              flex: 1, padding: '13px 4px', borderRadius: '14px', border: 'none',
              fontWeight: 900, fontSize: '13px', cursor: 'pointer', position: 'relative',
              background: 'linear-gradient(135deg,#92400e,#b45309)',
              boxShadow: '0 2px 14px rgba(146,64,14,0.5)',
              color: '#fef3c7', letterSpacing: '0.3px',
            }}
          >
            {legal.canRaise ? `Raise $${raiseAmount.toLocaleString()}` : `Bet $${raiseAmount.toLocaleString()}`}
            <span className="hotkey-badge" style={{ position: 'absolute', top: '4px', right: '5px' }}>R</span>
          </button>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <div style={{ textAlign: 'center', paddingBottom: '6px', fontSize: '10px', color: '#374151', letterSpacing: '0.5px' }}>
        Hotkeys: <span style={{ color: '#4b5563' }}>F</span> fold · <span style={{ color: '#4b5563' }}>C</span> call/check · <span style={{ color: '#4b5563' }}>R</span> raise
      </div>
    </div>
  );
};

export default ActionPanel;
