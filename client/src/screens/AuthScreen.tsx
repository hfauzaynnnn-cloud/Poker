import React, { useState } from 'react';
import { usePokerStore } from '../store/pokerStore';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setAuth = usePokerStore(s => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');

      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-50 overflow-y-auto"
      style={{
        background: 'radial-gradient(circle at center, #0a1f0a 0%, #050c05 100%)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6 p-8 rounded-[32px] animate-slide-up"
        style={{
          background: 'linear-gradient(145deg, rgba(30,60,30,0.4), rgba(10,30,10,0.6))',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          border: '1px solid rgba(74,222,128,0.2)',
        }}
      >
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.5))' }}>🃏</div>
          <h1 className="text-3xl font-black tracking-tight" style={{
            background: 'linear-gradient(135deg, #4ade80 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Texas Hold'em
          </h1>
          <p className="text-gray-400 font-medium mt-2 text-sm">
            {isLogin ? 'Log in to join the tables.' : 'Create an account to claim your 1000 chips!'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-900/50 border border-red-500/30 text-red-200 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={loading}
            className="w-full bg-[#050c05]/80 placeholder:text-gray-600 outline-none p-4 rounded-2xl text-white font-medium focus:ring-2 focus:ring-[#4ade80]/50 transition-all border border-[#1a3a1a]"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            className="w-full bg-[#050c05]/80 placeholder:text-gray-600 outline-none p-4 rounded-2xl text-white font-medium focus:ring-2 focus:ring-[#4ade80]/50 transition-all border border-[#1a3a1a]"
          />

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-4 rounded-2xl text-white font-black uppercase tracking-wider disabled:opacity-50 transition-all active:scale-[0.98] mt-2"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none' }}
          >
            {loading ? 'Authenticating...' : (isLogin ? 'Enter Casino' : 'Claim Chips')}
          </button>
        </form>

        <div className="text-center mt-2">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); setUsername(''); setPassword(''); }}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors text-sm font-medium underline underline-offset-4"
          >
            {isLogin ? "Need chips? Create an account!" : "Already have an account? Log in."}
          </button>
        </div>
      </div>
    </div>
  );
};
