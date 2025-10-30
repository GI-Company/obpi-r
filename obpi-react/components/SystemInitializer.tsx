
import React, { useState, useEffect } from 'react';
import BIOS from './BIOS';
// FIX: 'BiosSettings' is not exported from constants.ts. It should be imported from types.ts directly.
import { LOCAL_STORAGE_KEYS } from '../constants';
import type { BiosSettings } from '../types';

interface SystemInitializerProps {
    onInitialized: () => void;
}

const bootSequence = [
    { text: 'BIOS POST check...', delay: 300 },
    { text: 'Verifying WebAssembly support...', delay: 200},
    { text: 'Initializing Firmware...', delay: 400 },
    { text: 'Probing virtual hardware...', delay: 500 },
    { text: 'Loading VFS from storage...', delay: 600 },
    { text: 'Initializing Pyodide...', delay: 400},
    { text: 'Starting Authentication Service...', delay: 200 },
    { text: 'Loading AI Kernel...', delay: 500 },
    { text: 'Starting Window Manager...', delay: 300 },
    { text: 'Handing off to login manager...', delay: 800 },
];

const SystemInitializer: React.FC<SystemInitializerProps> = ({ onInitialized }) => {
    const [bootLog, setBootLog] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [inBios, setInBios] = useState(false);

    useEffect(() => {
        const handleBiosEntry = (e: MouseEvent) => {
            e.preventDefault();
            setInBios(true);
        };
        // Only allow BIOS entry during the boot phase
        if (currentStep < bootSequence.length) {
            document.addEventListener('contextmenu', handleBiosEntry);
        }

        return () => {
            document.removeEventListener('contextmenu', handleBiosEntry);
        };
    }, [currentStep]);
    
    const handleExitBios = () => {
        setInBios(false);
    }

    const handleSaveAndExitBios = (settings: BiosSettings) => {
        localStorage.setItem(LOCAL_STORAGE_KEYS.BIOS_SETTINGS, JSON.stringify(settings));
        setInBios(false);
    };
    
    useEffect(() => {
        if (inBios) return; // Pause boot sequence if in BIOS

        if (currentStep < bootSequence.length) {
            const timer = setTimeout(() => {
                setBootLog(prev => [...prev, `[ OK ] ${bootSequence[currentStep].text}`]);
                setCurrentStep(prev => prev + 1);
            }, bootSequence[currentStep].delay);
            return () => clearTimeout(timer);
        } else {
            const finalTimer = setTimeout(onInitialized, 500);
            return () => clearTimeout(finalTimer);
        }
    }, [currentStep, onInitialized, inBios]);

    if(inBios) {
        return <BIOS onExit={handleExitBios} onSaveAndExit={handleSaveAndExitBios} />;
    }

    return (
        <div className="w-screen h-screen bg-black text-green-400 font-mono text-sm p-4 flex flex-col justify-end">
            <div>
                 <p>OBPI OS Boot Loader v2.2.0</p>
                 <p>Right-click to enter BIOS setup.</p>
                 <br />
                {bootLog.map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
                 {currentStep < bootSequence.length && !inBios && (
                    <div className="flex items-center">
                        <p className="animate-pulse">_</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemInitializer;
