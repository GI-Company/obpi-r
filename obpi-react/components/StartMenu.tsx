import React, { useState } from 'react';
import { useOS } from '../contexts/OSContext';
import { APPS } from '../constants';
import { TASKBAR_HEIGHT } from '../constants';
import { AppId } from '../types';

interface StartMenuProps {
  isOpen: boolean;
  closeMenu: () => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, closeMenu }) => {
  const { openWindow, currentUser, lock, logout, showContextMenu, pinApp, unpinApp, pinnedApps, googleUser } = useOS();
  const [searchTerm, setSearchTerm] = useState('');

  const handleAppClick = (appId: AppId) => {
    openWindow(appId);
    closeMenu();
  };
  
  const handleContextMenu = (e: React.MouseEvent, appId: AppId) => {
    e.preventDefault();
    e.stopPropagation();
    const isPinned = pinnedApps.includes(appId);

    showContextMenu(e.clientX, e.clientY, [
        { label: 'Open', icon: '📂', action: () => handleAppClick(appId) },
        { 
            label: isPinned ? 'Unpin from Taskbar' : 'Pin to Taskbar', 
            icon: '📌', 
            action: () => {
                isPinned ? unpinApp(appId) : pinApp(appId);
                closeMenu();
            }
        }
    ]);
  };

  const filteredApps = APPS.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
        data-testid="start-menu-backdrop"
        className="fixed inset-0 z-[9999]"
        onClick={closeMenu} 
    >
      <div 
        style={{ bottom: `${TASKBAR_HEIGHT + 4}px` }}
        className="absolute left-2 w-[450px] max-w-[95vw] h-[500px] max-h-[70vh] bg-glass-light/80 dark:bg-glass-dark/80 backdrop-blur-xl border border-glass-border-light dark:border-glass-border-dark rounded-lg shadow-lg flex flex-col animate-fade-in-fast"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 flex-shrink-0">
            <input
                type="text"
                placeholder="Type here to search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-2 bg-white/20 dark:bg-black/20 text-gray-800 dark:text-white rounded border border-white/30 placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-obpi-accent"
            />
        </div>
        
        <div className="flex-grow p-4 pt-0 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">All Apps</h3>
            <div className="grid grid-cols-1 gap-1">
                {filteredApps.map(app => (
                    <button
                        key={app.id}
                        onClick={() => handleAppClick(app.id)}
                        onContextMenu={(e) => handleContextMenu(e, app.id)}
                        className="flex items-center gap-3 p-2 text-gray-800 dark:text-white rounded hover:bg-white/20"
                        title={app.name}
                    >
                        <span className="text-2xl">{app.icon}</span>
                        <span className="text-sm">{app.name}</span>
                    </button>
                ))}
            </div>
        </div>
        
        {/* User Profile / Session Control */}
        {currentUser && (
             <div className="flex-shrink-0 p-2 border-t border-glass-border-light dark:border-glass-border-dark flex items-center justify-between bg-white/10 dark:bg-black/10">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-white/20 w-full">
                    <img src={googleUser?.picture || currentUser.avatar} alt="user avatar" className="w-8 h-8 rounded-full" />
                    <span className="text-gray-800 dark:text-white font-semibold text-sm">{googleUser?.name || currentUser.username}</span>
                </div>
                <div className="flex items-center">
                    <button onClick={lock} title="Lock Session" className="p-2 rounded hover:bg-white/20 text-gray-800 dark:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </button>
                     <button onClick={logout} title="Logout" className="p-2 rounded hover:bg-white/20 text-gray-800 dark:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StartMenu;