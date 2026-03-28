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

// Deterministic color from name (for avatar)
function nameToColor(name: string): string {
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#d97706','#0891b2','#dc2626','#059669'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player, isCurrentTurn, isMe, buttonSeat, showCards,
  potContrib = 0, totalContrib: _tc = 0, x, y, showdownResult,
}) => {
  const isDealer  = player.seat === buttonSeat;
  const isFolded  = player.status === PlayerStatus.FOLDED;
  const isElim    = player.status === PlayerStatus.ELIMINATED;
  const isAllIn   = player.status === PlayerStatus.ALL_IN;
  const isSitting = player.status === PlayerStatus.SITTING_OUT;
  const isAI      = player.aiType !== AIType.HUMAN;

  const holeCards   = player.holeCards;
  const cardsHidden = !holeCards || holeCards[0] === '??' || (!showCards && !isMe);

  const myAwards  = showdownResult?.awards?.filter(a => a.playerId === player.id) ?? [];
  const isWinner  = myAwards.length > 0;
  const wonAmount = myAwards.reduce((s, a) => s + a.amount, 0);
  const handLabel = (showdownResult?.playerEvals as any)?.[player.id]?.label ?? null;

  const avatarColor = nameToColor(player.name);

  // Format stack readably
  const fmtStack = (n: number) =>
    n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5"
      style={{
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%,-50%)',
        zIndex: isCurrentTurn ? 10 : 5,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Hand label at showdown */}
      {handLabel && !isFolded && (
        <div
          className={isWinner ? 'animate-bounce-in' : ''}
          style={{
            fontSize: '8px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px',
            marginBottom: '2px', textAlign: 'center',
            maxWidth: '90px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            background: isWinner ? 'linear-gradient(135deg,rgba(133,77,14,0.9),rgba(180,83,9,0.9))' : 'rgba(0,0,0,0.65)',
            border: isWinner ? '1px solid rgba(250,204,21,0.6)' : '1px solid rgba(255,255,255,0.08)',
            color: isWinner ? '#fde68a' : '#9ca3af',
            boxShadow: isWinner ? '0 0 12px rgba(250,204,21,0.2)' : 'none',
          }}
        >
          {isWinner && '🏆 '}{handLabel}
        </div>
      )}

      {/* Hole cards */}
      <div style={{ display: 'flex', gap: '3px', opacity: (isFolded || isElim) ? 0.2 : 1, transition: 'opacity 0.4s' }}>
        {holeCards && holeCards[0] !== null ? (
          <>
            <CardComponent
              card={cardsHidden ? '??' : (holeCards[0] as CardData)}
              size="sm"
              dealt
              delay={0}
              className={isCurrentTurn ? 'animate-glow' : ''}
            />
            <CardComponent
              card={cardsHidden ? '??' : (holeCards[1] as CardData)}
              size="sm"
              dealt
              delay={80}
            />
          </>
        ) : (
          <>
            <div style={{ width: 30, height: 44, borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }} />
            <div style={{ width: 30, height: 44, borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }} />
          </>
        )}
      </div>

      {/* Seat pill */}
      <div
        className={`${isCurrentTurn ? 'animate-glow' : ''} ${isWinner ? 'animate-win-pulse' : ''}`}
        style={{
          position: 'relative',
          minWidth: '62px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '5px 7px 4px', borderRadius: '12px',
          opacity: isElim ? 0.3 : 1,
          background: isCurrentTurn
            ? 'rgba(133,77,14,0.5)'
            : isMe       ? 'rgba(30,58,138,0.6)'
            : isWinner   ? 'rgba(22,101,52,0.55)'
            : 'rgba(0,0,0,0.7)',
          border: isCurrentTurn
            ? '1.5px solid rgba(250,204,21,0.85)'
            : isMe       ? '1.5px solid rgba(99,102,241,0.75)'
            : isWinner   ? '1.5px solid rgba(74,222,128,0.65)'
            : '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s',
        }}
      >
        {/* Dealer button */}
        {isDealer && (
          <div style={{
            position: 'absolute', top: '-8px', right: '-7px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#fbbf24,#d97706)',
            color: '#1c1917', fontSize: '8px', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)', zIndex: 10,
          }}>D</div>
        )}

        {/* Avatar circle */}
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%', marginBottom: '3px',
          background: `linear-gradient(135deg,${avatarColor},${avatarColor}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', fontWeight: 900, color: '#fff', flexShrink: 0,
          border: isMe ? '1.5px solid rgba(165,180,252,0.6)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: `0 0 8px ${avatarColor}55`,
        }}>
          {initials(player.name)}
        </div>

        {/* Name */}
        <span style={{
          fontSize: '10px', fontWeight: 700, color: isMe ? '#a5b4fc' : isCurrentTurn ? '#fde68a' : '#d1d5db',
          maxWidth: '66px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          lineHeight: 1.1,
        }}>
          {player.name}{isAI ? ' 🤖' : ''}
        </span>

        {/* Stack */}
        <span style={{
          fontSize: '12px', fontWeight: 900, lineHeight: 1.2,
          color: player.stack <= 0 ? '#f87171' : player.stack < 200 ? '#fb923c' : '#4ade80',
        }}>
          ${fmtStack(player.stack)}
        </span>

        {/* Status badges */}
        {isFolded  && <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', background: 'rgba(55,65,81,0.8)', color: '#9ca3af', fontWeight: 700 }}>FOLD</span>}
        {isAllIn   && <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', background: 'rgba(146,64,14,0.8)', color: '#fde68a', fontWeight: 700 }}>ALL-IN</span>}
        {isSitting && <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', background: 'rgba(55,65,81,0.7)', color: '#9ca3af', fontWeight: 700 }}>AWAY</span>}
        {isElim    && <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', background: 'rgba(127,29,29,0.8)', color: '#fca5a5', fontWeight: 700 }}>BUST</span>}

        {/* Current bet contribution */}
        {potContrib > 0 && !isFolded && (
          <span style={{ fontSize: '9px', color: '#fcd34d', fontWeight: 700 }}>+${potContrib.toLocaleString()}</span>
        )}

        {/* Winner amount */}
        {isWinner && wonAmount > 0 && (
          <span className="animate-bounce" style={{ fontSize: '9px', color: '#4ade80', fontWeight: 900 }}>
            +${wonAmount.toLocaleString()}
          </span>
        )}

        {/* Low stack warning */}
        {!isElim && !isFolded && player.stack > 0 && player.stack <= gameState_bigBlind_placeholder * 5 && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316',
            position: 'absolute', top: '-3px', left: '-3px', animation: 'glow 1s ease-in-out infinite' }} />
        )}
      </div>
    </div>
  );
};

// Placeholder — the actual bigBlind is passed via gameState in PokerTable
const gameState_bigBlind_placeholder = 20;

export default PlayerSeat;
