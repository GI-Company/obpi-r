
import React, { useState, useEffect } from 'react';
import { useOS } from '../contexts/OSContext';
import { TrashedFile } from '../types';

const RecycleBin: React.FC = () => {
    // FIX: Destructure async methods from useOS and remove vfs
    const { updateFs, fsRevision, showNotification, listTrash, restoreFile, permanentlyDeleteFile, emptyTrash } = useOS();
    const [trashedItems, setTrashedItems] = useState<TrashedFile[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    useEffect(() => {
        // FIX: Use async listTrash and handle promise
        const fetchTrashItems = async () => {
            const items = await listTrash();
            setTrashedItems(items.sort((a, b) => new Date(b.deletedDate).getTime() - new Date(a.deletedDate).getTime()));
        };
        fetchTrashItems();
    }, [listTrash, fsRevision]);

    const toggleSelection = (id: number) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleRestore = async () => {
        let restoredCount = 0;
        for (const id of selectedItems) {
            if (await restoreFile(id)) restoredCount++;
        }

        if (restoredCount > 0) {
            showNotification({ icon: '🔄', title: 'Items Restored', message: `${restoredCount} item(s) have been restored.` });
        }
        setSelectedItems(new Set());
    };

    const handlePermanentDelete = async () => {
        if (window.confirm(`Are you sure you want to permanently delete ${selectedItems.size} item(s)? This action cannot be undone.`)) {
            let deletedCount = 0;
            for (const id of selectedItems) {
                if (await permanentlyDeleteFile(id)) deletedCount++;
            }
            
            if (deletedCount > 0) {
                showNotification({ icon: '💥', title: 'Items Deleted', message: `${deletedCount} item(s) permanently deleted.` });
            }
            setSelectedItems(new Set());
        }
    };
    
    const handleEmptyTrash = async () => {
         if (window.confirm(`Are you sure you want to empty the Recycle Bin? All items will be permanently deleted.`)) {
            if (await emptyTrash()) {
                 showNotification({ icon: '💥', title: 'Recycle Bin Emptied', message: `All items permanently deleted.` });
            }
            setSelectedItems(new Set());
         }
    }

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Toolbar */}
            <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-700 flex items-center flex-wrap gap-2">
                <button 
                    onClick={handleRestore} 
                    disabled={selectedItems.size === 0}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Restore Selected
                </button>
                 <button 
                    onClick={handlePermanentDelete} 
                    disabled={selectedItems.size === 0}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Delete Permanently
                </button>
                <div className="flex-grow" />
                <button 
                    onClick={handleEmptyTrash}
                    disabled={trashedItems.length === 0}
                    className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Empty Bin
                </button>
            </div>
            
            {/* Content Area */}
            <div className="flex-grow overflow-y-auto">
                 {trashedItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        The Recycle Bin is empty.
                    </div>
                ) : (
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Name</th>
                            <th className="p-2 hidden md:table-cell">Original Location</th>
                            <th className="p-2">Date Deleted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trashedItems.map(item => (
                            <tr 
                                key={item.id} 
                                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 ${selectedItems.has(parseInt(item.id)) ? 'bg-blue-200 dark:bg-blue-800/60' : ''}`}
                                onClick={() => toggleSelection(parseInt(item.id))}
                            >
                                <td className="p-2 text-center"><input type="checkbox" checked={selectedItems.has(parseInt(item.id))} readOnly className="pointer-events-none" /></td>
                                <td className="p-2 font-mono">{item.name}</td>
                                <td className="p-2 font-mono hidden md:table-cell">{item.originalPath.substring(0, item.originalPath.lastIndexOf('/')) || '/'}</td>
                                <td className="p-2">{new Date(item.deletedDate).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </div>

            {/* Status Bar */}
            <div className="flex-shrink-0 p-1 border-t border-gray-300 dark:border-gray-700 text-xs text-center">
                {trashedItems.length} items | {selectedItems.size} selected
            </div>
        </div>
    );
};

export default RecycleBin;
