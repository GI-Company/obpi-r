
import React, { useState } from 'react';
import type { DesktopIconType, DraggableItem, ContextMenuItem } from '../types';
import { useOS } from '../contexts/OSContext';

// FIX: Added missing DesktopIconProps interface definition
interface DesktopIconProps {
  icon: DesktopIconType;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ icon }) => {
  const { openWindow, moveIcon, startDrag, draggedItem, moveFile, showContextMenu, copyToClipboard, clipboardItem, showNotification, deviceType, cwd, trashFile } = useOS();
  const isMobile = deviceType === 'mobile';
  const [isDropTarget, setIsDropTarget] = useState(false);
  const isCut = clipboardItem?.type === 'cut' && clipboardItem.path.endsWith(`/${icon.name}`);
  
  const handleClick = () => {
    if (isMobile) {
        openWindow(icon.appId);
    }
  };

  const handleDoubleClick = () => {
    if (!isMobile) {
        openWindow(icon.appId);
    }
  };

  const onDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const dragItem: DraggableItem = {
      type: 'icon',
      id: icon.id,
      name: icon.name,
      icon: icon.icon,
      path: `${cwd}/${icon.name}` // Assume icons correspond to files on desktop
    };
    startDrag(dragItem, e);
  };
  
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    
    if (draggedItem?.type === 'icon') {
        const desktop = (e.target as HTMLElement).closest('#desktop')?.getBoundingClientRect();
        if(desktop) {
          const newX = e.clientX - desktop.left;
          const newY = e.clientY - desktop.top;
          moveIcon(draggedItem.id, { x: newX, y: newY });
        }
    } else if (draggedItem?.type === 'file' && draggedItem.path) {
        if (icon.appId === 'recycle_bin') {
            const fileName = draggedItem.path.split('/').pop();
            if (trashFile(draggedItem.path)) {
                showNotification({ icon: '🗑️', title: 'File Deleted', message: `"${fileName}" moved to Recycle Bin.`});
            }
        } else if (icon.appId === 'dev_studio') {
            openWindow(icon.appId, { args: { filePath: draggedItem.path } });
        } else {
            // Handle dropping on other folders or apps if needed
        }
    }
  };
  
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if ((draggedItem?.type === 'file' && (icon.appId === 'recycle_bin' || icon.appId === 'dev_studio')) || (draggedItem?.type === 'icon')) {
      setIsDropTarget(true);
    }
  };
  
  const getSendToMenuItem = (filePath: string): ContextMenuItem | null => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const items: ContextMenuItem[] = [];

    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
        items.push({ label: 'Gallery', icon: '🏞️', action: () => openWindow('gallery', { args: { filePath } }) });
        items.push({ label: 'Gemini Studio (Edit)', icon: '✨', action: () => openWindow('gemini_studio', { args: { initialTab: 'editImage', filePath } }) });
    }
    if (['mp3', 'wav', 'mp4', 'webm'].includes(ext)) {
        items.push({ label: 'Media Player', icon: '🎵', action: () => openWindow('media_player', { args: { filePath } }) });
    }
    if (['txt', 'js', 'ts', 'py', 'c', 'rs', 'olic', 'json', 'html', 'css', 'md'].includes(ext)) {
        items.push({ label: 'Dev Studio', icon: '🧑‍💻', action: () => openWindow('dev_studio', { args: { filePath } }) });
    }
     if (['pepx'].includes(ext)) {
        items.push({ label: 'PEPx Editor', icon: '🔲', action: () => openWindow('pepx_editor', { args: { filePath } }) });
    }

    if (items.length > 0) {
        return { label: 'Send To', icon: '➡️', items };
    }
    return null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const iconPath = `${cwd}/${icon.name}`;
    
    const sendToMenuItem = getSendToMenuItem(iconPath);
    
    const menuItems: (ContextMenuItem|null)[] = [
        { label: 'Open', icon: '📂', action: () => openWindow(icon.appId) },
        sendToMenuItem,
        { separator: true },
        { label: 'Cut', icon: '✂️', action: () => copyToClipboard({ type: 'cut', path: iconPath }) },
        { label: 'Copy', icon: '📄', action: () => copyToClipboard({ type: 'copy', path: iconPath }) },
    ];
    showContextMenu(e.clientX, e.clientY, menuItems.filter(Boolean) as ContextMenuItem[]);
  }

  const mobileClasses = "static w-16 h-20";
  const desktopClasses = `absolute w-24`;
  
  const positionStyle = isMobile ? {} : { top: `${icon.position.y}px`, left: `${icon.position.x}px` };

  return (
    <div
      className={`desktop-icon flex flex-col items-center p-2 rounded cursor-pointer select-none transition-all ${isMobile ? mobileClasses : desktopClasses} ${isDropTarget ? 'bg-white/30' : 'hover:bg-white/10'} ${isCut ? 'opacity-50' : ''}`}
      style={positionStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={icon.name}
      draggable={!isMobile}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={onDrop}
    >
      <div className="text-3xl md:text-4xl mb-1 drop-shadow-lg pointer-events-none">{icon.icon}</div>
      <span className="text-xs text-center text-white break-words shadow-black [text-shadow:1px_1px_2px_var(--tw-shadow-color)] pointer-events-none">
        {icon.name}
      </span>
    </div>
  );
};

export default DesktopIcon;
