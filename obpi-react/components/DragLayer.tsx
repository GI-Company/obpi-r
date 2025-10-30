
import React, { useState, useEffect } from 'react';
import { useOS } from '../contexts/OSContext';

const DragLayer: React.FC = () => {
    const { draggedItem } = useOS();
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        if (draggedItem) {
            document.addEventListener('mousemove', handleMouseMove);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [draggedItem]);

    if (!draggedItem) {
        return null;
    }

    return (
        <div
            className="fixed top-0 left-0 pointer-events-none z-[20000]"
            style={{ transform: `translate(${position.x + 10}px, ${position.y + 10}px)` }}
        >
            <div className="flex flex-col items-center p-2 rounded bg-black/50 backdrop-blur-sm opacity-80">
                <span className="text-3xl">{draggedItem.icon}</span>
                <span className="text-xs text-white break-all">{draggedItem.name}</span>
            </div>
        </div>
    );
};

export default DragLayer;
