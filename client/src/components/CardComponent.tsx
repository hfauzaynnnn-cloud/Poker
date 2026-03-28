import React from 'react';
import type { CardData } from '../types';

interface CardProps {
  card: CardData | '??' | null;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  className?: string;
  dealt?: boolean;   // triggers deal animation
  delay?: number;    // animation delay in ms
}

const RANK_LABELS: Record<number, string> = {
  2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'T',11:'J',12:'Q',13:'K',14:'A',
};

const SUIT_SYMBOLS: Record<string, string> = { c:'♣', d:'♦', h:'♥', s:'♠' };

const SUIT_COLORS: Record<string, { primary: string; gradient: string }> = {
  c: { primary: '#111827', gradient: 'linear-gradient(160deg,#1f2937,#111827)' },
  d: { primary: '#dc2626', gradient: 'linear-gradient(160deg,#ef4444,#b91c1c)' },
  h: { primary: '#e11d48', gradient: 'linear-gradient(160deg,#f43f5e,#be185d)' },
  s: { primary: '#0f172a', gradient: 'linear-gradient(160deg,#1e293b,#0f172a)' },
};

const SIZE_DIMS = {
  sm: { w: 32,  h: 46,  rank: '9px',  suit: '12px', corner: '8px',  radius: '4px'  },
  md: { w: 46,  h: 66,  rank: '11px', suit: '18px', corner: '10px', radius: '6px'  },
  lg: { w: 62,  h: 90,  rank: '15px', suit: '28px', corner: '13px', radius: '8px'  },
};

const CardBack: React.FC<{ size: 'sm'|'md'|'lg'; dealt?: boolean; delay?: number; className?: string }> = ({
  size, dealt, delay = 0, className = ''
}) => {
  const { w, h, radius } = SIZE_DIMS[size];
  return (
    <div
      className={className}
      style={{
        width: w, height: h, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
        background: 'linear-gradient(135deg,#1e3a5f 0%,#0f2035 50%,#1e3a5f 100%)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1)',
        animation: dealt ? `cardDeal 0.38s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both` : undefined,
      }}
    >
      <div style={{
        width: '100%', height: '100%', borderRadius: radius,
        backgroundImage: 'repeating-linear-gradient(45deg,#1a3558 0px,#1a3558 2px,#0f2035 2px,#0f2035 8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size === 'sm' ? '14px' : size === 'md' ? '20px' : '26px', color: 'rgba(255,255,255,0.08)' }}>🂠</span>
      </div>
    </div>
  );
};

export const CardComponent: React.FC<CardProps> = ({
  card, size = 'md', faceDown, className = '', dealt, delay = 0,
}) => {
  const { w, h, rank: rankSize, suit: suitSize, radius } = SIZE_DIMS[size];

  if (faceDown || !card || card === '??') {
    return <CardBack size={size} dealt={dealt} delay={delay} className={className} />;
  }

  const rankLabel  = RANK_LABELS[card.rank] ?? '?';
  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? '?';
  const colors     = SUIT_COLORS[card.suit] ?? { primary: '#111', gradient: '#111' };
  const isRed      = card.suit === 'd' || card.suit === 'h';

  return (
    <div
      className={className}
      style={{
        width: w, height: h, borderRadius: radius, flexShrink: 0,
        backgroundColor: '#fff',
        background: 'linear-gradient(160deg,#ffffff 0%,#f8fafc 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '2px 3px',
        userSelect: 'none', overflow: 'hidden',
        animation: dealt ? `cardDeal 0.38s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both` : undefined,
        position: 'relative',
      }}
    >
      {/* Subtle color tint at top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '40%', height: '40%',
        background: isRed ? 'rgba(220,38,38,0.04)' : 'rgba(0,0,0,0.02)',
        pointerEvents: 'none',
      }} />

      {/* Top-left corner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1, color: colors.primary }}>
        <span style={{ fontSize: rankSize, fontWeight: 900, lineHeight: 1 }}>{rankLabel}</span>
        <span style={{ fontSize: `calc(${rankSize} * 0.85)`, lineHeight: 1 }}>{suitSymbol}</span>
      </div>

      {/* Center suit — larger */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: suitSize, lineHeight: 1, color: colors.primary,
        textShadow: isRed ? '0 1px 4px rgba(220,38,38,0.2)' : '0 1px 4px rgba(0,0,0,0.15)',
      }}>
        {suitSymbol}
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        lineHeight: 1, transform: 'rotate(180deg)', color: colors.primary,
      }}>
        <span style={{ fontSize: rankSize, fontWeight: 900, lineHeight: 1 }}>{rankLabel}</span>
        <span style={{ fontSize: `calc(${rankSize} * 0.85)`, lineHeight: 1 }}>{suitSymbol}</span>
      </div>
    </div>
  );
};

export default CardComponent;
