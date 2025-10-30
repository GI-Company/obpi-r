import React, { useMemo } from 'react';
import { useOS } from '../contexts/OSContext';
import { AppId, ContextMenuItem, WindowInstance } from '../types';
import { APPS } from '../constants';

interface TaskbarProps {
    onStartClick: () => void;
    onClockClick: () => void;
}

const Clock: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-xs text-center text-gray-800 dark:text-white px-2 font-semibold hover:bg-white/20 dark:hover:bg-white/10 rounded-md py-1 transition-colors"
            title="Open Calendar"
        >
            <div>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="opacity-70">{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
        </button>
    );
};

const Taskbar: React.FC<TaskbarProps> = ({ onStartClick, onClockClick }) => {
    const { windows, focusWindow, pinnedApps, openWindow, showContextMenu, unpinApp, pinApp, closeWindow } = useOS();

    const taskbarItems = useMemo(() => {
        const appIdsToShow = new Set([...pinnedApps, ...windows.map(w => w.appId)]);
        
        const items = Array.from(appIdsToShow).map(appId => {
            const appDef = APPS.find(app => app.id === appId);
            const runningWindows = windows.filter(w => w.appId === appId);
            const isRunning = runningWindows.length > 0;
            const isFocused = runningWindows.some(w => w.isFocused);
            
            const displayInfo = runningWindows.find(w => w.isFocused) || runningWindows[0] || appDef;
            
            return {
                appId,
                icon: displayInfo?.icon || '❓',
                // FIX: Use a type guard ('in' operator) to safely access property 'title' on WindowInstance or 'name' on AppDefinition.
                title: displayInfo ? ('title' in displayInfo ? displayInfo.title : displayInfo.name) : 'Unknown App',
                isRunning,
                isFocused,
                windowInstances: runningWindows
            };
        });

        items.sort((a, b) => {
            const aPinnedIndex = pinnedApps.indexOf(a.appId);
            const bPinnedIndex = pinnedApps.indexOf(b.appId);

            if (aPinnedIndex > -1 && bPinnedIndex > -1) return aPinnedIndex - bPinnedIndex;
            if (aPinnedIndex > -1) return -1;
            if (bPinnedIndex > -1) return 1;
            return a.title.localeCompare(b.title);
        });

        return items;
    }, [windows, pinnedApps]);

    const handleIconClick = (item: typeof taskbarItems[0]) => {
        if (item.isRunning) {
            const targetWindow = item.windowInstances.find(w => w.isFocused) || item.windowInstances[0];
            if (targetWindow) focusWindow(targetWindow.id);
        } else {
            openWindow(item.appId);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: typeof taskbarItems[0]) => {
        e.preventDefault();
        e.stopPropagation();

        const menuItems: ContextMenuItem[] = [];
        const isPinned = pinnedApps.includes(item.appId);

        if (!item.isRunning) {
             menuItems.push({ label: 'Open', icon: '📂', action: () => openWindow(item.appId) });
        }
        
        if (item.isRunning) {
            if (item.windowInstances.length === 1) {
                menuItems.push({ label: 'Close', icon: '❌', action: () => closeWindow(item.windowInstances[0].id) });
            } else {
                item.windowInstances.forEach(win => {
                    menuItems.push({ label: `Close "${win.title}"`, icon: '❌', action: () => closeWindow(win.id) });
                });
            }
        }

        if (isPinned) {
            menuItems.push({ label: 'Unpin from Taskbar', icon: '📌', action: () => unpinApp(item.appId) });
        } else {
             menuItems.push({ label: 'Pin to Taskbar', icon: '📌', action: () => pinApp(item.appId) });
        }

        showContextMenu(e.clientX, e.clientY, menuItems);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 h-12 bg-glass-light/80 dark:bg-glass-dark/80 backdrop-blur-xl border-t border-glass-border-light dark:border-glass-border-dark z-[10000] flex items-center px-2">
            <button
                onClick={(e) => { e.stopPropagation(); onStartClick(); }}
                className="h-9 w-9 flex items-center justify-center rounded hover:bg-white/20 dark:hover:bg-white/10"
                title="Start"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
            </button>
            <div className="w-px h-8 bg-white/30 dark:bg-black/30 rounded-full mx-2" />

            {/* Pinned & Running Apps */}
            <div className="flex-grow flex items-center gap-1">
                {taskbarItems.map(item => (
                    <button
                        key={item.appId}
                        onClick={() => handleIconClick(item)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                        className={`relative h-9 px-3 flex items-center gap-2 rounded transition-colors ${item.isFocused ? 'bg-white/30' : 'hover:bg-white/10'}`}
                        title={item.title}
                    >
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-xs hidden sm:inline truncate">{item.title}</span>
                        {item.isRunning && (
                            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-full transition-all ${item.isFocused ? 'w-4 bg-obpi-accent' : 'w-1 bg-gray-500'}`} />
                        )}
                    </button>
                ))}
            </div>

            <div className="w-px h-8 bg-white/30 dark:bg-black/30 rounded-full mx-2" />
            <Clock onClick={onClockClick} />
        </div>
    );
};

export default Taskbar;