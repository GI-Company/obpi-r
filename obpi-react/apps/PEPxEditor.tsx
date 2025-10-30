
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';

interface PEPxEditorProps {
    filePath: string;
}

// Simple hook for debouncing
const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    return (...args: any[]) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    };
};

const PEPxEditor: React.FC<PEPxEditorProps> = ({ filePath }) => {
    // FIX: Use async context methods instead of vfs
    const { writeFile, readFile, readPEPxImageData, updateFs } = useOS();
    const [content, setContent] = useState('');
    const [imageData, setImageData] = useState<ImageData | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isSavingRef = useRef(false);

    const loadAndRender = useCallback(async () => {
        const fileContent = await readFile(filePath);
        if (fileContent instanceof Uint8Array) {
            const decodedString = new TextDecoder().decode(fileContent);
            setContent(decodedString);
        } else if (typeof fileContent === 'string') {
            setContent(fileContent);
        }
        
        const imgData = await readPEPxImageData(filePath);
        setImageData(imgData);
    }, [filePath, readFile, readPEPxImageData]);

    useEffect(() => {
        loadAndRender();
    }, [loadAndRender]);

    useEffect(() => {
        if (canvasRef.current && imageData) {
            const canvas = canvasRef.current;
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.putImageData(imageData, 0, 0);
            }
        }
    }, [imageData]);

    const debouncedSave = useDebounce(async (newContent: string) => {
        isSavingRef.current = true;
        if (await writeFile(filePath, newContent)) {
            const newData = await readPEPxImageData(filePath);
            setImageData(newData);
            updateFs(); // Notify other apps of the change
        }
        isSavingRef.current = false;
    }, 500);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        debouncedSave(newContent);
    };
    
    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Text Editor Pane */}
            <div className="w-1/2 h-full flex flex-col border-r border-gray-300 dark:border-gray-600">
                 <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-600 text-sm font-semibold">
                    Data View
                 </div>
                 <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="flex-grow w-full h-full p-2 bg-white dark:bg-gray-700 font-mono text-sm outline-none resize-none"
                    spellCheck="false"
                 />
            </div>
            {/* Pixel Visualization Pane */}
            <div className="w-1/2 h-full flex flex-col">
                <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-600 text-sm font-semibold">
                    Pixel Storage Visualization
                </div>
                <div className="flex-grow p-4 flex items-center justify-center bg-gray-200 dark:bg-gray-900 overflow-auto">
                    <canvas
                        ref={canvasRef}
                        className="bg-white shadow-lg"
                        style={{ imageRendering: 'pixelated' }}
                        title="Each pixel's RGB values store a piece of your data."
                    />
                </div>
            </div>
        </div>
    );
};

export default PEPxEditor;
