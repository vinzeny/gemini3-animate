import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SceneManager } from './services/particleEffects';
import Controls from './components/Controls';
import { EffectType, EffectConfig } from './types';
import { getEffectExplanation } from './services/geminiService';

const DEFAULT_CONFIG: EffectConfig = {
  count: 10000,
  size: 0.5,
  speed: 1.0,
  color: '#ff88cc'
};

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);
  
  const [activeEffect, setActiveEffect] = useState<EffectType>(EffectType.CREATIVE_HEART_FIREWORK);
  const [config, setConfig] = useState<EffectConfig>(DEFAULT_CONFIG);
  const [explanation, setExplanation] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new SceneManager(containerRef.current);
    managerRef.current = manager;

    // Initial effect
    manager.setEffect(activeEffect, config);

    return () => {
      manager.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Handle Updates
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setEffect(activeEffect, config);
    }
  }, [activeEffect, config]);

  // Handle AI Explanation
  useEffect(() => {
    let isMounted = true;
    const fetchExplanation = async () => {
      setIsLoading(true);
      const text = await getEffectExplanation(activeEffect);
      if (isMounted) {
        setExplanation(text);
        setIsLoading(false);
      }
    };
    
    fetchExplanation();

    return () => {
      isMounted = false;
    };
  }, [activeEffect]);

  const handleConfigChange = useCallback((newConfig: Partial<EffectConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleHandStateChange = useCallback((isFist: boolean) => {
    if (managerRef.current) {
      managerRef.current.updateHandState(isFist);
    }
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Open Controls Button (Visible when sidebar is closed) */}
      <button 
        onClick={() => setShowControls(true)}
        className={`absolute top-4 left-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm transition-opacity duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        aria-label="打开设置"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sliding Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-20 w-full md:w-60 transform transition-transform duration-300 ease-in-out ${showControls ? 'translate-x-0' : '-translate-x-full'}`}>
         <Controls 
            activeEffect={activeEffect}
            config={config}
            onEffectChange={setActiveEffect}
            onConfigChange={handleConfigChange}
            explanation={explanation}
            isLoading={isLoading}
            onClose={() => setShowControls(false)}
            onHandStateChange={handleHandStateChange}
          />
      </div>

       {/* Overlay Text */}
      {!showControls && (
        <div className="absolute bottom-10 w-full text-center pointer-events-none">
             <p className="text-white/50 text-sm">点击左上角图标打开设置面板</p>
        </div>
      )}
    </div>
  );
};

export default App;