import React from 'react';
import type { GameState } from '../types';
import CardComponent from './CardComponent';
import PlayerSeat from './PlayerSeat';

interface PokerTableProps {
  gameState: GameState;
  myPlayerId: string | null;
}

function getSeatPositions(totalSeats: number): { x: number; y: number }[] {
  if (totalSeats === 2) return [{ x: 50, y: 84 }, { x: 50, y: 16 }];
  if (totalSeats === 3) return [{ x: 50, y: 84 }, { x: 16, y: 26 }, { x: 84, y: 26 }];
  if (totalSeats === 4) return [{ x: 50, y: 84 }, { x: 10, y: 50 }, { x: 50, y: 14 }, { x: 90, y: 50 }];
  if (totalSeats === 5) return [
    { x: 50, y: 85 }, { x: 14, y: 65 }, { x: 18, y: 22 }, { x: 82, y: 22 }, { x: 86, y: 65 },
  ];
  if (totalSeats === 6) return [
    { x: 50, y: 86 }, { x: 14, y: 68 }, { x: 14, y: 28 }, { x: 50, y: 12 }, { x: 86, y: 28 }, { x: 86, y: 68 },
  ];
  // 7-9: use ellipse
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < totalSeats; i++) {
    const angle = (i / totalSeats) * 2 * Math.PI + Math.PI / 2;
    positions.push({ x: 50 + 40 * Math.cos(angle), y: 50 + 34 * Math.sin(angle) });
  }
  return positions;
}

const STREET_LABEL: Record<string, string> = {
  preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River',
  showdown: 'Showdown', finished: '',
};

function chipStack(total: number, bb: number) {
  const n = Math.min(6, Math.max(1, Math.ceil(total / (bb * 5))));
  const colors = ['#FFD700','#C0C0C0','#FF6B6B','#4ECDC4','#45B7D1','#96E6A1'];
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="w-2.5 sm:w-3 rounded-full"
          style={{ height: `${7 + (i % 3) * 2}px`, background: colors[i % colors.length], boxShadow: `0 1px 3px rgba(0,0,0,0.5)` }} />
      ))}
    </div>
  );
}

export const PokerTable: React.FC<PokerTableProps> = ({ gameState, myPlayerId }) => {
  const positions = getSeatPositions(gameState.players.length);
  const totalPot = gameState.pots.reduce((s, p) => s + p.amount, 0) +
    gameState.players.reduce((s, p) => s + p.roundContributed, 0);
  const isShowdown = gameState.phase === 'hand_over' && gameState.showdownResult !== null;
  const showStreet = gameState.phase === 'playing' && gameState.street !== 'finished';

  return (
    // Responsive aspect ratio: taller on mobile, more compact on desktop
    <div className="relative w-full" style={{ paddingBottom: 'min(58%, 340px)' }}>

      {/* Table surface */}
      <div className="absolute inset-x-2 inset-y-1 rounded-[50%] overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 40% 30%, #175c2a 0%, #0e3d1a 45%, #082c12 100%)',
          boxShadow: [
            'inset 0 0 60px rgba(0,0,0,0.7)',
            '0 0 0 6px #3d1e06',
            '0 0 0 10px #2a1403',
            '0 0 0 14px #1a0d02',
            '0 6px 30px rgba(0,0,0,0.9)',
          ].join(', '),
          border: '2px solid #5a3008',
        }}>

        {/* Felt texture */}
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '6px 6px' }} />

        {/* Center logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 text-5xl sm:text-7xl text-white font-black select-none">♠</div>

        {/* Street label */}
        {showStreet && (
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 text-green-300/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
            {STREET_LABEL[gameState.street]}
          </div>
        )}

        {/* Community Cards */}
        <div className="absolute top-[24%] left-1/2 -translate-x-1/2 flex gap-1 sm:gap-1.5 items-center">
          {gameState.communityCards.map((card, i) => (
            <div key={i} style={{ animation: `fadeIn 0.3s ease-out ${i * 60}ms both` }}>
              <CardComponent card={card} size="sm" />
            </div>
          ))}
          {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
            <div key={`ph-${i}`} className="w-8 h-12 sm:w-10 sm:h-14 rounded"
              style={{ border: '1px dashed rgba(74,222,128,0.12)', background: 'rgba(0,0,0,0.12)' }} />
          ))}
        </div>

        {/* Pot display */}
        {totalPot > 0 && (
          <div className="absolute top-[51%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            {chipStack(totalPot, gameState.settings.bigBlind)}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <span className="text-yellow-400 text-xs">💰</span>
              <span className="text-yellow-300 font-black text-xs sm:text-sm">${totalPot.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Winner banner */}
        {gameState.winnerText && gameState.phase === 'hand_over' && (
          <div className="absolute top-[64%] left-1/2 -translate-x-1/2 w-[85%] text-center z-10">
            <div className="inline-block px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm"
              style={{ background: 'rgba(133,77,14,0.9)', border: '1px solid rgba(250,204,21,0.5)', boxShadow: '0 0 16px rgba(250,204,21,0.15)' }}>
              🏆 {gameState.winnerText}
            </div>
          </div>
        )}
      </div>

      {/* Player Seats */}
      {gameState.players.map((player, i) => {
        const pos = positions[i] ?? { x: 50, y: 50 };
        return (
          <PlayerSeat
            key={player.id}
            player={player}
            isCurrentTurn={gameState.actionSeat === player.seat && gameState.phase === 'playing'}
            isMe={player.id === myPlayerId}
            buttonSeat={gameState.buttonSeat}
            showCards={isShowdown || player.id === myPlayerId}
            potContrib={player.roundContributed}
            totalContrib={player.totalContributed}
            x={pos.x}
            y={pos.y}
            showdownResult={gameState.showdownResult}
          />
        );
      })}
    </div>
  );
};

export default PokerTable;
