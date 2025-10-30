import React from 'react';
import { useOS } from '../contexts/OSContext';
import { TASKBAR_HEIGHT } from '../constants';

interface QuickSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  openCalendarApp: () => void;
}

const QuickSettings: React.FC<QuickSettingsProps> = ({ isOpen, onClose, openCalendarApp }) => {
    const { volume, setVolume, brightness, setBrightness } = useOS();
    if (!isOpen) return null;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = today.toLocaleString('default', { month: 'long' });
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const calendarDays = Array(firstDayOfMonth).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

    return (
        <div className="fixed inset-0 z-[9999]" onClick={onClose}>
            <div
                style={{ bottom: `${TASKBAR_HEIGHT + 4}px` }}
                className="absolute right-2 w-[320px] bg-glass-light/80 dark:bg-glass-dark/80 backdrop-blur-xl border border-glass-border-light dark:border-glass-border-dark rounded-lg shadow-lg flex flex-col p-4 space-y-4 animate-quick-settings-in text-gray-800 dark:text-white"
                onClick={e => e.stopPropagation()}
            >
                {/* Volume and Brightness Controls */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🔊</span>
                        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-full" />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-lg">☀️</span>
                        <input type="range" min="0.5" max="1" step="0.01" value={brightness} onChange={e => setBrightness(parseFloat(e.target.value))} className="w-full" />
                    </div>
                </div>

                {/* Calendar */}
                <div className="p-2 bg-black/10 dark:bg-black/20 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">{monthName} {year}</h4>
                        <button onClick={openCalendarApp} className="text-xs text-obpi-accent hover:underline">Open App</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-1">
                        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                        {calendarDays.map((day, index) => (
                             <div key={index} className={`w-8 h-8 flex items-center justify-center rounded-full ${day === today.getDate() ? 'bg-obpi-accent text-white' : ''}`}>
                                {day}
                             </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickSettings;
