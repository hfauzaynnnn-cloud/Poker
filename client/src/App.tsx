import { useEffect, useState } from 'react';
import { usePokerStore } from './store/pokerStore';
import MenuScreen from './screens/MenuScreen';
import GameScreen from './screens/GameScreen';
import { ToastProvider } from './components/Toast';
import { unlockAudio } from './services/SoundManager';

const SUITS = ['♠', '♥', '♦', '♣'];

function WakeUpScreen() {
  const [dots, setDots] = useState('');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? '' : p + '.'), 500);
    const s = setInterval(() => setSeconds(p => p + 1), 1000);
    return () => { clearInterval(d); clearInterval(s); };
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '24px',
      background: 'radial-gradient(ellipse at 30% 20%, #0d2a0d 0%, #050c05 60%)',
    }}>
      {/* Animated suits */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {SUITS.map((s, i) => (
          <div key={i} className="suit-ambient" style={{
            position: 'absolute',
            fontSize: `${9 + i * 3}rem`,
            color: 'rgba(74,222,128,0.06)',
            top: `${[10,60,5,70][i]}%`,
            left: `${[5,75,60,15][i]}%`,
            animationDelay: `${i * 5}s`,
            animationDuration: `${20 + i * 8}s`,
          }}>{s}</div>
        ))}
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '5rem', filter: 'drop-shadow(0 0 30px rgba(74,222,128,0.4))' }}
          className="animate-float">🃏</div>
        <h1 style={{
          fontSize: '3rem', fontWeight: 900, margin: '8px 0 4px',
          background: 'linear-gradient(135deg,#4ade80,#facc15,#f97316)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px',
        }}>POKER</h1>
        <p style={{ color: 'rgba(74,222,128,0.6)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          No-Limit Texas Hold'em
        </p>
      </div>

      {/* Spinner + status */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 1 }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          border: '3px solid rgba(74,222,128,0.15)',
          borderTopColor: '#4ade80',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 600 }}>
          Warming up server{dots}
        </p>
        <p style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
          Debug URL: {import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}
        </p>
        {seconds >= 5 && (
          <p style={{ color: '#4b5563', fontSize: '12px', maxWidth: '260px', textAlign: 'center', lineHeight: 1.5 }}>
            Free server wakes up after idle — usually ready in ~20s
          </p>
        )}
        {seconds >= 15 && (
          <p style={{ color: '#374151', fontSize: '11px' }}>({seconds}s elapsed)</p>
        )}
      </div>
    </div>
  );
}

function App() {
  const { connect, roomId, connected } = usePokerStore();
  const [showWakeUp, setShowWakeUp] = useState(false);

  useEffect(() => {
    connect();
    // Show wake-up screen only if we haven't connected after 2s
    const t = setTimeout(() => {
      if (!usePokerStore.getState().connected) setShowWakeUp(true);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (connected) setShowWakeUp(false);
  }, [connected]);

  return (
    <ToastProvider>
      <div
        className="min-h-screen text-white landscape-wrapper"
        style={{ fontFamily: "'Inter','Segoe UI',sans-serif" }}
        onPointerDown={unlockAudio}
      >
        <div id="portrait-warning" className="fixed inset-0 z-[99999] flex-col items-center justify-center hidden bg-black/90 backdrop-blur-xl">
          <div className="rotate-icon text-5xl mb-6 opacity-80" style={{ animation: 'spin-phone 1.5s infinite ease-in-out alternate' }}>📱</div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-wide">♣ Rotate Device ♣</h2>
          <p className="text-gray-400 text-sm max-w-[260px] text-center font-medium leading-relaxed">
            Texas Hold'em requires a landscape screen to perfectly fit 10 players.
          </p>
        </div>

        <div className="game-content h-[100dvh]">
          {showWakeUp && !connected ? (
            <WakeUpScreen />
          ) : roomId ? (
            <GameScreen />
          ) : (
            <MenuScreen />
          )}
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;
