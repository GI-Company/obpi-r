

import React, { useEffect, useState } from 'react';
import { OSProvider, useOS } from './contexts/OSContext';
import Desktop from './components/Desktop';
import ContextMenu from './components/ContextMenu';
import Modal from './components/Modal';
import WebGLBackground from './components/WebGLBackground';
import Taskbar from './components/Taskbar';
import StartMenu from './components/StartMenu';
import DragLayer from './components/DragLayer';
import LoginScreen from './components/LoginScreen';
import NotificationCenter from './components/NotificationCenter';
import SystemInitializer from './components/SystemInitializer';
import QuickSettings from './components/QuickSettings';
import InvertedCursor from './components/InvertedCursor';
import { ContextMenuItem } from './types';

const ThemedApp: React.FC = () => {
  const { theme, showContextMenu, hideContextMenu, wallpaper, endDrag, openWindow, volume, brightness } = useOS();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  
  // Mobile viewport height fix
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;

    if (isTextInput || hasSelection) {
        e.preventDefault();
        e.stopPropagation();
        const items: ContextMenuItem[] = [];

        if (hasSelection) {
            items.push({
                label: 'Copy',
                icon: '📄',
                action: () => document.execCommand('copy'),
            });
        }
        if (isTextInput) {
            if (items.length > 0) items.push({ separator: true });
            items.push({
                label: 'Select All',
                icon: '📝',
                action: () => {
                    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                        target.select();
                    }
                },
            });
        }
        
        if (items.length > 0) {
            showContextMenu(e.clientX, e.clientY, items);
        }
    }
  };


  return (
    <main 
      className={`w-screen h-screen overflow-hidden ${theme}`}
      // FIX: Removed invalid 'sound' CSS property.
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
      onClick={() => {
        hideContextMenu();
        if (isStartMenuOpen) setIsStartMenuOpen(false);
        if (isQuickSettingsOpen) setIsQuickSettingsOpen(false);
      }}
      onContextMenu={handleGlobalContextMenu}
      onDragEnd={endDrag}
      onDrop={endDrag}
    >
      {/* Background Layers */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <WebGLBackground />
      
      {/* UI Layers */}
      <div 
        className="relative z-0 w-full h-full transition-all"
        style={{ filter: `brightness(${brightness})` }}
      >
        <Desktop />
        <StartMenu isOpen={isStartMenuOpen} closeMenu={() => setIsStartMenuOpen(false)} />
        <QuickSettings
            isOpen={isQuickSettingsOpen}
            onClose={() => setIsQuickSettingsOpen(false)}
            openCalendarApp={() => {
                openWindow('calendar');
                setIsQuickSettingsOpen(false);
            }}
        />
        <Taskbar
            onStartClick={() => setIsStartMenuOpen(prev => !prev)}
            onClockClick={() => setIsQuickSettingsOpen(prev => !prev)}
        />
        <NotificationCenter />
        <ContextMenu />
        <Modal />
        <DragLayer />
      </div>
      <audio id="global-audio-output" hidden />
    </main>
  );
}

const AppContent: React.FC = () => {
    const { isLoggedIn, isInitialized, volume } = useOS();
    
    useEffect(() => {
        const audioEl = document.getElementById('global-audio-output') as HTMLAudioElement;
        if (audioEl) {
            audioEl.volume = volume;
        }
    }, [volume]);

    if (!isInitialized) {
      // This state should not be reachable if SystemInitializer works correctly,
      // but serves as a fallback.
      return <div className="w-screen h-screen bg-obpi-dark-bg flex items-center justify-center font-mono text-gray-300">Loading...</div>;
    }

    if (!isLoggedIn) {
        return <LoginScreen />;
    }

    return <ThemedApp />;
};

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);

  return (
    <OSProvider>
        {isBooting ? (
            <SystemInitializer onInitialized={() => setIsBooting(false)} />
        ) : (
            <>
                <InvertedCursor />
                <AppContent />
            </>
        )}
    </OSProvider>
  );
};

export default App;