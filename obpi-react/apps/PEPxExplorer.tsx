
import React, { useState, useEffect, FC, useRef } from 'react';
import { useOS } from '../contexts/OSContext';
import { FSNode, DraggableItem, ContextMenuItem, SimulatedFile } from '../types';
import * as geminiService from '../services/geminiService';
import { VFS } from '../services/VFS';

const getFileIcon = (node: FSNode | SimulatedFile, name: string): string => {
    if (node.type === 'dir') return '📁';
    if (name === 'makefile.om') return '🧱';
    if (name.endsWith('.pepx')) return '🔲';

    const mimeType = (node as SimulatedFile).mimeType;
    if(mimeType) {
        switch(mimeType) {
            case 'document': return '📄';
            case 'spreadsheet': return '📊';
            case 'presentation': return '🖼️';
            case 'image': return '🏞️';
            case 'pdf': return '📕';
            case 'folder': return '📁';
        }
    }

    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'txt': return '📄';
        case 'py': return '🐍';
        case 'c': case 'cpp': return '🇨';
        case 'rs': return '🦀';
        case 'wasm': return '📦';
        case 'json': return '📝';
        case 'js': case 'jsx': case 'ts': case 'tsx': return '📜';
        case 'html': return '🌐';
        case 'css': return '🎨';
        case 'gz': return '📦';
        case 'png': case 'jpg': case 'jpeg': case 'gif': return '🏞️';
        case 'mp3': case 'wav': return '🎵';
        case 'mp4': case 'webm': return '🎬';
        case 'exe': return '🚀';
        case 'olic': return '🧠';
        default: return '❓';
    }
}

const UploadProgressIndicator: FC<{ file: File; reader: FileReader }> = ({ file, reader }) => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Waiting...');

    useEffect(() => {
        const onProgress = (e: ProgressEvent) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                setProgress(percent);
                setStatus(percent === 100 ? 'Processing...' : 'Uploading...');
            }
        };
        const onLoad = () => { setProgress(100); setStatus('Complete!'); };
        const onError = () => { setStatus('Upload Failed!'); setProgress(0); };

        reader.addEventListener('progress', onProgress);
        reader.addEventListener('load', onLoad);
        reader.addEventListener('error', onError);

        reader.readAsDataURL(file);

        return () => {
            reader.removeEventListener('progress', onProgress);
            reader.removeEventListener('load', onLoad);
            reader.removeEventListener('error', onError);
        };
    }, [reader, file]);

    return (
        <div>
            <p className="mb-2 text-sm">Uploading: <span className="font-semibold font-mono break-all">{file.name}</span></p>
            <p className="text-xs mb-2 text-gray-600 dark:text-gray-400">Size: { (file.size / 1024).toFixed(2) } KB</p>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3"><div className="bg-obpi-accent h-3 rounded-full transition-all" style={{ width: `${progress}%` }}></div></div>
            <p className="text-right text-xs mt-1 font-mono">{status}</p>
        </div>
    );
};

const PEPxExplorer: React.FC = () => {
  // FIX: Destructured async methods and removed obsolete 'vfs' and 'deleteFile'
  const { showModal, hideModal, fsRevision, updateFs, showContextMenu, trashFile, openWindow, createFile, startDrag, draggedItem, moveFile, clipboardItem, copyToClipboard, pasteFromClipboard, showNotification, cwd, googleUser, writeFile, listDirectory, createDirectory } = useOS();

  // Local VFS State
  const [localPath, setLocalPath] = useState(cwd);
  const [localItems, setLocalItems] = useState<[string, FSNode][]>([]);
  
  // View State
  const [view, setView] = useState<'local' | 'gdrive'>('local');
  const [isLoading, setIsLoading] = useState(false);
  
  // Simulated Google Drive State
  const [gdriveRoot, setGdriveRoot] = useState<SimulatedFile[]>([]);
  const [gdrivePath, setGdrivePath] = useState<string[]>([]);

  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Data Fetching Effects ---

  // FIX: Refactored to use async listDirectory from context
  useEffect(() => {
    if (view === 'local') {
        const fetchLocalItems = async () => {
            const children = await listDirectory(localPath);
            if (children) {
                setLocalItems(Object.entries(children).sort((a,b) => {
                     if (a[1].type === 'dir' && b[1].type !== 'dir') return -1;
                     if (a[1].type !== 'dir' && b[1].type === 'dir') return 1;
                     return a[0].localeCompare(b[0]);
                }));
            } else { setLocalPath('/'); }
        };
        fetchLocalItems();
    }
  }, [localPath, fsRevision, view, listDirectory]);

  const loadGdriveFiles = async () => {
    if (gdriveRoot.length > 0) return; // Already loaded
    setIsLoading(true);
    try {
        const files = await geminiService.simulateGoogleDriveFiles(googleUser?.name);
        setGdriveRoot(files);
    } catch (e) {
        showNotification({icon: '❌', title: 'Google Drive Error', message: e instanceof Error ? e.message : 'Could not load simulated files.'});
    } finally {
        setIsLoading(false);
    }
  };
  
  const currentGdriveItems = gdrivePath.reduce((acc, part) => acc.find(item => item.name === part && item.type === 'dir')?.children || [], gdriveRoot);

  // --- Navigation Handlers ---
  
  const navigateLocalUp = () => {
    if (localPath === '/') return;
    const newPath = localPath.substring(0, localPath.lastIndexOf('/')) || '/';
    setLocalPath(newPath);
  };
  
  const navigateGdriveUp = () => {
      setGdrivePath(prev => prev.slice(0, -1));
  };
  
  // --- Item Interaction Handlers ---

  const handleLocalItemDoubleClick = (name: string, node: FSNode) => {
    const newPath = VFS.resolvePath(name, localPath);
    if (node.type === 'dir') {
        setLocalPath(newPath);
    } else {
        const extension = name.split('.').pop()?.toLowerCase() || '';
        switch (extension) {
            case 'exe': case 'wasm': openWindow('terminal', { title: `Executing ${name}`, args: { initialCommand: newPath } }); break;
            case 'pepx': openWindow('pepx_editor', { args: { filePath: newPath } }); break;
            case 'png': case 'jpg': case 'jpeg': case 'gif': openWindow('gallery', { args: { filePath: newPath } }); break;
            case 'mp3': case 'wav': case 'mp4': case 'webm': openWindow('media_player', { args: { filePath: newPath } }); break;
            default: openWindow('dev_studio', { args: { filePath: newPath } }); break;
        }
    }
  };
  
  const handleGdriveItemDoubleClick = async (item: SimulatedFile) => {
    if (item.type === 'dir') {
        setGdrivePath(prev => [...prev, item.name]);
        return;
    }
    
    setIsLoading(true);
    try {
        if (item.mimeType === 'image') {
            const prompt = await geminiService.generateFileContentFromPrompt(item.name, 'image');
            openWindow('gemini_studio', { 
                args: { initialTab: 'generateImage', initialPrompt: prompt },
                title: `Generate: ${item.name}`
            });
        } else {
            const content = await geminiService.generateFileContentFromPrompt(item.name, item.mimeType || 'document');
            openWindow('pepx_editor', {
                title: item.name,
                content: <pre className="p-4 whitespace-pre-wrap font-sans">{content}</pre>
            });
        }
    } catch(e) {
         showNotification({icon: '❌', title: 'Error', message: e instanceof Error ? e.message : 'Could not generate file content.'});
    } finally {
        setIsLoading(false);
    }
  };
  
  // --- UI Action Handlers ---
  
  const handleUploadClick = () => {
    if (view !== 'local') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            const content = new Uint8Array(reader.result as ArrayBuffer);
            await writeFile(VFS.resolvePath(file.name, localPath), content);
            setTimeout(hideModal, 1200); 
        };
        showModal('File Upload Progress', <UploadProgressIndicator file={file} reader={reader} />, [{ text: 'Cancel', type: 'secondary', onClick: hideModal }]);
    };
    input.click();
  };

  const createNewFile = async () => {
    let fileName = 'new_file.txt';
    let counter = 1;
    const existingItems = await listDirectory(localPath);
    while(existingItems && existingItems[fileName]) {
      fileName = `new_file (${counter++}).txt`;
    }
    await createFile(VFS.resolvePath(fileName, localPath));
  };
  
  const createNewFolder = async () => {
    let dirName = 'New Folder';
    let counter = 1;
    const existingItems = await listDirectory(localPath);
    while(existingItems && existingItems[dirName]) {
      dirName = `New Folder (${counter++})`;
    }
    await createDirectory(VFS.resolvePath(dirName, localPath));
  };
  
  const handleRename = (path: string, oldName: string) => {
    showModal('Rename Item',
        <input id="rename-input-explorer" type="text" defaultValue={oldName} className="font-mono p-2 rounded bg-gray-100 dark:bg-gray-700 w-full" />,
        [{ text: 'Rename', type: 'primary', onClick: () => {
            const newName = (document.getElementById('rename-input-explorer') as HTMLInputElement).value;
            if (newName && newName !== oldName) {
                const parentDir = path.substring(0, path.lastIndexOf('/')) || '/';
                const newPath = `${parentDir === '/' ? '' : parentDir}/${newName}`;
                moveFile(path, newPath);
            }
        }}]
    );
  };

  // --- Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, name: string, node: FSNode) => {
    const dragItem: DraggableItem = { type: 'file', id: VFS.resolvePath(name, localPath), path: VFS.resolvePath(name, localPath), name, icon: getFileIcon(node, name) };
    startDrag(dragItem, e);
  };
  
  const handleDragOver = (e: React.DragEvent, name: string, node: FSNode) => {
    e.preventDefault();
    if (node.type === 'dir' && draggedItem?.path !== VFS.resolvePath(name, localPath)) {
        setDropTarget(name);
    }
  };
  
  const handleDrop = (e: React.DragEvent, name: string, node: FSNode) => {
    e.preventDefault();
    setDropTarget(null);
    if (draggedItem?.type === 'file' && draggedItem.path && node.type === 'dir') {
        const newPath = VFS.resolvePath(`${name}/${draggedItem.name}`, localPath);
        moveFile(draggedItem.path, newPath);
    }
  };

  // --- Context Menus ---
  const getSendToMenuItem = (filePath: string): ContextMenuItem | null => {
    // ... same implementation ...
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
  
  const handleContextMenu = (e: React.MouseEvent, name?: string, node?: FSNode) => {
    e.preventDefault(); e.stopPropagation();
    if (view !== 'local') return; // Context menus only for local files for now

    let menuItems: ContextMenuItem[] = [];
    if (name && node) {
        const path = VFS.resolvePath(name, localPath);
        const sendToMenuItem = getSendToMenuItem(path);
        const specificItems: (ContextMenuItem | null)[] = [
            { label: 'Open', icon: '📂', action: () => handleLocalItemDoubleClick(name, node) }, sendToMenuItem, { separator: true },
            { label: 'Cut', icon: '✂️', action: () => copyToClipboard({ type: 'cut', path }) },
            { label: 'Copy', icon: '📄', action: () => copyToClipboard({ type: 'copy', path }) },
            { label: 'Rename', icon: '✏️', action: () => handleRename(path, name) }, { separator: true },
            // FIX: Replaced deleteFile with trashFile
            { label: 'Delete', icon: '🗑️', action: () => { if (trashFile(path)) showNotification({ icon: '🗑️', title: 'File Deleted', message: `"${name}" moved to Recycle Bin.` }); }}
        ];
        menuItems.push(...specificItems.filter((item): item is ContextMenuItem => item !== null));
    } else {
        menuItems.push(
            { label: 'New Folder', icon: '📁', action: createNewFolder },
            { label: 'New File', icon: '📄', action: createNewFile },
        );
        if (clipboardItem) menuItems.push({ label: 'Paste', icon: '📋', action: () => pasteFromClipboard(localPath) });
        menuItems.push({ separator: true }, { label: 'Refresh', icon: '🔄', action: updateFs });
    }
    showContextMenu(e.clientX, e.clientY, menuItems);
  };
  
  const currentPathForDisplay = view === 'local' ? localPath : `gdrive:/${gdrivePath.join('/')}`;

  return (
    <div className="flex h-full bg-gray-100/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100" onContextMenu={handleContextMenu}>
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 bg-gray-200/50 dark:bg-gray-900/50 p-2 space-y-2">
            <button onClick={() => setView('local')} className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 ${view === 'local' ? 'bg-obpi-accent/80 text-white' : 'hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                🖥️ My Computer
            </button>
            <button onClick={() => { setView('gdrive'); loadGdriveFiles(); }} className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 ${view === 'gdrive' ? 'bg-obpi-accent/80 text-white' : 'hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                ☁️ Google Drive
            </button>
        </div>
      
        {/* Main Content */}
        <div className="flex flex-col flex-grow min-w-0">
          <div className="flex-shrink-0 p-2 border-b border-l border-glass-border-light dark:border-glass-border-dark flex items-center gap-2">
            <button onClick={view === 'local' ? navigateLocalUp : navigateGdriveUp} title="Up" className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded disabled:opacity-50" disabled={view === 'local' ? localPath === '/' : gdrivePath.length === 0}>⬆️</button>
            <input type="text" readOnly value={currentPathForDisplay} className="flex-grow p-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm font-mono" />
            <button onClick={handleUploadClick} disabled={view !== 'local'} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-400">Upload</button>
          </div>
          
          <div className="flex-grow p-1 sm:p-2 md:p-4 overflow-y-auto relative">
            {isLoading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 text-white">Loading...</div>}
            
            {/* Grid View */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1 sm:gap-4">
                {view === 'local' && localItems.map(([name, node]) => {
                    const path = VFS.resolvePath(name, localPath);
                    const isCut = clipboardItem?.type === 'cut' && clipboardItem.path === path;
                    return (
                        <div key={name} className={`flex flex-col items-center p-1 rounded cursor-pointer transition-all ${dropTarget === name ? 'bg-blue-500/50' : 'hover:bg-blue-100 dark:hover:bg-blue-900/50'} ${isCut ? 'opacity-50' : ''}`}
                            draggable onDragStart={(e) => handleDragStart(e, name, node)} onDragOver={(e) => handleDragOver(e, name, node)} onDragLeave={() => setDropTarget(null)} onDrop={(e) => handleDrop(e, name, node)}
                            onDoubleClick={() => handleLocalItemDoubleClick(name, node)} onContextMenu={(e) => handleContextMenu(e, name, node)} title={name}
                        >
                            <span className="text-3xl sm:text-4xl pointer-events-none">{getFileIcon(node, name)}</span>
                            <span className="text-[10px] sm:text-xs text-center break-all pointer-events-none">{name}</span>
                        </div>
                    )
                })}
                
                {view === 'gdrive' && currentGdriveItems.map((item) => (
                     <div key={item.name} className="flex flex-col items-center p-1 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        onDoubleClick={() => handleGdriveItemDoubleClick(item)} title={item.name}
                    >
                        <span className="text-3xl sm:text-4xl pointer-events-none">{getFileIcon(item, item.name)}</span>
                        <span className="text-[10px] sm:text-xs text-center break-all pointer-events-none">{item.name}</span>
                    </div>
                ))}
            </div>
          </div>
          
          <div className="flex-shrink-0 p-1 border-t border-l border-glass-border-light dark:border-glass-border-dark text-xs text-center">
             {view === 'local' ? localItems.length : currentGdriveItems.length} items
          </div>
        </div>
    </div>
  );
};

export default PEPxExplorer;
