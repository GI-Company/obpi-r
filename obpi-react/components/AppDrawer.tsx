
import React, { useState } from 'react';
import { useOS } from '../contexts/OSContext';
import { APPS } from '../constants';

interface AppDrawerProps {
  isOpen: boolean;
  closeDrawer: () => void;
}

const AppDrawer: React.FC<AppDrawerProps> = ({ isOpen, closeDrawer }) => {
  const { openWindow, currentUser, lock, logout } = useOS();
  const [searchTerm, setSearchTerm] = useState('');

  const handleAppClick = (appId: string) => {
    openWindow(appId);
    closeDrawer();
  };
  
  const filteredApps = APPS.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xl animate-fade-in-fast"
        onClick={closeDrawer} 
    >
      <div 
        className="absolute inset-x-0 bottom-0 top-16 sm:top-auto sm:bottom-20 p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto flex flex-col h-full">
            <input
                type="text"
                placeholder="Search for apps..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-3 mb-6 bg-white/20 dark:bg-black/20 text-white rounded-lg border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-obpi-accent"
            />
            <div className="flex-grow grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 overflow-y-auto">
                {filteredApps.map(app => (
                <button
                    key={app.id}
                    onClick={() => handleAppClick(app.id)}
                    className="flex flex-col items-center gap-2 p-2 text-white rounded-lg hover:bg-white/10"
                    title={app.name}
                >
                    <span className="text-4xl">{app.icon}</span>
                    <span className="text-xs text-center break-words">{app.name}</span>
                </button>
                ))}
            </div>
            
            {/* User Profile / Session Control */}
            {currentUser && (
                 <div className="flex-shrink-0 mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={currentUser.avatar} alt="user avatar" className="w-10 h-10 rounded-full" />
                        <span className="text-white font-semibold">{currentUser.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={lock} title="Lock Session" className="p-2 rounded-lg hover:bg-white/10 text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </button>
                         <button onClick={logout} title="Logout" className="p-2 rounded-lg hover:bg-white/10 text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AppDrawer;