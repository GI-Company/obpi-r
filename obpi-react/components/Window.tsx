import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { WindowInstance } from '../types';
import { useOS } from '../contexts/OSContext';
import { TASKBAR_HEIGHT } from '../constants';

interface WindowProps {
  instance: WindowInstance;
  children: React.ReactNode;
}

const Window: React.FC<WindowProps> = ({ instance, children }) => {
  const { focusWindow, closeWindow, minimizeWindow, toggleMaximizeWindow, moveWindow, resizeWindow, deviceType } = useOS();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const isMobile = deviceType === 'mobile';
  
  const { id, title, icon, position, size, zIndex, isFocused } = instance;
  // On mobile, windows are always maximized
  const isMaximized = isMobile || instance.isMaximized;

  const handleInteractionStart = (clientX: number, clientY: number) => {
    if (isMaximized || isMobile || (event?.target as HTMLElement).closest('.window-controls')) {
      return;
    }
    focusWindow(id);
    setIsDragging(true);
    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleInteractionStart(e.clientX, e.clientY);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    handleInteractionStart(touch.clientX, touch.clientY);
  };
  
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: string) => {
    if(isMaximized || isMobile) return;
    e.stopPropagation();
    focusWindow(id);
    setIsResizing(true);
    setResizeHandle(handle);
    e.preventDefault();
  }

  const handleInteractionEnd = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle('');
  }, []);

  const handleInteractionMove = useCallback((clientX: number, clientY: number) => {
    if (isDragging && !isMaximized) {
        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;
        
        // Window Snapping Logic
        const snapThreshold = 10;
        if (clientY < snapThreshold) {
            toggleMaximizeWindow(id);
        } else if (clientX < snapThreshold) {
            moveWindow(id, { x: 0, y: 0 });
            resizeWindow(id, { width: window.innerWidth / 2, height: window.innerHeight - TASKBAR_HEIGHT });
        } else if (clientX > window.innerWidth - snapThreshold) {
            moveWindow(id, { x: window.innerWidth / 2, y: 0 });
            resizeWindow(id, { width: window.innerWidth / 2, height: window.innerHeight - TASKBAR_HEIGHT });
        } else {
            const constrainedX = Math.max(0, Math.min(newX, window.innerWidth - size.width));
            const constrainedY = Math.max(0, Math.min(newY, window.innerHeight - TASKBAR_HEIGHT - 30)); 
            moveWindow(id, { x: constrainedX, y: constrainedY });
        }
    }
    if (isResizing && windowRef.current && !isMobile && !isMaximized) {
        const rect = windowRef.current.getBoundingClientRect();
        let newWidth = rect.width;
        let newHeight = rect.height;
        let newX = rect.left;
        let newY = rect.top;
        const minWidth = 280;
        const minHeight = 180;
        const availableHeight = window.innerHeight - TASKBAR_HEIGHT;
        const constrainedClientY = Math.min(clientY, availableHeight);

        if (resizeHandle.includes('r')) newWidth = Math.max(minWidth, clientX - rect.left);
        if (resizeHandle.includes('b')) newHeight = Math.max(minHeight, constrainedClientY - rect.top);
        if (resizeHandle.includes('l')) {
            const delta = rect.left - clientX;
            if (rect.width + delta > minWidth) {
                newWidth = rect.width + delta;
                newX = clientX;
            }
        }
        if (resizeHandle.includes('t')) {
            const delta = rect.top - clientY;
            if (rect.height + delta > minHeight) {
                newHeight = rect.height + delta;
                newY = clientY;
            }
        }
        resizeWindow(id, { width: newWidth, height: newHeight });
        moveWindow(id, { x: newX, y: newY });
    }
  }, [id, isDragging, isResizing, resizeHandle, size.width, moveWindow, resizeWindow, isMobile, toggleMaximizeWindow, isMaximized]);

  const handleMouseMove = useCallback((e: MouseEvent) => handleInteractionMove(e.clientX, e.clientY), [handleInteractionMove]);
  const handleTouchMove = useCallback((e: TouchEvent) => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY), [handleInteractionMove]);


  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleInteractionEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleInteractionEnd);
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleInteractionEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleInteractionEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, handleMouseMove, handleTouchMove, handleInteractionEnd]);
  
  const windowClasses = [
    'os-window absolute flex flex-col bg-glass-light dark:bg-glass-dark border backdrop-blur-xl',
    'shadow-lg dark:shadow-2xl dark:shadow-black/50 animate-fade-in-window',
    isFocused ? 'border-obpi-accent' : 'border-glass-border-light dark:border-glass-border-dark',
    isMaximized ? 'transition-none' : 'rounded-lg', // No rounded corners when maximized
    isMobile ? 'inset-0 !w-full !h-full' : '' // Force fullscreen on mobile
  ].join(' ');

  const positionStyles: React.CSSProperties = isMaximized ? {
    top: 0,
    left: 0,
    width: '100vw',
    height: `calc(var(--vh, 1vh) * 100 - ${TASKBAR_HEIGHT}px)`,
    transition: 'width 0.2s ease-in-out, height 0.2s ease-in-out, top 0.2s ease-in-out, left 0.2s ease-in-out',
  } : {
    top: `${position.y}px`,
    left: `${position.x}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    transition: isDragging ? 'none' : 'all 0.2s ease-in-out',
  };

  const resizeHandles = [
    { handle: 'tl', className: 'resize-handle-tl' }, { handle: 't', className: 'resize-handle-t' }, { handle: 'tr', className: 'resize-handle-tr' },
    { handle: 'l', className: 'resize-handle-l' }, { handle: 'r', className: 'resize-handle-r' },
    { handle: 'bl', className: 'resize-handle-bl' }, { handle: 'b', className: 'resize-handle-b' }, { handle: 'br', className: 'resize-handle-br' },
  ];

  return (
    <div
      ref={windowRef}
      id={`window-${id}`}
      className={windowClasses}
      style={{
        ...positionStyles,
        zIndex,
      }}
      onMouseDown={() => focusWindow(id)}
    >
      <header
        className={`window-header flex-shrink-0 flex items-center justify-between px-3 h-[36px] bg-obpi-header-light dark:bg-obpi-header-dark text-white ${isMaximized ? '' : 'rounded-t-lg'} ${!isMobile && !isMaximized ? 'cursor-move' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => !isMobile && toggleMaximizeWindow(id)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-sm">{icon}</span>
          <span className="font-semibold text-sm select-none truncate">{title}</span>
        </div>
        <div className="window-controls flex items-center gap-1.5">
          <button onClick={() => minimizeWindow(id)} className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-yellow-500 hover:bg-yellow-600">
            <span className="text-black font-bold text-xs">─</span>
          </button>
          {!isMobile && (
            <button onClick={() => toggleMaximizeWindow(id)} className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600">
                <span className="text-black font-bold text-sm">{isMaximized ? '❐' : '□'}</span>
            </button>
          )}
          <button onClick={() => closeWindow(id)} className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600">
             <span className="text-black font-bold text-sm">×</span>
          </button>
        </div>
      </header>
      <div className="window-content flex-grow overflow-auto bg-white/40 dark:bg-black/20 text-gray-900 dark:text-gray-200">
        {children}
      </div>
       {!isMaximized && !isMobile && resizeHandles.map(h => (
          <div key={h.handle} className={`resize-handle ${h.className}`} onMouseDown={(e) => handleResizeMouseDown(e, h.handle)} />
      ))}
    </div>
  );
};

export default Window;
