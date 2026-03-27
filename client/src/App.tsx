import { useEffect } from 'react';
import { usePokerStore } from './store/pokerStore';
import MenuScreen from './screens/MenuScreen';
import GameScreen from './screens/GameScreen';

function App() {
  const { connect, roomId } = usePokerStore();

  useEffect(() => {
    connect();
  }, []);

  return (
    <div className="min-h-screen text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {roomId ? <GameScreen /> : <MenuScreen />}
    </div>
  );
}

export default App;
