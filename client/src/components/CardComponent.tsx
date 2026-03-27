import React from 'react';
import type { CardData } from '../types';

interface CardProps {
  card: CardData | '??' | null;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  className?: string;
}

const RANK_LABELS: Record<number, string> = {
  2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9',
  10:'T', 11:'J', 12:'Q', 13:'K', 14:'A',
};

const SUIT_SYMBOLS: Record<string, string> = {
  c: '♣', d: '♦', h: '♥', s: '♠',
};

// Colorblind-friendly: red suits use red, black suits use dark charcoal
const SUIT_COLORS: Record<string, { primary: string; secondary: string }> = {
  c: { primary: '#1a1a2e', secondary: '#16213e' },   // Clubs: deep navy-black
  d: { primary: '#dc2626', secondary: '#991b1b' },   // Diamonds: red
  h: { primary: '#e11d48', secondary: '#be185d' },   // Hearts: crimson
  s: { primary: '#0f172a', secondary: '#1e293b' },   // Spades: near-black
};

const SIZE_DIMS = {
  sm: { w: 'w-8',  h: 'h-12',  text: 'text-[9px]', suit: 'text-xs',   round: 'rounded' },
  md: { w: 'w-12', h: 'h-17',  text: 'text-xs',    suit: 'text-lg',   round: 'rounded-md' },
  lg: { w: 'w-16', h: 'h-24',  text: 'text-base',  suit: 'text-3xl',  round: 'rounded-lg' },
};

// Card back pattern
const CardBack: React.FC<{ size: 'sm' | 'md' | 'lg'; className?: string }> = ({ size, className = '' }) => {
  const { w, h, round } = SIZE_DIMS[size];
  return (
    <div className={`${w} ${h} ${round} ${className} overflow-hidden flex-shrink-0`}
      style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2035 50%, #1e3a5f 100%)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
      }}>
      <div className="w-full h-full"
        style={{
          background: 'repeating-linear-gradient(45deg, #1a3558 0px, #1a3558 2px, #0f2035 2px, #0f2035 8px)',
          borderRadius: 'inherit',
        }} />
    </div>
  );
};

export const CardComponent: React.FC<CardProps> = ({ card, size = 'md', faceDown, className = '' }) => {
  const { w, h, text, suit: suitClass, round } = SIZE_DIMS[size];

  if (faceDown || !card) {
    return <CardBack size={size} className={className} />;
  }

  if (card === '??') {
    return <CardBack size={size} className={className} />;
  }

  const rankLabel = RANK_LABELS[card.rank] ?? '?';
  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? '?';
  const colors = SUIT_COLORS[card.suit] ?? { primary: '#111', secondary: '#222' };

  return (
    <div
      className={`${w} ${h} ${round} ${className} flex flex-col justify-between p-0.5 select-none font-bold flex-shrink-0 overflow-hidden`}
      style={{
        background: 'linear-gradient(145deg, #ffffff, #f5f5f5)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.08)',
      }}
    >
      {/* Top-left corner */}
      <div className="flex flex-col items-start leading-none" style={{ color: colors.primary }}>
        <span className={`${text} font-black leading-none`}>{rankLabel}</span>
        <span className="text-[0.6em] leading-none">{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <div className={`flex justify-center items-center ${suitClass} leading-none`}
        style={{ color: colors.primary }}>
        {suitSymbol}
      </div>

      {/* Bottom-right corner (rotated) */}
      <div className="flex flex-col items-end leading-none rotate-180" style={{ color: colors.primary }}>
        <span className={`${text} font-black leading-none`}>{rankLabel}</span>
        <span className="text-[0.6em] leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
};

export default CardComponent;
