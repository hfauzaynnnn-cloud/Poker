import React from 'react';
import type { Player, CardData, ShowdownResult } from '../types';
import { PlayerStatus, AIType } from '../types';
import CardComponent from './CardComponent';

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe: boolean;
  buttonSeat: number;
  showCards: boolean;
  potContrib?: number;
  totalContrib?: number;
  x: number;
  y: number;
  showdownResult?: ShowdownResult | null;
}

const STATUS_CONFIG: Record<PlayerStatus, { label: string; pill: string }> = {
  active:      { label: '',        pill: '' },
  folded:      { label: 'FOLD',    pill: 'bg-gray-700/80 text-gray-400' },
  all_in:      { label: 'ALL-IN',  pill: 'bg-amber-600/90 text-amber-100' },
  sitting_out: { label: 'AWAY',    pill: 'bg-gray-600/80 text-gray-300' },
  eliminated:  { label: 'BUST',    pill: 'bg-red-900/80 text-red-300' },
};

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player, isCurrentTurn, isMe, buttonSeat, showCards, potContrib = 0,
  totalContrib: _tc = 0, x, y, showdownResult,
}) => {
  const isDealer = player.seat === buttonSeat;
  const isFolded = player.status === 'folded';
  const isElim = player.status === 'eliminated';
  const statusCfg = STATUS_CONFIG[player.status];

  const holeCards = player.holeCards;
  const cardsHidden = !holeCards || holeCards[0] === '??' || (!showCards && !isMe);

  const myAwards = showdownResult?.awards?.filter(a => a.playerId === player.id) ?? [];
  const isWinner = myAwards.length > 0;
  const wonAmount = myAwards.reduce((s, a) => s + a.amount, 0);
  const handLabel = (showdownResult?.playerEvals as any)?.[player.id]?.label ?? null;

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5 transition-all duration-300"
      style={{
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isCurrentTurn ? 10 : 5,
      }}
    >
      {/* Hand label at showdown */}
      {handLabel && !isFolded && (
        <div className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-0.5 text-center max-w-[80px] sm:max-w-[100px] truncate"
          style={{
            background: isWinner ? 'rgba(133,77,14,0.9)' : 'rgba(0,0,0,0.6)',
            border: isWinner ? '1px solid rgba(250,204,21,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: isWinner ? '#fde68a' : '#9ca3af',
          }}>
          {isWinner && '🏆 '}{handLabel}
        </div>
      )}

      {/* Hole cards */}
      <div className={`flex gap-0.5 ${isFolded || isElim ? 'opacity-25' : ''}`}>
        {holeCards && holeCards[0] !== null ? (
          <>
            <CardComponent card={cardsHidden ? '??' : (holeCards[0] as CardData)} size="sm"
              className={isCurrentTurn ? 'ring-1 ring-yellow-400' : ''} />
            <CardComponent card={cardsHidden ? '??' : (holeCards[1] as CardData)} size="sm" />
          </>
        ) : (
          <>
            <div className="w-7 h-10 sm:w-8 sm:h-12 rounded border border-gray-800/30 bg-gray-900/20" />
            <div className="w-7 h-10 sm:w-8 sm:h-12 rounded border border-gray-800/30 bg-gray-900/20" />
          </>
        )}
      </div>

      {/* Seat box */}
      <div className={`relative flex flex-col items-center px-1.5 sm:px-2 py-1 rounded-xl transition-all duration-300 ${isElim ? 'opacity-35' : ''}`}
        style={{
          minWidth: '58px',
          background: isCurrentTurn
            ? 'rgba(133,77,14,0.45)'
            : isMe ? 'rgba(30,58,138,0.55)'
            : isWinner ? 'rgba(22,101,52,0.5)'
            : 'rgba(0,0,0,0.65)',
          border: isCurrentTurn
            ? '1px solid rgba(250,204,21,0.8)'
            : isMe ? '1px solid rgba(99,102,241,0.7)'
            : isWinner ? '1px solid rgba(74,222,128,0.6)'
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: isCurrentTurn ? '0 0 14px rgba(250,204,21,0.3)' : isWinner ? '0 0 12px rgba(74,222,128,0.2)' : 'none',
          backdropFilter: 'blur(8px)',
        }}>

        {/* Dealer badge */}
        {isDealer && (
          <div className="absolute -top-2 -right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black shadow-md z-10"
            style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#1c1917' }}>
            D
          </div>
        )}

        {/* Name */}
        <span className={`text-[10px] sm:text-xs font-bold truncate max-w-[60px] sm:max-w-[72px] ${isMe ? 'text-blue-300' : isCurrentTurn ? 'text-yellow-200' : 'text-gray-300'}`}>
          {player.name}{player.aiType !== AIType.HUMAN ? ' 🤖' : ''}
        </span>

        {/* Stack */}
        <span className={`text-xs sm:text-sm font-black leading-tight ${player.stack <= 0 ? 'text-red-400' : 'text-green-300'}`}>
          ${player.stack.toLocaleString()}
        </span>

        {/* Status pill */}
        {statusCfg.label && (
          <span className={`text-[8px] px-1 py-0.5 rounded-full font-bold ${statusCfg.pill}`}>{statusCfg.label}</span>
        )}

        {/* Bet amount */}
        {potContrib > 0 && (
          <span className="text-[9px] text-yellow-400 font-semibold">+${potContrib}</span>
        )}

        {/* Winner award */}
        {isWinner && wonAmount > 0 && (
          <span className="text-[9px] text-green-300 font-bold animate-bounce">+${wonAmount}</span>
        )}
      </div>
    </div>
  );
};

export default PlayerSeat;
