import React, { useState, useCallback } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/Splash/SplashScreen';
import { API_BASE } from './src/utils/helpers';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [renderMain, setRenderMain] = useState(false);

  const startFetch = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/bus_info`);
      await res.json();
    } catch (e) {
      console.log('초기 데이터 로드 실패:', e);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    setTimeout(() => setRenderMain(true), 300);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen
          startFetch={startFetch}
          minDuration={1200}
          onFinish={handleSplashFinish}
        />
      )}
      {renderMain && <AppNavigator />}
    </>
  );
}
