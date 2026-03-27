import React, { useState, useEffect } from 'react';
import type { LegalActions, GameState } from '../types';
import { ActionType } from '../types';

interface ActionPanelProps {
  legal: LegalActions;
  gameState: GameState;
  onAction: (action: ActionType, amount?: number) => void;
  equity?: number | null;
  potOdds?: number;
  outsCount?: number;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  legal, gameState, onAction, equity, potOdds, outsCount,
}) => {
  const effectiveMin = legal.canRaise ? legal.raiseMin : legal.betMin;
  const effectiveMax = legal.canRaise ? legal.raiseMax : legal.betMax;
  const [raiseAmount, setRaiseAmount] = useState(effectiveMin || 0);

  useEffect(() => {
    setRaiseAmount(Math.max(effectiveMin, Math.min(effectiveMax, raiseAmount || effectiveMin)));
  }, [effectiveMin, effectiveMax]);

  const totalPot = gameState.pots.reduce((s, p) => s + p.amount, 0) +
    gameState.players.reduce((s, p) => s + p.roundContributed, 0);

  const showBetControls = (legal.canRaise || legal.canBet) && !legal.mustGoAllIn;
  const effectiveAction = legal.canRaise ? ActionType.RAISE : ActionType.BET;

  const presets = [
    { label: 'Min',  value: effectiveMin },
    { label: '½P',   value: Math.round(totalPot * 0.5) },
    { label: 'Pot',  value: totalPot },
    { label: 'All↑', value: effectiveMax },
  ].map(p => ({ ...p, value: Math.max(effectiveMin, Math.min(effectiveMax, p.value)) }))
   .filter((p, i, arr) => i === 0 || p.value !== arr[i-1].value);

  const isProfitable = equity != null && potOdds != null && potOdds > 0 && equity > potOdds;

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(6,15,6,0.97)',
        border: '1px solid rgba(74,222,128,0.2)',
        boxShadow: '0 -2px 20px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
      }}>

      {/* Training info pills */}
      {(equity != null || outsCount != null) && (
        <div className="px-3 pt-2 pb-0 flex flex-wrap gap-1.5">
          {equity != null && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${equity > 60 ? 'bg-green-900/60 text-green-300 border-green-700/40' : equity > 40 ? 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40' : 'bg-red-900/60 text-red-300 border-red-700/40'}`}>
              Eq {equity.toFixed(1)}%
            </span>
          )}
          {potOdds != null && potOdds > 0 && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${isProfitable ? 'bg-green-900/60 text-green-300 border-green-700/40' : 'bg-orange-900/60 text-orange-300 border-orange-700/40'}`}>
              Odds {potOdds.toFixed(1)}% {isProfitable ? '✓' : '✗'}
            </span>
          )}
          {outsCount != null && outsCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/40">
              {outsCount} outs
            </span>
          )}
        </div>
      )}

      {/* Call info */}
      {legal.canCall && legal.callAmount > 0 && (
        <div className="px-3 pt-1 text-[11px] text-gray-500 text-center">
          Call: <span className="text-yellow-300 font-bold">${legal.callAmount}</span>
          {legal.mustGoAllIn && <span className="ml-1 text-orange-400 font-semibold">(all-in)</span>}
        </div>
      )}

      {/* Raise slider */}
      {showBetControls && (
        <div className="px-3 pt-2 pb-1">
          {/* Preset buttons */}
          <div className="flex gap-1.5 mb-2">
            {presets.map(p => (
              <button key={p.label}
                onClick={() => setRaiseAmount(p.value)}
                className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-all ${raiseAmount === p.value ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/50' : 'bg-gray-800/60 text-gray-400 border border-transparent'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Slider */}
          <div className="flex items-center gap-3">
            <input type="range"
              min={effectiveMin} max={effectiveMax} value={raiseAmount}
              step={Math.max(1, Math.floor(effectiveMax / 200))}
              onChange={e => setRaiseAmount(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #d97706 0%, #d97706 ${((raiseAmount - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100}%, #374151 ${((raiseAmount - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100}%, #374151 100%)` }}
            />
            <span className="text-yellow-300 font-black text-sm min-w-[60px] text-right">${raiseAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Action buttons — big touch targets */}
      <div className="flex gap-1.5 px-3 py-2.5">
        {legal.canFold && (
          <button id="btn-fold"
            className="flex-1 py-3.5 sm:py-3 font-black rounded-xl text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', boxShadow: '0 2px 10px rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.3)' }}
            onClick={() => onAction(ActionType.FOLD)}
          >Fold</button>
        )}

        {legal.canCheck && (
          <button id="btn-check"
            className="flex-1 py-3.5 sm:py-3 font-black rounded-xl text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#374151,#4b5563)', boxShadow: '0 2px 10px rgba(55,65,81,0.4)', border: '1px solid rgba(107,114,128,0.3)' }}
            onClick={() => onAction(ActionType.CHECK)}
          >Check</button>
        )}

        {legal.canCall && (
          <button id="btn-call"
            className="flex-1 py-3.5 sm:py-3 font-black rounded-xl text-sm transition-all active:scale-95"
            style={{
              background: legal.mustGoAllIn ? 'linear-gradient(135deg,#7e22ce,#6b21a8)' : 'linear-gradient(135deg,#1d4ed8,#1e40af)',
              boxShadow: legal.mustGoAllIn ? '0 2px 10px rgba(126,34,206,0.4)' : '0 2px 10px rgba(29,78,216,0.35)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
            onClick={() => onAction(ActionType.CALL, legal.callAmount)}
          >{legal.mustGoAllIn ? '⚡ All-In' : `Call $${legal.callAmount}`}</button>
        )}

        {showBetControls && (
          <button id="btn-raise"
            className="flex-1 py-3.5 sm:py-3 font-black rounded-xl text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#92400e,#b45309)', boxShadow: '0 2px 12px rgba(146,64,14,0.45)', border: '1px solid rgba(250,204,21,0.3)' }}
            onClick={() => onAction(effectiveAction, raiseAmount)}
          >{legal.canRaise ? `Raise $${raiseAmount}` : `Bet $${raiseAmount}`}</button>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;
