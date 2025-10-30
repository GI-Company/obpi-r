import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOS } from '../contexts/OSContext';
import { WindowInstance } from '../types';

interface Process extends WindowInstance {
    cpu: number;
    memory: number; // in MB
}

const PerformanceGraph: React.FC<{ history: number[] }> = ({ history }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 10; i++) {
            const y = (i / 10) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw the performance line
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        const step = width / (history.length - 1);
        history.forEach((value, index) => {
            const x = width - (index * step);
            const y = height - (value / 100) * height;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

    }, [history]);

    return <canvas ref={canvasRef} width="300" height="80" className="w-full h-full" />;
};


const SystemMonitor: React.FC = () => {
    const { windows, closeWindow } = useOS();
    const [processes, setProcesses] = useState<Process[]>([]);
    const [cpuHistory, setCpuHistory] = useState<number[]>(Array(50).fill(0));

    useEffect(() => {
        const interval = setInterval(() => {
            let totalCpu = 0;
            const updatedProcesses = windows.map(win => {
                // Base usage profile for each app
                const baseCpu = win.appId.length % 10 + 2; // e.g., 2-12%
                const baseMem = win.appId.length * 10 + 50; // e.g., 50-150MB
                
                // Add a temporary boost if the window is focused
                const focusCpuBoost = win.isFocused ? (baseCpu + 10) : 0;
                const focusMemBoost = win.isFocused ? 15 : 0;

                // Simulate fluctuations
                const cpu = Math.min(100, baseCpu + Math.random() * 5 + focusCpuBoost);
                const memory = baseMem + Math.random() * 20 + focusMemBoost;
                totalCpu += cpu;

                // Smooth the values for a less jerky display
                const existing = processes.find(p => p.id === win.id);
                return {
                    ...win,
                    cpu: existing ? (existing.cpu * 0.7 + cpu * 0.3) : cpu,
                    memory: existing ? (existing.memory * 0.7 + memory * 0.3) : memory,
                };
            });

            setProcesses(updatedProcesses);

            // Update CPU history for the graph
            setCpuHistory(prev => {
                const newHistory = [Math.min(100, totalCpu), ...prev.slice(0, 49)];
                return newHistory;
            });

        }, 1000);

        return () => clearInterval(interval);
    }, [windows, processes]);

    const totalMemory = useMemo(() => processes.reduce((sum, p) => sum + p.memory, 0), [processes]);

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono">
            {/* Header with stats */}
            <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
                <div>
                    <div className="font-bold text-lg text-green-500">{cpuHistory[0].toFixed(1)}%</div>
                    <div className="text-gray-500">CPU Usage</div>
                </div>
                <div>
                    <div className="font-bold text-lg text-blue-500">{totalMemory.toFixed(1)} MB</div>
                    <div className="text-gray-500">Memory Usage</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <div className="font-bold text-lg text-purple-500">{processes.length}</div>
                    <div className="text-gray-500">Processes</div>
                </div>
            </div>

            {/* Performance Graph */}
            <div className="flex-shrink-0 p-2 h-24 bg-black/80">
                <PerformanceGraph history={cpuHistory} />
            </div>

            {/* Process List */}
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-200 dark:bg-gray-800 sticky top-0">
                        <tr>
                            <th className="p-2">Process Name</th>
                            <th className="p-2 text-right">CPU %</th>
                            <th className="p-2 text-right">Memory (MB)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processes
                            .sort((a, b) => b.cpu - a.cpu)
                            .map(proc => (
                            <tr key={proc.id} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 ${proc.isFocused ? 'bg-blue-200/50 dark:bg-blue-800/20' : ''}`}>
                                <td className="p-2 flex items-center gap-2">
                                    <span>{proc.icon}</span>
                                    <span className="truncate">{proc.title}</span>
                                </td>
                                <td className="p-2 text-right">{proc.cpu.toFixed(1)}</td>
                                <td className="p-2 text-right">{proc.memory.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex-shrink-0 p-2 border-t border-gray-300 dark:border-gray-700 flex justify-end">
                <button 
                    onClick={() => {
                        const focused = windows.find(w => w.isFocused);
                        if (focused) closeWindow(focused.id);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:bg-gray-500"
                    disabled={!windows.some(w => w.isFocused)}
                >
                    End Focused Process
                </button>
            </div>
        </div>
    );
};

export default SystemMonitor;