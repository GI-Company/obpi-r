import React, { useState, useEffect, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';
import { VirtualDevice, BiosSettings } from '../types';
import { LOCAL_STORAGE_KEYS, DEFAULT_BIOS_SETTINGS } from '../constants';

interface BIOSProps {
    onExit: () => void;
    onSaveAndExit: (settings: BiosSettings) => void;
}

type Tab = 'Main' | 'Advanced' | 'Boot' | 'Exit';

const tabs: Tab[] = ['Main', 'Advanced', 'Boot', 'Exit'];

const helpText: Record<string, string> = {
    'Main.0': 'The system-detected time. Cannot be modified.',
    'Main.1': 'The system-detected date. Cannot be modified.',
    'Advanced.0': 'Enable or disable the virtual audio device. This will affect sound playback within the OS.',
    'Advanced.1': 'Enable or disable the virtual network interface. Affects browser connectivity.',
    'Boot.0': 'Set the order of devices the system will try to boot from.',
    'Exit.0': 'Save all changes to BIOS settings and continue the boot process.',
    'Exit.1': 'Exit without saving any changes and continue boot process.',
    'Exit.2': 'Revert all settings to their default values.',
};

const BIOS: React.FC<BIOSProps> = ({ onExit, onSaveAndExit }) => {
    const { firmwareService } = useOS();
    const [devices, setDevices] = useState<VirtualDevice[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('Main');
    const [selectedItem, setSelectedItem] = useState(0);
    const [settings, setSettings] = useState<BiosSettings>(DEFAULT_BIOS_SETTINGS);

    useEffect(() => {
        const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEYS.BIOS_SETTINGS);
        if (storedSettings) {
            setSettings(JSON.parse(storedSettings));
        }
        setDevices(firmwareService.getDevices());
    }, [firmwareService]);

    const menuItems: Record<Tab, string[]> = {
        Main: ['System Time', 'System Date', ...devices.map(d => d.name)],
        Advanced: ['Virtual Audio Device', 'Virtual Network Interface'],
        Boot: ['Boot Device Priority'],
        Exit: ['Exit Saving Changes', 'Exit Discarding Changes', 'Load Setup Defaults'],
    };
    
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        e.preventDefault();
        const currentTabItems = menuItems[activeTab];

        switch(e.key) {
            case 'ArrowUp':
                setSelectedItem(prev => (prev > 0 ? prev - 1 : currentTabItems.length - 1));
                break;
            case 'ArrowDown':
                setSelectedItem(prev => (prev < currentTabItems.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowLeft': {
                const currentIndex = tabs.indexOf(activeTab);
                const nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
                setActiveTab(tabs[nextIndex]);
                setSelectedItem(0);
                break;
            }
            case 'ArrowRight': {
                const currentIndex = tabs.indexOf(activeTab);
                const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
                setActiveTab(tabs[nextIndex]);
                setSelectedItem(0);
                break;
            }
            case '+':
            case 'PageUp':
                 if (activeTab === 'Advanced') {
                    const key = selectedItem === 0 ? 'virtualAudio' : 'virtualNetwork';
                    setSettings(s => ({...s, [key]: !s[key]}));
                }
                if (activeTab === 'Boot' && settings.bootOrder.length > 1) {
                    setSettings(s => {
                        const newOrder = [...s.bootOrder];
                        const sel = newOrder.splice(selectedItem, 1)[0];
                        const newIndex = selectedItem > 0 ? selectedItem - 1 : 0;
                        newOrder.splice(newIndex, 0, sel);
                        setSelectedItem(newIndex);
                        return {...s, bootOrder: newOrder};
                    });
                }
                break;
            case '-':
            case 'PageDown':
                 if (activeTab === 'Advanced') {
                    const key = selectedItem === 0 ? 'virtualAudio' : 'virtualNetwork';
                    setSettings(s => ({...s, [key]: !s[key]}));
                }
                 if (activeTab === 'Boot' && settings.bootOrder.length > 1) {
                    setSettings(s => {
                        const newOrder = [...s.bootOrder];
                        const sel = newOrder.splice(selectedItem, 1)[0];
                        const newIndex = selectedItem < newOrder.length ? selectedItem + 1 : newOrder.length;
                        newOrder.splice(newIndex, 0, sel);
                        setSelectedItem(newIndex);
                        return {...s, bootOrder: newOrder};
                    });
                }
                break;
            case 'Enter':
                if (activeTab === 'Exit') {
                    if (selectedItem === 0) onSaveAndExit(settings); // Save & Exit
                    if (selectedItem === 1) onExit(); // Discard & Exit
                    if (selectedItem === 2) setSettings(DEFAULT_BIOS_SETTINGS); // Load Defaults
                }
                break;
            case 'Escape':
                onExit();
                break;
            case 'F10':
                onSaveAndExit(settings);
                break;
        }
    }, [activeTab, selectedItem, onExit, onSaveAndExit, settings]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const renderValue = (tab: Tab, index: number) => {
        switch(tab) {
            case 'Main':
                if (index === 0) return new Date().toLocaleTimeString();
                if (index === 1) return new Date().toLocaleDateString();
                return devices[index - 2]?.status || 'N/A';
            case 'Advanced':
                const key = index === 0 ? 'virtualAudio' : 'virtualNetwork';
                return `[${settings[key] ? 'Enabled' : 'Disabled'}]`;
            case 'Boot':
                return ''; // Handled specially
            case 'Exit':
                return '';
            default:
                return '';
        }
    };
    
    return (
        <div className="w-screen h-screen bg-[#0000AA] text-white font-mono p-1 flex flex-col">
            <header className="text-center bg-gray-500 py-0">
                <h1 className="font-bold">OBPI BIOS Setup Utility - v2.2.0</h1>
            </header>
            <div className="flex justify-center bg-black">
                {tabs.map(tab => (
                    <div key={tab} className={`px-4 py-1 ${activeTab === tab ? 'bg-[#0000AA]' : 'bg-black'}`}>
                        {tab}
                    </div>
                ))}
            </div>
            <main className="flex-grow flex text-sm p-2">
                <div className="w-3/5">
                    {menuItems[activeTab].map((item, index) => (
                        <div key={item} className={`flex justify-between ${selectedItem === index ? 'bg-gray-500 text-yellow-300' : ''}`}>
                             <p className="w-1/2">{item}</p>
                            <p className="w-1/2 text-right">{renderValue(activeTab, index)}</p>
                        </div>
                    ))}
                    {activeTab === 'Boot' && (
                        <div className="mt-2 pl-4">
                             {settings.bootOrder.map((device, index) => (
                                <p key={device} className={selectedItem === index ? 'bg-gray-500 text-yellow-300' : ''}>
                                    {index + 1}. {device}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-2/5 border-l-2 border-white pl-2 ml-2">
                    <h3 className="font-bold bg-gray-500 text-center">Item Help</h3>
                    <p className="mt-2 text-xs">{helpText[`${activeTab}.${selectedItem}`] || 'Select an item for help.'}</p>
                </div>
            </main>
            <footer className="flex-shrink-0 text-xs border-t-2 border-white pt-1">
                 <p>
                    <strong className="bg-white text-black px-1">↑↓</strong> Select Item &nbsp;
                    <strong className="bg-white text-black px-1">←→</strong> Select Menu &nbsp;
                    <strong className="bg-white text-black px-1">+/-</strong> Change Value &nbsp;
                    <strong className="bg-white text-black px-1">Enter</strong> Select &nbsp;
                    <strong className="bg-white text-black px-1">F10</strong> Save & Exit &nbsp;
                    <strong className="bg-white text-black px-1">ESC</strong> Exit
                </p>
            </footer>
        </div>
    );
};

export default BIOS;