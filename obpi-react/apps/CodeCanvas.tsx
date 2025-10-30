import React, { useState, useEffect, useRef } from 'react';
import { visualizeCode } from '../services/geminiService';

const syntaxHighlight = (code: string) => {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\b(const|let|var|function|return|if|else|for|while|import|from|async|await|new|class|extends|super|this|document|window|console)\b/g, '<span class="text-pink-400">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-green-400">$1</span>');
};

interface DrawingCommand {
    command: 'rect' | 'text' | 'arrow';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    from_x?: number;
    from_y?: number;
    to_x?: number;
    to_y?: number;
    color?: string;
}

const AICodeVisualizer: React.FC = () => {
    const [code, setCode] = useState('function factorial(n) {\n  if (n === 0) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}');
    const [prompt, setPrompt] = useState('Visualize this code as a flowchart');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [drawingCommands, setDrawingCommands] = useState<DrawingCommand[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleVisualize = async () => {
        setIsLoading(true);
        setError('');
        setDrawingCommands([]);
        try {
            const commands = await visualizeCode(code, prompt);
            setDrawingCommands(commands);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to get visualization.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        
        canvas.width = 600;
        canvas.height = 600;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawingCommands.forEach(cmd => {
            ctx.fillStyle = cmd.color || '#ffffff';
            ctx.strokeStyle = cmd.color || '#ffffff';
            ctx.lineWidth = 2;
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            switch (cmd.command) {
                case 'rect':
                    if (cmd.width && cmd.height) {
                        ctx.strokeRect(cmd.x, cmd.y, cmd.width, cmd.height);
                    }
                    break;
                case 'text':
                    if (cmd.text) {
                        ctx.fillText(cmd.text, cmd.x, cmd.y);
                    }
                    break;
                case 'arrow':
                    if (cmd.from_x != null && cmd.from_y != null && cmd.to_x != null && cmd.to_y != null) {
                        ctx.beginPath();
                        ctx.moveTo(cmd.from_x, cmd.from_y);
                        ctx.lineTo(cmd.to_x, cmd.to_y);
                        ctx.stroke();
                        // Draw arrowhead
                        const angle = Math.atan2(cmd.to_y - cmd.from_y, cmd.to_x - cmd.from_x);
                        ctx.beginPath();
                        ctx.moveTo(cmd.to_x, cmd.to_y);
                        ctx.lineTo(cmd.to_x - 10 * Math.cos(angle - Math.PI / 6), cmd.to_y - 10 * Math.sin(angle - Math.PI / 6));
                        ctx.lineTo(cmd.to_x - 10 * Math.cos(angle + Math.PI / 6), cmd.to_y - 10 * Math.sin(angle + Math.PI / 6));
                        ctx.closePath();
                        ctx.fill();
                    }
                    break;
            }
        });
    }, [drawingCommands]);

    return (
        <div className="flex flex-col md:flex-row h-full bg-[#1e1e1e] text-gray-200 font-mono">
            {/* Left Panel: Editor & Controls */}
            <div className="w-full md:w-1/2 h-2/3 md:h-full flex flex-col border-r border-gray-700">
                <div className="relative flex-grow min-h-0">
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="absolute top-0 left-0 w-full h-full p-3 bg-transparent text-transparent caret-white outline-none resize-none leading-relaxed"
                        spellCheck="false"
                    />
                    <pre className="absolute top-0 left-0 w-full h-full p-3 pointer-events-none overflow-auto leading-relaxed">
                        <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(code) + '\n' }} />
                    </pre>
                </div>
                <div className="flex-shrink-0 p-2 space-y-2 border-t border-gray-700">
                    <input 
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-sm"
                        placeholder="e.g., Visualize as a flowchart"
                    />
                    <button 
                        onClick={handleVisualize} 
                        disabled={isLoading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md disabled:bg-gray-500"
                    >
                        {isLoading ? 'Visualizing...' : '✨ Generate Visualization'}
                    </button>
                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                </div>
            </div>

            {/* Right Panel: Canvas */}
            <div ref={containerRef} className="relative w-full md:w-1/2 h-1/3 md:h-full flex items-center justify-center p-4 bg-black/50">
                <canvas 
                    ref={canvasRef} 
                    className="bg-white shadow-lg max-w-full max-h-full"
                />
            </div>
        </div>
    );
};

export default AICodeVisualizer;