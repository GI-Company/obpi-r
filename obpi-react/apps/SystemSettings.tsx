import React, { useState, useEffect, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';
import { WALLPAPERS } from '../constants';
import { User, GoogleUser } from '../types';
import * as geminiService from '../services/geminiService';

declare global {
    interface Window {
        google: any;
    }
}

type SettingsSection = 'appearance' | 'ai_personalization' | 'connected_services' | 'users' | 'about';

const AppearanceSettings: React.FC = () => {
    const { theme, setTheme, wallpaper, setWallpaper } = useOS();

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Theme</h3>
                <div className="flex gap-4 p-2 bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                    <button onClick={() => setTheme('light')} className={`flex-1 py-2 rounded-md ${theme === 'light' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Light</button>
                    <button onClick={() => setTheme('dark')} className={`flex-1 py-2 rounded-md ${theme === 'dark' ? 'bg-white dark:bg-gray-900 shadow' : ''}`}>Dark</button>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-2">Wallpaper</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {WALLPAPERS.map(wp => (
                        <div key={wp.name} onClick={() => setWallpaper(wp.url)} className="cursor-pointer group">
                            <img src={wp.url} alt={wp.name} className={`w-full h-24 object-cover rounded-md border-2 ${wallpaper === wp.url ? 'border-obpi-accent' : 'border-transparent group-hover:border-obpi-accent/50'}`} />
                            <p className="text-sm text-center mt-1">{wp.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AIPersonalizationSettings: React.FC = () => {
    const { setWallpaper, setAccentColor, showNotification } = useOS();
    
    const [wallpaperPrompt, setWallpaperPrompt] = useState('');
    const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);
    
    const [accentPrompt, setAccentPrompt] = useState('');
    const [isAccentLoading, setIsAccentLoading] = useState(false);

    const handleGenerateWallpaper = async () => {
        if (!wallpaperPrompt.trim()) return;
        setIsWallpaperLoading(true);
        try {
            const base64Bytes = await geminiService.generateWallpaper(wallpaperPrompt);
            const imageUrl = `data:image/jpeg;base64,${base64Bytes}`;
            setWallpaper(imageUrl);
            showNotification({ icon: '🖼️', title: 'Wallpaper Set', message: 'Your new AI-generated wallpaper has been applied.' });
        } catch (e) {
            showNotification({ icon: '❌', title: 'Error', message: e instanceof Error ? e.message : 'Failed to generate wallpaper.' });
        } finally {
            setIsWallpaperLoading(false);
        }
    };

    const handleGenerateAccent = async () => {
        if (!accentPrompt.trim()) return;
        setIsAccentLoading(true);
        try {
            const color = await geminiService.getAccentColorFromPrompt(accentPrompt);
            setAccentColor(color);
            showNotification({ icon: '🎨', title: 'Accent Color Set', message: `Theme accent updated to ${color}.` });
        } catch (e) {
            showNotification({ icon: '❌', title: 'Error', message: e instanceof Error ? e.message : 'Failed to generate color.' });
        } finally {
            setIsAccentLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold mb-2">AI Generated Wallpaper</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Describe the wallpaper you want to see on your desktop.</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={wallpaperPrompt}
                        onChange={(e) => setWallpaperPrompt(e.target.value)}
                        placeholder="e.g., A serene cherry blossom forest at night"
                        className="flex-grow p-2 rounded bg-gray-200 dark:bg-gray-700/50"
                        disabled={isWallpaperLoading}
                    />
                    <button onClick={handleGenerateWallpaper} disabled={isWallpaperLoading || !wallpaperPrompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                        {isWallpaperLoading ? 'Generating...' : '✨ Generate'}
                    </button>
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold mb-2">AI Theme Accent Color</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Describe the color you want for your system's theme accent.</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={accentPrompt}
                        onChange={(e) => setAccentPrompt(e.target.value)}
                        placeholder="e.g., A deep ocean blue"
                        className="flex-grow p-2 rounded bg-gray-200 dark:bg-gray-700/50"
                        disabled={isAccentLoading}
                    />
                    <button onClick={handleGenerateAccent} disabled={isAccentLoading || !accentPrompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                        {isAccentLoading ? 'Generating...' : '✨ Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConnectedServicesSettings: React.FC = () => {
    const { googleUser, connectGoogleUser, disconnectGoogleUser, showNotification } = useOS();

    const handleGoogleSignIn = useCallback((response: any) => {
        try {
            const credential = response.credential;
            const payload = JSON.parse(atob(credential.split('.')[1]));
            const userProfile: GoogleUser = {
                name: payload.name,
                email: payload.email,
                picture: payload.picture,
            };
            connectGoogleUser(userProfile);
            showNotification({ icon: '✅', title: 'Google Account Connected', message: `Welcome, ${userProfile.name}!` });
        } catch (e) {
            console.error("Error decoding Google credential:", e);
            showNotification({ icon: '❌', title: 'Connection Failed', message: 'Could not process Google sign-in response.' });
        }
    }, [connectGoogleUser, showNotification]);

    useEffect(() => {
        if (!googleUser && window.google) {
            window.google.accounts.id.initialize({
                // IMPORTANT: Replace with your actual Google Cloud Client ID
                client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
                callback: handleGoogleSignIn,
            });
            window.google.accounts.id.renderButton(
                document.getElementById("google-signin-button"),
                { theme: "outline", size: "large" }
            );
        }
    }, [googleUser, handleGoogleSignIn]);

    const handleDisconnect = () => {
        disconnectGoogleUser();
        showNotification({ icon: '🔌', title: 'Disconnected', message: 'Your Google Account has been disconnected.' });
    };

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4">Connected Services</h3>
            <div className="p-4 bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                {googleUser ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={googleUser.picture} alt={googleUser.name} className="w-10 h-10 rounded-full"/>
                            <div>
                                <p className="font-semibold">{googleUser.name}</p>
                                <p className="text-xs text-gray-500">{googleUser.email}</p>
                            </div>
                        </div>
                        <button onClick={handleDisconnect} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Disconnect</button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-sm text-center">Connect your Google Account to personalize your experience.</p>
                        <div id="google-signin-button"></div>
                        <p className="text-xs text-gray-500 mt-2 italic">This will only access your basic profile information (name, email, avatar).</p>
                    </div>
                )}
            </div>
             <p className="text-xs text-gray-500 mt-2 italic">
                AI-powered features like Google Drive and Calendar Sync will use your connected name to generate more personalized simulated data.
            </p>
        </div>
    );
};


const AboutSettings: React.FC = () => {
    return (
        <div>
            <h3 className="text-lg font-semibold mb-2">About OBPI React Desktop</h3>
            <div className="space-y-2 text-sm p-4 bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                <p><strong>Version:</strong> 2.2.0 "Sirius"</p>
                <p><strong>Kernel:</strong> Gemini AI Integrated</p>
                <p>A multi-user, role-based virtual desktop environment running in the browser.</p>
            </div>
        </div>
    );
};

const UserSettings: React.FC = () => {
    const { getUsers, createUser, deleteUser, currentUser, showModal, showNotification } = useOS();
    const [users, setUsers] = useState<User[]>([]);

    const refreshUsers = useCallback(() => setUsers(getUsers()), [getUsers]);

    useEffect(() => {
        refreshUsers();
    }, [refreshUsers]);

    const handleCreateUser = () => {
        const modalContent = (
            <div className="space-y-3 text-sm">
                <input id="new-username" type="text" placeholder="Username" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
                <input id="new-password" type="password" placeholder="Password (optional)" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
                <select id="new-role" className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
                    <option value="Standard">Standard</option>
                    <option value="Limited">Limited</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
        );
        showModal('Create New User', modalContent, [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            { text: 'Create', type: 'primary', onClick: () => {
                const username = (document.getElementById('new-username') as HTMLInputElement).value;
                const password = (document.getElementById('new-password') as HTMLInputElement).value;
                const role = (document.getElementById('new-role') as HTMLSelectElement).value as User['role'];
                if (username && createUser(username, password, role)) {
                    showNotification({ icon: '👤', title: 'User Created', message: `Account for ${username} was successfully created.` });
                    refreshUsers();
                } else {
                    showNotification({ icon: '❌', title: 'Creation Failed', message: `Username "${username}" might already exist.` });
                }
            }}
        ]);
    };

    const handleDeleteUser = (user: User) => {
        showModal('Confirm Deletion', `Are you sure you want to delete the user "${user.username}"? This action cannot be undone.`, [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            { text: 'Delete', type: 'danger', onClick: () => {
                if (deleteUser(user.id)) {
                    showNotification({ icon: '🗑️', title: 'User Deleted', message: `Account for ${user.username} has been removed.` });
                    refreshUsers();
                } else {
                     showNotification({ icon: '❌', title: 'Deletion Failed', message: `Could not delete ${user.username}.` });
                }
            }}
        ]);
    };

    const isAdmin = currentUser?.role === 'Admin';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">User Accounts</h3>
                {isAdmin && <button onClick={handleCreateUser} className="px-3 py-1 bg-obpi-accent text-white rounded text-sm">Create User</button>}
            </div>
            <div className="space-y-2 p-3 bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800/50 rounded">
                        <div className="flex items-center gap-3">
                            <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
                            <div>
                                <p className="font-semibold">{user.username} {user.id === currentUser?.id && '(You)'}</p>
                                <p className="text-xs text-gray-500">{user.role}</p>
                            </div>
                        </div>
                        {isAdmin && user.id !== currentUser?.id && (
                            <button onClick={() => handleDeleteUser(user)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                        )}
                    </div>
                ))}
            </div>
             {!isAdmin && <p className="text-xs text-gray-500 italic">You must be an administrator to manage users.</p>}
        </div>
    );
};


const SystemSettings: React.FC = () => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

    const sections: { id: SettingsSection, name: string, icon: string, component: React.FC, disabled?: boolean }[] = [
        { id: 'appearance', name: 'Appearance', icon: '🎨', component: AppearanceSettings },
        { id: 'ai_personalization', name: 'AI Personalization', icon: '✨', component: AIPersonalizationSettings },
        { id: 'connected_services', name: 'Services', icon: '☁️', component: ConnectedServicesSettings },
        { id: 'users', name: 'Users', icon: '👥', component: UserSettings },
        { id: 'about', name: 'About', icon: 'ℹ️', component: AboutSettings },
    ];

    const ActiveComponent = sections.find(s => s.id === activeSection)?.component || (() => null);

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Sidebar */}
            <div className="w-1/3 max-w-[180px] p-2 bg-gray-200/50 dark:bg-gray-900/50 space-y-1">
                {sections.map(section => (
                    <button 
                        key={section.id} 
                        onClick={() => !section.disabled && setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 p-2 text-left rounded-md text-sm ${activeSection === section.id ? 'bg-obpi-accent text-white' : 'hover:bg-gray-300 dark:hover:bg-gray-700'} ${section.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={section.disabled}
                    >
                        <span>{section.icon}</span>
                        <span>{section.name}</span>
                    </button>
                ))}
            </div>
            {/* Content */}
            <div className="flex-grow p-6 overflow-y-auto">
                <ActiveComponent />
            </div>
        </div>
    );
};

export default SystemSettings;