
import React, { useState, useEffect, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';

const SnapshotManager: React.FC = () => {
    // FIX: Destructure snapshot methods from useOS context
    const { createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot, showModal, showNotification } = useOS();
    const [snapshots, setSnapshots] = useState<{ name: string; date: string; description: string }[]>([]);

    const refreshSnapshots = useCallback(() => {
        setSnapshots(listSnapshots());
    }, [listSnapshots]);

    useEffect(() => {
        refreshSnapshots();
    }, [refreshSnapshots]);

    const handleCreate = () => {
        const modalContent = (
            <div className="space-y-3 text-sm">
                <input id="snapshot-name" type="text" placeholder="Snapshot Name (e.g., 'before-refactor')" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 font-mono" autoFocus />
                <textarea id="snapshot-description" placeholder="Description (optional)" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 font-mono" rows={3}></textarea>
            </div>
        );

        showModal('Create New Snapshot', modalContent, [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            {
                text: 'Create',
                type: 'primary',
                onClick: () => {
                    const name = (document.getElementById('snapshot-name') as HTMLInputElement).value;
                    const description = (document.getElementById('snapshot-description') as HTMLTextAreaElement).value;

                    if (!name.trim()) {
                        showNotification({ icon: '❌', title: 'Error', message: 'Snapshot name cannot be empty.' });
                        return;
                    }

                    if (createSnapshot(name.trim(), description.trim())) {
                        showNotification({ icon: '✅', title: 'Snapshot Created', message: `Snapshot "${name.trim()}" saved.` });
                        refreshSnapshots();
                    } else {
                        showNotification({ icon: '❌', title: 'Error', message: 'A snapshot with that name already exists.' });
                    }
                },
            },
        ]);
    };

    const handleRestore = (name: string) => {
        showModal(
            'Confirm Restore',
            `Are you sure you want to restore the snapshot "${name}"? This will overwrite the entire current file system and the OS will reboot.`,
            [
                { text: 'Cancel', type: 'secondary', onClick: () => {} },
                {
                    text: 'Restore & Reboot',
                    type: 'primary',
                    onClick: () => {
                        if (restoreSnapshot(name)) {
                            showNotification({ icon: '🔄', title: 'System Restoring...', message: `Restored from "${name}". Rebooting now.` });
                            // Wait a moment for the notification to be visible, then reboot
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        } else {
                            showNotification({ icon: '❌', title: 'Restore Failed', message: 'Could not restore the snapshot.' });
                        }
                    },
                },
            ]
        );
    };

    const handleDelete = (name: string) => {
        showModal(
            'Confirm Deletion',
            `Are you sure you want to permanently delete the snapshot "${name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', type: 'secondary', onClick: () => {} },
                {
                    text: 'Delete',
                    type: 'danger',
                    onClick: () => {
                        if (deleteSnapshot(name)) {
                            showNotification({ icon: '🗑️', title: 'Snapshot Deleted', message: `Snapshot "${name}" has been deleted.` });
                            refreshSnapshots();
                        } else {
                            showNotification({ icon: '❌', title: 'Deletion Failed', message: 'Could not delete the snapshot.' });
                        }
                    },
                },
            ]
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex-shrink-0 p-3 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-lg">💾 VFS Snapshot Manager</h3>
                <button onClick={handleCreate} className="px-4 py-2 bg-obpi-accent text-white rounded text-sm hover:bg-obpi-accent-darker">
                    Create New Snapshot
                </button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {snapshots.length === 0 ? (
                    <p className="p-4 text-center text-gray-500">No snapshots saved.</p>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-200 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="p-2 w-1/3">Name</th>
                                <th className="p-2 w-1/3">Description</th>
                                <th className="p-2">Date Created</th>
                                <th className="p-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((snapshot) => (
                                <tr key={snapshot.name} className="border-b border-gray-200 dark:border-gray-700">
                                    <td className="p-2 font-mono font-semibold">{snapshot.name}</td>
                                    <td className="p-2 text-gray-600 dark:text-gray-400 italic truncate" title={snapshot.description}>
                                        {snapshot.description || '-'}
                                    </td>
                                    <td className="p-2">{new Date(snapshot.date).toLocaleString()}</td>
                                    <td className="p-2 text-right space-x-2">
                                        <button onClick={() => handleRestore(snapshot.name)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Restore</button>
                                        <button onClick={() => handleDelete(snapshot.name)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SnapshotManager;
