import React, { useState, useEffect } from 'react';
import { logger } from '../services/loggingService';
import { analyzeSystem } from '../services/geminiService';
import { APPS } from '../constants';

interface LogEntry {
    timestamp: string;
    source: string;
    message: string;
}

const getSourceColor = (source: string) => {
    switch(source) {
        case 'Shell': return 'text-green-400';
        case 'Dev Studio': return 'text-sky-400';
        case 'Kernel': return 'text-purple-400';
        case 'Build Agent': return 'text-yellow-400';
        default: return 'text-gray-400';
    }
};

const ActivityLog: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        const unsubscribe = logger.subscribe(setLogs);
        return () => unsubscribe();
    }, []);

    return (
        <div className="flex-grow bg-black/40 rounded-md p-2 overflow-y-auto text-xs">
            {logs.length === 0 ? (
                <p className="text-gray-500">No AI activity recorded yet.</p>
            ) : (
                logs.map((log, index) => (
                    <div key={index} className="flex gap-2 mb-1">
                        <span className="text-gray-500 flex-shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={`${getSourceColor(log.source)} font-bold flex-shrink-0`}>[{log.source}]</span>
                        <p className="flex-grow break-words">{log.message}</p>
                    </div>
                ))
            )}
        </div>
    );
};

const SystemAnalysis: React.FC = () => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        setAnalysis('');
        const osDescription = `
            # OBPI React Desktop OS Analysis
            This is a virtual OS running in the browser with a Gemini-powered kernel.

            ## Current Applications:
            ${APPS.map(app => `- **${app.name} (${app.id})**: ${app.icon}`).join('\n')}

            ## Core Features:
            - Window management (drag, resize, maximize, minimize)
            - Virtual File System (VFS) with directories and binary/text files.
            - Dock and App Drawer for navigation.
            - AI Assistant for general OS commands (file system, opening apps).
            - Dev Studio with multi-language support and an AI Build Agent.
            - Agent Hub for monitoring AI activity and running system analysis.
            - Gemini Studio for advanced multimodal tasks (image/video/audio generation).
            - Terminal with standard Unix-like commands and AI command interpretation.

            ## Agent Capabilities:
            The AI can interact with the OS via function calls to:
            - openWindow, listFiles, readFile, writeFile, createFile, deleteFile
            - analyzeProjectStructure, compileFile, linkFiles, runCommand
            - searchWeb (Google Search & Maps)
        `;

        try {
            const result = await analyzeSystem(osDescription);
            setAnalysis(result);
        } catch (e) {
            setAnalysis(`Error during analysis: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };
    
     const formatAnalysis = (text: string) => {
        return text
            .replace(/### (.*)/g, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
            .replace(/## (.*)/g, '<h2 class="text-xl font-bold mt-6 mb-3 border-b border-gray-600 pb-1">$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\* (.*)/g, '<li class="ml-4">$1</li>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-700 px-1 rounded text-xs">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="p-4 space-y-4">
            <p className="text-sm text-gray-400">The AI agent will analyze the entire OS structure and suggest potential improvements or new features.</p>
            <button onClick={handleRunAnalysis} disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-gray-500">
                {isLoading ? 'Analyzing...' : 'Run System Analysis'}
            </button>
            <div className="mt-4 p-4 bg-black/30 rounded-md min-h-[200px]">
                {isLoading && <p>AI is analyzing the system...</p>}
                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }} />
            </div>
        </div>
    );
};


const AgentHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'logs' | 'analysis'>('logs');
    
    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-200 font-mono">
            {/* Header */}
            <div className="flex-shrink-0 p-3 border-b border-gray-700 text-center">
                <h2 className="text-xl font-bold tracking-wider">🤖 Agent Hub</h2>
            </div>
            
            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-gray-700">
                <button onClick={() => setActiveTab('logs')} className={`flex-1 p-2 text-sm ${activeTab === 'logs' ? 'bg-gray-800' : 'bg-transparent text-gray-400'}`}>Activity Log</button>
                <button onClick={() => setActiveTab('analysis')} className={`flex-1 p-2 text-sm ${activeTab === 'analysis' ? 'bg-gray-800' : 'bg-transparent text-gray-400'}`}>System Analysis</button>
            </div>

            {/* Content */}
            <div className="flex-grow p-3 overflow-y-auto">
                {activeTab === 'logs' && <ActivityLog />}
                {activeTab === 'analysis' && <SystemAnalysis />}
            </div>
        </div>
    );
};

export default AgentHub;