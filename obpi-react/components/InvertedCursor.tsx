
import React, { useState, useEffect } from 'react';
import { useOS } from '../contexts/OSContext';

const InvertedCursor: React.FC = () => {
    const { deviceType } = useOS();
    const [position, setPosition] = useState({ x: -100, y: -100 });
    const [isVisible, setIsVisible] = useState(true);
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
            
            const target = e.target;
            if (target && target instanceof HTMLElement) {
                const computedStyle = window.getComputedStyle(target);
                // Hide custom cursor if the element it's over has a specific cursor defined
                if (computedStyle.cursor !== 'none') {
                    setIsHidden(true);
                } else {
                    setIsHidden(false);
                }
            } else {
                // Default behavior for non-HTMLElements (like SVGs)
                setIsHidden(false);
            }
        };

        const handleMouseLeave = () => setIsVisible(false);
        const handleMouseEnter = () => setIsVisible(true);

        document.documentElement.addEventListener('mousemove', handleMouseMove);
        document.documentElement.addEventListener('mouseleave', handleMouseLeave);
        document.documentElement.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            document.documentElement.removeEventListener('mousemove', handleMouseMove);
            document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
            document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, []);
    
    if (deviceType === 'mobile' || !isVisible || isHidden) {
        return null;
    }

    return (
        <div 
            style={{ 
                left: `${position.x}px`, 
                top: `${position.y}px`,
                mixBlendMode: 'difference',
            }}
            className="fixed w-6 h-6 z-[99999] pointer-events-none"
        >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                {/* Standard cursor arrow shape */}
                <path d="M4.5 4.5L19.5 12L12 15L9 21L4.5 4.5Z" />
            </svg>
        </div>
    );
};

export default InvertedCursor;
