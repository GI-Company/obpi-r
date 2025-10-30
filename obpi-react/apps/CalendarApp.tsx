
import React, { useState, useEffect, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';
import { CalendarEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as geminiService from '../services/geminiService';

const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

const EventForm: React.FC<{ event?: CalendarEvent, date: string, onSave: (event: CalendarEvent) => void }> = ({ event, date, onSave }) => {
    const [title, setTitle] = useState(event?.title || '');
    const [time, setTime] = useState(event?.time || '');
    const [notes, setNotes] = useState(event?.notes || '');

    return (
        <div className="space-y-3 text-sm">
            <input id="event-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event Title" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" autoFocus />
            <input id="event-time" type="text" value={time} onChange={e => setTime(e.target.value)} placeholder="Time (e.g., 10:00 AM)" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
            <textarea id="event-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" rows={3}></textarea>
        </div>
    );
};

const CalendarApp: React.FC = () => {
    // FIX: Destructure async methods from useOS and remove vfs.
    const { showModal, showNotification, updateFs, currentUser, googleUser, createFile, writeFile, readFile, createDirectory, listDirectory } = useOS();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
    const [eventsPath, setEventsPath] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (currentUser) {
            const path = `/home/${currentUser.username}/Documents/calendar_events.json`;
            setEventsPath(path);
        }
    }, [currentUser]);

    // FIX: Made function async to support async file operations.
    const loadEvents = useCallback(async () => {
        if (!eventsPath) return;

        const docsDir = eventsPath.substring(0, eventsPath.lastIndexOf('/'));
        const rootDirFiles = await listDirectory(docsDir.substring(0, docsDir.lastIndexOf('/')));
        if (!rootDirFiles || !rootDirFiles['Documents']) {
            await createDirectory(docsDir);
        }

        const fileContent = await readFile(eventsPath);
        if (fileContent) {
            try {
                const contentString = fileContent instanceof Uint8Array ? new TextDecoder().decode(fileContent) : fileContent;
                setEvents(JSON.parse(contentString));
            } catch {
                setEvents({});
            }
        } else {
            // FIX: Replaced sync call with async context method.
            await createFile(eventsPath);
            await writeFile(eventsPath, JSON.stringify({}));
            setEvents({});
        }
    }, [eventsPath, listDirectory, createDirectory, readFile, createFile, writeFile]);

    useEffect(() => {
        if (eventsPath) {
            loadEvents();
        }
    }, [eventsPath, loadEvents]);

    // FIX: Made function async to support async file operations.
    const saveEvents = useCallback(async (updatedEvents: Record<string, CalendarEvent[]>) => {
        if (!eventsPath) return;
        // FIX: Replaced sync vfs.writeFile with async context method.
        await writeFile(eventsPath, JSON.stringify(updatedEvents, null, 2));
        setEvents(updatedEvents);
    }, [writeFile, eventsPath]);

    const handleAddOrUpdateEvent = (event: CalendarEvent) => {
        const newEvents = { ...events };
        const dateEvents = newEvents[event.date] ? [...newEvents[event.date]] : [];
        const existingIndex = dateEvents.findIndex(e => e.id === event.id);

        if (existingIndex > -1) {
            dateEvents[existingIndex] = event;
        } else {
            dateEvents.push(event);
        }
        
        dateEvents.sort((a,b) => (a.time || '').localeCompare(b.time || ''));
        newEvents[event.date] = dateEvents;
        saveEvents(newEvents);
        showNotification({ icon: '✅', title: 'Event Saved', message: `"${event.title}" has been saved.`});
    };
    
    const handleDeleteEvent = (eventToDelete: CalendarEvent) => {
        showModal('Confirm Deletion', `Are you sure you want to delete the event "${eventToDelete.title}"?`, [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            { text: 'Delete', type: 'danger', onClick: () => {
                const newEvents = { ...events };
                let dateEvents = newEvents[eventToDelete.date] || [];
                dateEvents = dateEvents.filter(e => e.id !== eventToDelete.id);

                if (dateEvents.length > 0) {
                    newEvents[eventToDelete.date] = dateEvents;
                } else {
                    delete newEvents[eventToDelete.date];
                }
                saveEvents(newEvents);
                showNotification({ icon: '🗑️', title: 'Event Deleted', message: `"${eventToDelete.title}" has been deleted.` });
            }}
        ]);
    };

    const openEventModal = (event?: CalendarEvent) => {
        if (!selectedDate) return;
        const dateStr = toYYYYMMDD(selectedDate);
        showModal(event ? 'Edit Event' : 'Add Event', <EventForm event={event} date={dateStr} onSave={handleAddOrUpdateEvent} />, [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            { text: 'Save', type: 'primary', onClick: () => {
                 const title = (document.getElementById('event-title') as HTMLInputElement).value;
                 if(!title.trim()) {
                    showNotification({icon: '❌', title: 'Save Failed', message: 'Title cannot be empty.'});
                    return;
                 }
                 const time = (document.getElementById('event-time') as HTMLInputElement).value;
                 const notes = (document.getElementById('event-notes') as HTMLInputElement).value;
                 handleAddOrUpdateEvent({ id: event?.id || uuidv4(), date: dateStr, title, time, notes });
            }}
        ]);
    };

    const handleSyncWithGoogle = async () => {
        setIsSyncing(true);
        try {
            const year = currentDate.getFullYear();
            const monthName = currentDate.toLocaleString('default', { month: 'long' });
            const aiEvents = await geminiService.simulateGoogleCalendarEvents(year, monthName, googleUser?.name);
            
            const newEvents = { ...events };
            // Clear existing events for the current month
            Object.keys(newEvents).forEach(dateStr => {
                if (dateStr.startsWith(`${year}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`)) {
                    delete newEvents[dateStr];
                }
            });

            // Add new events from AI
            aiEvents.forEach(event => {
                if (!newEvents[event.date]) {
                    newEvents[event.date] = [];
                }
                newEvents[event.date].push(event);
            });
            
            saveEvents(newEvents);
            showNotification({ icon: '🔄', title: 'Sync Complete', message: `Calendar synced with simulated Google events for ${monthName}.` });
        } catch (e) {
            showNotification({ icon: '❌', title: 'Sync Failed', message: e instanceof Error ? e.message : 'Could not fetch simulated events.' });
        } finally {
            setIsSyncing(false);
        }
    };

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const today = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const calendarDays = [];

    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(<div key={`empty-${i}`} className="border-r border-b border-gray-200 dark:border-gray-700"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const dayStr = toYYYYMMDD(dayDate);
        const isToday = dayStr === toYYYYMMDD(today);
        const isSelected = selectedDate && dayStr === toYYYYMMDD(selectedDate);
        const dayHasEvents = events[dayStr] && events[dayStr].length > 0;

        calendarDays.push(
            <div 
                key={day} 
                className={`p-2 border-r border-b border-gray-200 dark:border-gray-700 flex flex-col cursor-pointer hover:bg-obpi-accent/10 ${isToday ? 'bg-obpi-accent/20' : ''} ${isSelected ? 'bg-obpi-accent/30 ring-2 ring-obpi-accent' : ''}`}
                onClick={() => setSelectedDate(dayDate)}
            >
                <span className={`font-semibold self-start ${isToday ? 'text-obpi-accent' : ''}`}>{day}</span>
                <div className="flex-grow mt-1 flex justify-center">
                    {dayHasEvents && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex-grow flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-700">
                    <button onClick={() => changeMonth(-1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">&lt;</button>
                    <h2 className="text-xl font-bold">{monthName} {year}</h2>
                    <button onClick={() => changeMonth(1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">&gt;</button>
                </div>
                <div className="p-2 border-b border-gray-300 dark:border-gray-700">
                    <button onClick={handleSyncWithGoogle} disabled={isSyncing} className="w-full py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-500">
                        {isSyncing ? 'Syncing...' : '🔄 Sync with Google (Simulated)'}
                    </button>
                </div>
                <div className="flex-grow grid grid-cols-7" style={{ gridTemplateRows: 'auto 1fr 1fr 1fr 1fr 1fr 1fr'}}>
                    {days.map(day => (
                        <div key={day} className="text-center font-bold p-2 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">{day}</div>
                    ))}
                    {calendarDays}
                </div>
            </div>
            {selectedDate && (
                 <div className="w-1/3 max-w-xs flex-shrink-0 border-l border-gray-300 dark:border-gray-700 flex flex-col">
                     <div className="p-3 border-b border-gray-300 dark:border-gray-700">
                         <h3 className="font-bold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                     </div>
                     <div className="flex-grow p-2 space-y-2 overflow-y-auto">
                        {(events[toYYYYMMDD(selectedDate)] || []).map(event => (
                            <div key={event.id} className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{event.title}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{event.time}</p>
                                    </div>
                                    <div>
                                        <button onClick={() => openEventModal(event)} className="text-xs p-1">✏️</button>
                                        <button onClick={() => handleDeleteEvent(event)} className="text-xs p-1">🗑️</button>
                                    </div>
                                </div>
                                {event.notes && <p className="mt-1 text-xs whitespace-pre-wrap">{event.notes}</p>}
                            </div>
                        ))}
                         {(events[toYYYYMMDD(selectedDate)] || []).length === 0 && (
                            <p className="text-sm text-gray-500 text-center pt-4">No events for this day.</p>
                         )}
                     </div>
                     <div className="p-2 border-t border-gray-300 dark:border-gray-700">
                         <button onClick={() => openEventModal()} className="w-full py-2 bg-obpi-accent text-white rounded text-sm">Add New Event</button>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default CalendarApp;
