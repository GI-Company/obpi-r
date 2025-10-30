
import React, { useRef, useState } from 'react';
import { useOS } from '../contexts/OSContext';
import Window from './Window';
import DesktopIcon from './DesktopIcon';
import { APPS } from '../constants';
import { AppDefinition, DraggableItem, ContextMenuItem } from '../types';
import { VFS } from '../services/VFS';

const Desktop: React.FC = () => {
  // FIX: Removed `vfs`, added `writeFile` and `createDirectory`.
  const { windows, desktopIcons, showContextMenu, hideContextMenu, createFile, openWindow, updateFs, draggedItem, moveFile, clipboardItem, pasteFromClipboard, cwd, writeFile, createDirectory, listDirectory } = useOS();
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // FIX: Made function async and use new file creation flow.
  const handleCreateFile = async (extension: string, defaultContent: string, appId: string) => {
    const desktopPath = cwd;
    const baseName = `new_file.${extension}`;
    let finalName = baseName;
    let counter = 1;
    const existingItems = await listDirectory(desktopPath);
    while (existingItems && existingItems[finalName]) {
        finalName = `new_file (${counter++}).${extension}`;
    }
    const fullPath = VFS.resolvePath(finalName, desktopPath);
    if(await createFile(fullPath)){
      if (defaultContent) {
        await writeFile(fullPath, defaultContent);
      }
      openWindow(appId, { args: { filePath: fullPath } });
    }
  };

  const handleCreateFolder = async () => {
    const desktopPath = cwd;
    let dirName = 'New Folder';
    let counter = 1;
    const existingItems = await listDirectory(desktopPath);
    while (existingItems && existingItems[dirName]) {
      dirName = `New Folder (${counter++})`;
    }
    // FIX: Use createDirectory from useOS hook.
    await createDirectory(VFS.resolvePath(dirName, desktopPath));
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuItems: ContextMenuItem[] = [
      { label: 'New Folder', icon: '📁', action: handleCreateFolder },
      { label: 'New Text File', icon: '📄', action: () => handleCreateFile('txt', '', 'dev_studio') },
    ];
    
    if (clipboardItem) {
        menuItems.push({ label: 'Paste', icon: '📋', action: () => pasteFromClipboard(cwd) });
    }

    menuItems.push(
      { separator: true },
      { label: 'New OLang File', icon: '🧠', action: () => handleCreateFile('olic', 'func main() {\n    print("Hello, OLang!");\n}', 'dev_studio') },
      { label: 'New Python Script', icon: '🐍', action: () => handleCreateFile('py', 'print("Hello, Python!")', 'dev_studio') },
      { separator: true },
      { label: 'Open Terminal', icon: '🖥️', action: () => openWindow('terminal') },
      { label: 'Change Background', icon: '🖼️', action: () => openWindow('system_settings') },
    );

    showContextMenu(e.clientX, e.clientY, menuItems);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
     if ((e.target as HTMLElement).closest('.desktop-icon, .os-window')) return;
     touchHoldTimer.current = setTimeout(() => {
        const touch = e.touches[0];
        const menuItems: ContextMenuItem[] = [
            { label: 'New Folder', icon: '📁', action: handleCreateFolder },
            { label: 'New Text File', icon: '📄', action: () => handleCreateFile('txt', '', 'dev_studio') },
        ];
        showContextMenu(touch.clientX, touch.clientY, menuItems);
        touchHoldTimer.current = null;
    }, 700);
  };

  const clearTouchTimer = () => {
    if (touchHoldTimer.current) {
      clearTimeout(touchHoldTimer.current);
      touchHoldTimer.current = null;
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem?.type === 'file') {
      setIsDropTarget(true);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (draggedItem?.type === 'file' && draggedItem.path) {
      const newPath = `${cwd}/${draggedItem.name}`;
      moveFile(draggedItem.path, newPath);
    }
  };

  return (
    <div
      id="desktop"
      className={`w-full h-full p-2 md:p-5 transition-colors ${isDropTarget ? 'bg-white/20' : ''}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearTouchTimer}
      onTouchMove={clearTouchTimer}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
            hideContextMenu();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={handleDrop}
    >
      {/* Desktop Icons - responsive layout */}
      <div className="relative w-full h-full">
        {/* Mobile/Tablet layout: Flex column */}
        <div className="md:hidden flex flex-col flex-wrap h-full content-start gap-y-2">
            {desktopIcons.map(icon => (
              <DesktopIcon key={icon.id} icon={icon} />
            ))}
        </div>
        {/* Desktop layout: Absolute positioning */}
        <div className="hidden md:block">
            {desktopIcons.map(icon => (
            <DesktopIcon key={icon.id} icon={icon} />
            ))}
        </div>
      </div>

      {/* Windows */}
      {windows.map(win => {
        if (win.isMinimized) return null;
        
        const app = APPS.find(a => a.id === win.appId) as AppDefinition | undefined;
        if (!app) return null;

        const ContentComponent = win.content ? () => <>{win.content}</> : app.component;

        return (
          <Window key={win.id} instance={win}>
            <ContentComponent {...win.args} />
          </Window>
        );
      })}
    </div>
  );
};

export default Desktop;
