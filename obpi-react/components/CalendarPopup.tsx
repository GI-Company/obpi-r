import React from 'react';
import { TASKBAR_HEIGHT } from '../constants';

interface CalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  openApp: () => void;
}

const CalendarPopup: React.FC<CalendarPopupProps> = ({ isOpen, onClose, openApp }) => {
    if (!isOpen) return null;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = today.toLocaleString('default', { month: 'long' });
    const dayName = today.toLocaleString('default', { weekday: 'long' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const calendarDays = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(<div key={`empty-${i}`}></div>);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate();
        calendarDays.push(
            <div key={day} className={`w-8 h-8 flex items-center justify-center text-sm rounded-full ${isToday ? 'bg-obpi-accent text-white' : ''}`}>
                {day}
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[9999]"
            onClick={onClose}
        >
            <div
                style={{ bottom: `${TASKBAR_HEIGHT + 4}px` }}
                className="absolute right-2 w-[280px] bg-glass-light/80 dark:bg-glass-dark/80 backdrop-blur-xl border border-glass-border-light dark:border-glass-border-dark rounded-lg shadow-lg flex flex-col animate-fade-in-fast text-gray-800 dark:text-white"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-glass-border-light dark:border-glass-border-dark">
                    <p className="font-semibold">{dayName}, {monthName} {today.getDate()}</p>
                    <p className="text-xs opacity-70">{year}</p>
                </div>

                {/* Calendar Grid */}
                <div className="p-3">
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-2">
                        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {calendarDays}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-glass-border-light dark:border-glass-border-dark text-center">
                    <button
                        onClick={openApp}
                        className="text-sm text-obpi-accent hover:underline"
                    >
                        Open Calendar App
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalendarPopup;
