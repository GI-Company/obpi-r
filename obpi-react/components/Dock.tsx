
import React, { useState, useEffect } from 'react';
import { useOS } from '../contexts/OSContext';
import { WindowInstance } from '../types';

const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div className="text-xs text-center text-gray-800 dark:text-white px-2 font-semibold">
            <div>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="opacity-70">{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
        </div>
    );
};


const Dock: React.FC<{ onAppDrawerOpen: () => void }> = ({ onAppDrawerOpen }) => {
  const { windows, focusWindow } = useOS();

  const handleIconClick = (win: WindowInstance) => {
    focusWindow(win.id);
  };
  
  const handleAppDrawerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAppDrawerOpen();
  };

  const runningApps = windows.filter(win => !win.isMinimized);
  const minimizedApps = windows.filter(win => win.isMinimized);
  const appIcons = [...runningApps, ...minimizedApps];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[10000] flex justify-center">
      <div 
        className="flex items-end h-[56px] p-2 space-x-2 bg-glass-light/80 dark:bg-glass-dark/80 backdrop-blur-xl border border-glass-border-light dark:border-glass-border-dark rounded-2xl shadow-lg"
      >
        <button 
          onClick={handleAppDrawerClick}
          className="group w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white/20 dark:bg-black/20 rounded-lg hover:bg-white/40 dark:hover:bg-black/40 transition-transform duration-150 ease-in-out hover:scale-110"
          title="All Apps"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-gray-800 dark:text-white">
            <path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/>
          </svg>
        </button>
        <div className="w-px h-10 bg-white/30 dark:bg-black/30 rounded-full" />
        
        {appIcons.map(win => (
          <div key={win.id} className="relative flex flex-col items-center">
            <button
              onClick={() => handleIconClick(win)}
              className="w-12 h-12 text-3xl flex-shrink-0 flex items-center justify-center transition-transform duration-150 ease-in-out hover:scale-110"
              title={win.title}
            >
              {win.icon}
            </button>
            <div className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${win.isFocused ? 'bg-obpi-accent' : 'bg-gray-500 dark:bg-gray-400'}`} />
          </div>
        ))}
        {appIcons.length > 0 && <div className="w-px h-10 bg-white/30 dark:bg-black/30 rounded-full" />}
        <Clock />
      </div>
    </div>
  );
};

export default Dock;
