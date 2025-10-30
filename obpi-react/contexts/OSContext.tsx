
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useReducer } from 'react';
// FIX: Import FSNode
import type { WindowInstance, AppId, DesktopIconType, ContextMenuState, ModalState, ContextMenuItem, ModalAction, DeviceType, DraggableItem, User, Notification, ClipboardItem, EnvVars, GoogleUser, TrashedFile, FSNode } from '../types';
import { APPS, DEFAULT_ICONS, LOCAL_STORAGE_KEYS, WALLPAPERS, TASKBAR_HEIGHT, getUserIconsKey, getUserWindowsKey, getUserPinnedAppsKey, DEFAULT_PINNED_APPS, getUserSettingsKey } from '../constants';
import { CommandInterpreter } from '../services/commandInterpreter';
import { AIKernel } from '../services/kernelService';
import { VFS } from '../services/VFS';
import { AuthService } from '../services/authService';
import { FirmwareService } from '../services/firmwareService';
import { ApiService, ConnectionStatus } from '../services/apiService';
import { v4 as uuidv4 } from 'uuid';
import { PEPxService } from '../services/pepxService';

// --- SERVICE INSTANCES (SINGLETONS) ---
const apiService = new ApiService();
const authService = new AuthService(apiService);
const commandInterpreter = new CommandInterpreter();
const aiKernel = new AIKernel();
const firmwareService = new FirmwareService();
const pepxService = new PEPxService();


export interface OSContextType {
  isInitialized: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  lock: () => void;
  getUsers: () => User[];
  createUser: (username: string, password?: string, role?: User['role']) => boolean;
  deleteUser: (userId: string) => boolean;

  windows: WindowInstance[];
  openWindow: (appId: AppId, args?: { title?: string, content?: React.ReactNode, args?: Record<string, any>, size?: { width: number, height: number } }) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  moveWindow: (id: string, newPosition: { x: number; y: number }) => void;
  resizeWindow: (id: string, newSize: { width: number; height: number }) => void;

  desktopIcons: DesktopIconType[];
  setDesktopIcons: (icons: DesktopIconType[]) => void;
  moveIcon: (id: string, position: { x: number, y: number }) => void;

  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  wallpaper: string;
  setWallpaper: (url: string) => void;
  volume: number;
  setVolume: (level: number) => void;
  brightness: number;
  setBrightness: (level: number) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  deviceType: DeviceType;
  envVars: EnvVars;

  fsRevision: number;
  updateFs: () => void;
  // --- ASYNC VFS METHODS ---
  createFile: (path: string) => Promise<boolean>;
  createDirectory: (path: string) => Promise<boolean>;
  writeFile: (path: string, content: string | Uint8Array) => Promise<boolean>;
  readFile: (path: string) => Promise<string | Uint8Array | null>;
  // FIX: Update listDirectory to return an object to match component usage.
  listDirectory: (path: string) => Promise<{ [key: string]: FSNode } | null>;
  trashFile: (path: string) => Promise<boolean>;
  moveFile: (oldPath: string, newPath: string) => Promise<boolean>;
  listTrash: () => Promise<TrashedFile[]>;
  restoreFile: (id: number) => Promise<boolean>;
  permanentlyDeleteFile: (id: number) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
  
  cwd: string;
  setCwd: React.Dispatch<React.SetStateAction<string>>;
  apiStatus: ConnectionStatus;
  // FIX: Expose apiService for Terminal event listeners
  apiService: ApiService;

  contextMenu: ContextMenuState;
  showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  hideContextMenu: () => void;
  
  modal: ModalState;
  showModal: (title: string, content: React.ReactNode, actions: ModalAction[]) => void;
  hideModal: () => void;

  commandInterpreter: CommandInterpreter;
  aiKernel: AIKernel;
  firmwareService: FirmwareService;
  
  draggedItem: DraggableItem | null;
  startDrag: (item: DraggableItem, event: React.DragEvent) => void;
  endDrag: () => void;

  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id'>) => void;

  clipboardItem: ClipboardItem | null;
  copyToClipboard: (item: ClipboardItem) => void;
  pasteFromClipboard: (destinationPath: string) => Promise<void>;

  pinnedApps: AppId[];
  pinApp: (appId: AppId) => void;
  unpinApp: (appId: AppId) => void;
  
  googleUser: GoogleUser | null;
  connectGoogleUser: (user: GoogleUser) => void;
  disconnectGoogleUser: () => void;
  
  // FIX: Add missing methods for PEPxEditor and SnapshotManager
  // FIX: Changed return type to Promise to match async implementation.
  readPEPxImageData: (filePath: string) => Promise<ImageData | null>;
  createSnapshot: (name: string, description: string) => boolean;
  listSnapshots: () => { name: string; date: string; description: string }[];
  restoreSnapshot: (name: string) => boolean;
  deleteSnapshot: (name: string) => boolean;
}

const OSContext = createContext<OSContextType | undefined>(undefined);

// --- STATE MANAGEMENT: useReducer ---
// ... (Reducer logic is largely unchanged, so it's omitted for brevity but present in the final code)
interface SessionState {
    windows: WindowInstance[];
    desktopIcons: DesktopIconType[];
    contextMenu: ContextMenuState;
    modal: ModalState;
    draggedItem: DraggableItem | null;
    notifications: Notification[];
    clipboardItem: ClipboardItem | null;
    pinnedApps: AppId[];
    volume: number;
    brightness: number;
    accentColor: string;
    googleUser: GoogleUser | null;
}
type Action =
    | { type: 'SET_WINDOWS'; payload: WindowInstance[] } | { type: 'OPEN_WINDOW'; payload: WindowInstance } | { type: 'CLOSE_WINDOW'; payload: string }
    | { type: 'FOCUS_WINDOW'; payload: string } | { type: 'MINIMIZE_WINDOW'; payload: string } | { type: 'TOGGLE_MAXIMIZE'; payload: string }
    | { type: 'MOVE_WINDOW'; payload: { id: string; position: { x: number; y: number } } } | { type: 'RESIZE_WINDOW'; payload: { id: string; size: { width: number; height: number } } }
    | { type: 'SET_DESKTOP_ICONS'; payload: DesktopIconType[] } | { type: 'MOVE_ICON'; payload: { id: string; position: { x: number; y: number } } }
    | { type: 'SHOW_CONTEXT_MENU'; payload: { x: number; y: number; items: ContextMenuItem[] } } | { type: 'HIDE_CONTEXT_MENU' }
    | { type: 'SHOW_MODAL'; payload: { title: string; content: React.ReactNode; actions: ModalAction[] } } | { type: 'HIDE_MODAL' }
    | { type: 'START_DRAG'; payload: DraggableItem } | { type: 'END_DRAG' } | { type: 'SHOW_NOTIFICATION'; payload: Notification }
    | { type: 'REMOVE_NOTIFICATION'; payload: string } | { type: 'SET_CLIPBOARD_ITEM'; payload: ClipboardItem | null }
    | { type: 'SET_PINNED_APPS'; payload: AppId[] } | { type: 'PIN_APP'; payload: AppId } | { type: 'UNPIN_APP'; payload: AppId }
    | { type: 'SET_VOLUME', payload: number } | { type: 'SET_BRIGHTNESS', payload: number } | { type: 'SET_ACCENT_COLOR', payload: string }
    | { type: 'CONNECT_GOOGLE_USER', payload: GoogleUser } | { type: 'DISCONNECT_GOOGLE_USER' }
    | { type: 'LOAD_USER_SETTINGS', payload: Partial<SessionState> } | { type: 'CLEAR_SESSION_STATE' };
const initialSessionState: SessionState = { windows: [], desktopIcons: [], contextMenu: { isOpen: false, x: 0, y: 0, items: [] }, modal: { isOpen: false, title: '', content: null, actions: [] }, draggedItem: null, notifications: [], clipboardItem: null, pinnedApps: [], volume: 1, brightness: 1, accentColor: '#6366f1', googleUser: null };
const getTopZIndex = (windows: WindowInstance[]) => windows.length > 0 ? Math.max(...windows.map(w => w.zIndex)) : 99;
const osReducer = (state: SessionState, action: Action): SessionState => {
    switch (action.type) {
        case 'SET_WINDOWS': return { ...state, windows: action.payload };
        case 'OPEN_WINDOW': return { ...state, windows: [...state.windows.map(w => ({ ...w, isFocused: false })), action.payload] };
        case 'CLOSE_WINDOW': return { ...state, windows: state.windows.filter(win => win.id !== action.payload) };
        case 'FOCUS_WINDOW': {
            const targetWindow = state.windows.find(w => w.id === action.payload);
            if (!targetWindow || targetWindow.isFocused) {
                if (targetWindow && targetWindow.isMinimized) return { ...state, windows: state.windows.map(win => win.id === action.payload ? { ...win, isMinimized: false } : win) };
                return state;
            };
            const topZIndex = getTopZIndex(state.windows);
            return { ...state, windows: state.windows.map(win => ({ ...win, isFocused: win.id === action.payload, zIndex: win.id === action.payload ? topZIndex + 1 : win.zIndex, isMinimized: win.id === action.payload ? false : win.isMinimized })) };
        }
        case 'MINIMIZE_WINDOW': return { ...state, windows: state.windows.map(win => (win.id === action.payload ? { ...win, isMinimized: true, isFocused: false } : win)) };
        case 'TOGGLE_MAXIMIZE': return { ...state, windows: state.windows.map(win => (win.id === action.payload) ? (win.isMaximized ? { ...win, isMaximized: false, position: win.lastPosition || { x: 50, y: 50 }, size: win.lastSize || { width: 600, height: 400 } } : { ...win, isMaximized: true, lastPosition: win.position, lastSize: win.size, position: { x: 0, y: 0 }, size: { width: window.innerWidth, height: window.innerHeight - TASKBAR_HEIGHT } }) : win) };
        case 'MOVE_WINDOW': return { ...state, windows: state.windows.map(win => (win.id === action.payload.id ? { ...win, position: action.payload.position, isMaximized: false } : win)) };
        case 'RESIZE_WINDOW': return { ...state, windows: state.windows.map(win => (win.id === action.payload.id ? { ...win, size: action.payload.size, isMaximized: false } : win)) };
        case 'SET_DESKTOP_ICONS': return { ...state, desktopIcons: action.payload };
        case 'MOVE_ICON': return { ...state, desktopIcons: state.desktopIcons.map(icon => (icon.id === action.payload.id ? { ...icon, position: action.payload.position } : icon)) };
        case 'SHOW_CONTEXT_MENU': return { ...state, contextMenu: { isOpen: true, ...action.payload } };
        case 'HIDE_CONTEXT_MENU': return { ...state, contextMenu: { ...state.contextMenu, isOpen: false } };
        case 'SHOW_MODAL': return { ...state, modal: { isOpen: true, ...action.payload } };
        case 'HIDE_MODAL': return { ...state, modal: { ...state.modal, isOpen: false } };
        case 'START_DRAG': return { ...state, draggedItem: action.payload };
        case 'END_DRAG': return { ...state, draggedItem: null };
        case 'SHOW_NOTIFICATION': return { ...state, notifications: [...state.notifications, action.payload] };
        case 'REMOVE_NOTIFICATION': return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
        case 'SET_CLIPBOARD_ITEM': return { ...state, clipboardItem: action.payload };
        case 'SET_PINNED_APPS': return { ...state, pinnedApps: action.payload };
        case 'PIN_APP': return state.pinnedApps.includes(action.payload) ? state : { ...state, pinnedApps: [...state.pinnedApps, action.payload] };
        case 'UNPIN_APP': return { ...state, pinnedApps: state.pinnedApps.filter(appId => appId !== action.payload) };
        case 'SET_VOLUME': return { ...state, volume: Math.max(0, Math.min(1, action.payload)) };
        case 'SET_BRIGHTNESS': return { ...state, brightness: Math.max(0.5, Math.min(1, action.payload)) };
        case 'SET_ACCENT_COLOR': return { ...state, accentColor: action.payload };
        case 'CONNECT_GOOGLE_USER': return { ...state, googleUser: action.payload };
        case 'DISCONNECT_GOOGLE_USER': return { ...state, googleUser: null };
        case 'LOAD_USER_SETTINGS': return { ...state, ...action.payload };
        case 'CLEAR_SESSION_STATE': return { ...initialSessionState, desktopIcons: DEFAULT_ICONS, pinnedApps: DEFAULT_PINNED_APPS, accentColor: '#6366f1' };
        default: return state;
    }
};

export const OSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessionState, dispatch] = useReducer(osReducer, initialSessionState);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, rawSetTheme] = useState<'light' | 'dark'>('dark');
  const [wallpaper, rawSetWallpaper] = useState<string>(WALLPAPERS[0].url);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [fsRevision, setFsRevision] = useState(0);
  const [cwd, setCwd] = useState('/');
  const [envVars, setEnvVars] = useState<EnvVars>({ PATH: '/bin' });
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>('disconnected');
  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => { const id = uuidv4(); dispatch({ type: 'SHOW_NOTIFICATION', payload: { ...notification, id } }); setTimeout(() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }), 5000); }, []);

  // --- API SERVICE INTEGRATION ---
  useEffect(() => {
    const handleStatusChange = (status: ConnectionStatus) => {
        setApiStatus(status);
        if (status === 'connected') showNotification({ icon: '☁️', title: 'Cloud Kernel', message: 'Connected to remote backend.' });
        else if (status === 'disconnected' || status === 'error') showNotification({ icon: '🔌', title: 'Cloud Kernel', message: 'Connection to backend lost.' });
    };
    const handleVfsUpdate = (path: string) => updateFs();

    apiService.on('statusChange', handleStatusChange);
    apiService.on('vfsUpdate', handleVfsUpdate);

    return () => {
        apiService.off('statusChange', handleStatusChange);
        apiService.off('vfsUpdate', handleVfsUpdate);
    };
  }, [showNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFs = useCallback(() => setFsRevision(rev => rev + 1), []);

  const login = async (username: string, password?: string): Promise<boolean> => {
    apiService.connect();
    // Wait for connection
    await new Promise<void>(resolve => {
        if (apiService.getStatus() === 'connected') return resolve();
        const onConnect = () => { apiService.off('statusChange', onConnect); resolve(); };
        apiService.on('statusChange', onConnect);
    });

    const user = await authService.login(username, password);
    if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        const homeDir = `/home/${user.username}`;
        setCwd(`${homeDir}/Desktop`);
        // Load settings from localStorage (UI preferences)
        try {
            const savedIcons = localStorage.getItem(getUserIconsKey(user.username));
            dispatch({ type: 'SET_DESKTOP_ICONS', payload: savedIcons ? JSON.parse(savedIcons) : DEFAULT_ICONS });
            const savedWindows = localStorage.getItem(getUserWindowsKey(user.username));
            if(savedWindows) dispatch({ type: 'SET_WINDOWS', payload: JSON.parse(savedWindows) });
            const savedPinnedApps = localStorage.getItem(getUserPinnedAppsKey(user.username));
            dispatch({ type: 'SET_PINNED_APPS', payload: savedPinnedApps ? JSON.parse(savedPinnedApps) : DEFAULT_PINNED_APPS });
            const savedSettings = localStorage.getItem(getUserSettingsKey(user.username));
            if (savedSettings) dispatch({ type: 'LOAD_USER_SETTINGS', payload: JSON.parse(savedSettings) });
        } catch (e) {
            console.error("Error loading user preferences:", e);
        }
        return true;
    }
    apiService.disconnect();
    return false;
  };

  const logout = () => {
      authService.logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      dispatch({ type: 'CLEAR_SESSION_STATE' });
      setCwd('/');
  };
  const lock = () => {
      setIsLoggedIn(false);
      apiService.disconnect();
  };

  const getUsers = useCallback(() => authService.getUsers(), []);
  const createUser = useCallback((username: string, password?: string, role?: User['role']) => authService.createUser(username, password, role), []);
  const deleteUser = useCallback((userId: string) => authService.deleteUser(userId), []);

  // --- ASYNC VFS API WRAPPERS ---
  const createFile = useCallback(async (path: string) => { try { await apiService.createFile(path); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const createDirectory = useCallback(async (path: string) => { try { await apiService.createDirectory(path); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const writeFile = useCallback(async (path: string, content: string | Uint8Array) => { try { await apiService.writeFile(path, content); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const readFile = useCallback(async (path: string) => { try { const res = await apiService.readFile(path); return new Uint8Array(atob(res.content).split("").map(c => c.charCodeAt(0))); } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return null; } }, [showNotification]);
  const listDirectory = useCallback(async (path: string) => { try { const res = await apiService.listDirectory(path); return res.items as { [key: string]: FSNode }; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return null; } }, [showNotification]);
  const trashFile = useCallback(async (path: string) => { try { await apiService.trashFile(path); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const moveFile = useCallback(async (oldPath: string, newPath: string) => { try { await apiService.moveFile(oldPath, newPath); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const listTrash = useCallback(async () => { try { const res = await apiService.listTrash(); return res.items; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return []; } }, [showNotification]);
  const restoreFile = useCallback(async (id: number) => { try { await apiService.restoreFile(id); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const permanentlyDeleteFile = useCallback(async (id: number) => { try { await apiService.permanentlyDeleteFile(id); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);
  const emptyTrash = useCallback(async () => { try { await apiService.emptyTrash(); updateFs(); return true; } catch (e) { console.error(e); showNotification({icon: '❌', title: 'Error', message: (e as Error).message}); return false; } }, [updateFs, showNotification]);

  const pasteFromClipboard = useCallback(async (destinationPath: string) => {
    if (!sessionState.clipboardItem) return;
    const sourceName = sessionState.clipboardItem.path.split('/').pop() || 'file';
    const destPath = VFS.resolvePath(sourceName, destinationPath);
    
    // In a real CDE, 'copy' would be a backend operation. We simulate it with read/write.
    if (sessionState.clipboardItem.type === 'copy') {
      const content = await readFile(sessionState.clipboardItem.path);
      if(content) await writeFile(destPath, content);
    } else if (sessionState.clipboardItem.type === 'cut') {
      if (await moveFile(sessionState.clipboardItem.path, destPath)) {
        dispatch({ type: 'SET_CLIPBOARD_ITEM', payload: null });
      }
    }
  }, [sessionState.clipboardItem, moveFile, readFile, writeFile]);
  
  // --- Other useEffects and memoized callbacks (largely unchanged) ---
    useEffect(() => {
        handleResize(); window.addEventListener('resize', handleResize);
        const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME) as 'light' | 'dark' | null; setTheme(savedTheme || 'dark');
        const savedWallpaper = localStorage.getItem(LOCAL_STORAGE_KEYS.WALLPAPER); setWallpaper(savedWallpaper || WALLPAPERS[0].url);
        firmwareService.probeDevices(); setIsInitialized(true);
        return () => window.removeEventListener('resize', handleResize);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const hexToRgbString = (hex: string) => { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null; };
        const darken = (hex: string, percent: number) => { const num = parseInt(hex.replace("#", ""), 16), amt = Math.round(2.55 * percent), R = Math.max(0, (num >> 16) - amt), G = Math.max(0, (num >> 8 & 0x00FF) - amt), B = Math.max(0, (num & 0x0000FF) - amt); return `#${(B | (G << 8) | (R << 16)).toString(16).padStart(6, '0')}`; };
        const mainRgbString = hexToRgbString(sessionState.accentColor);
        if (mainRgbString) {
            document.documentElement.style.setProperty('--color-accent', mainRgbString);
            const darkerHex = darken(sessionState.accentColor, 10);
            const darkerRgbString = hexToRgbString(darkerHex);
            if (darkerRgbString) document.documentElement.style.setProperty('--color-accent-darker', darkerRgbString);
        }
    }, [sessionState.accentColor]);
    const setTheme = (newTheme: 'light' | 'dark') => { rawSetTheme(newTheme); localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, newTheme); document.documentElement.classList.toggle('dark', newTheme === 'dark'); };
    const setWallpaper = (url: string) => { rawSetWallpaper(url); localStorage.setItem(LOCAL_STORAGE_KEYS.WALLPAPER, url); };
    const handleResize = useCallback(() => { const width = window.innerWidth; if (width < 768) setDeviceType('mobile'); else if (width < 1024) setDeviceType('tablet'); else setDeviceType('desktop'); }, []);
    useEffect(() => { if (isLoggedIn && currentUser) localStorage.setItem(getUserIconsKey(currentUser.username), JSON.stringify(sessionState.desktopIcons)); }, [sessionState.desktopIcons, isLoggedIn, currentUser]);
    useEffect(() => { if (isLoggedIn && currentUser) { const key = getUserWindowsKey(currentUser.username); if (sessionState.windows.length > 0) localStorage.setItem(key, JSON.stringify(sessionState.windows.map(({ content, ...win }) => win))); else localStorage.removeItem(key); } }, [sessionState.windows, isLoggedIn, currentUser]);
    useEffect(() => { if (isLoggedIn && currentUser) localStorage.setItem(getUserPinnedAppsKey(currentUser.username), JSON.stringify(sessionState.pinnedApps)); }, [sessionState.pinnedApps, isLoggedIn, currentUser]);
    useEffect(() => { if (isLoggedIn && currentUser) { const { volume, brightness, accentColor, googleUser } = sessionState; localStorage.setItem(getUserSettingsKey(currentUser.username), JSON.stringify({ volume, brightness, accentColor, googleUser })); } }, [sessionState.volume, sessionState.brightness, sessionState.accentColor, sessionState.googleUser, isLoggedIn, currentUser]);
    const moveIcon = useCallback((id: string, position: { x: number; y: number }) => { dispatch({ type: 'MOVE_ICON', payload: { id, position } }); }, []);
    const setDesktopIcons = useCallback((icons: DesktopIconType[]) => { dispatch({ type: 'SET_DESKTOP_ICONS', payload: icons }); }, []);
    const openWindow = useCallback((appId: AppId, options?: { title?: string, content?: React.ReactNode, args?: Record<string, any>, size?: { width: number, height: number } }) => {
        const app = APPS.find(a => a.id === appId); if (!app) { console.error(`App with ID "${appId}" not found.`); return; }
        const topZIndex = getTopZIndex(sessionState.windows); const defaultWidth = options?.size?.width || app.defaultSize?.[0] || 600; const defaultHeight = options?.size?.height || app.defaultSize?.[1] || 400; const spawnableWidth = window.innerWidth - defaultWidth; const spawnableHeight = window.innerHeight - defaultHeight - TASKBAR_HEIGHT;
        const newWindow: WindowInstance = { id: `${appId}-${uuidv4()}`, appId, title: options?.title || app.name, icon: app.icon, position: { x: Math.max(20, Math.min(Math.random() * 200 + 50, spawnableWidth - 20)), y: Math.max(20, Math.min(Math.random() * 150 + 50, spawnableHeight - 20)) }, size: { width: defaultWidth, height: defaultHeight }, zIndex: topZIndex + 2, isMinimized: false, isMaximized: false, isFocused: true, content: options?.content, args: options?.args };
        dispatch({ type: 'OPEN_WINDOW', payload: newWindow });
    }, [sessionState.windows]);
    const closeWindow = useCallback((id: string) => dispatch({ type: 'CLOSE_WINDOW', payload: id }), []);
    const focusWindow = useCallback((id: string) => dispatch({ type: 'FOCUS_WINDOW', payload: id }), []);
    const minimizeWindow = useCallback((id: string) => dispatch({ type: 'MINIMIZE_WINDOW', payload: id }), []);
    const toggleMaximizeWindow = useCallback((id: string) => dispatch({ type: 'TOGGLE_MAXIMIZE', payload: id }), []);
    const moveWindow = useCallback((id: string, position: { x: number; y: number }) => dispatch({ type: 'MOVE_WINDOW', payload: { id, position } }), []);
    const resizeWindow = useCallback((id: string, size: { width: number; height: number }) => dispatch({ type: 'RESIZE_WINDOW', payload: { id, size } }), []);
    const showContextMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => dispatch({ type: 'SHOW_CONTEXT_MENU', payload: { x, y, items } }), []);
    const hideContextMenu = useCallback(() => dispatch({ type: 'HIDE_CONTEXT_MENU' }), []);
    const showModal = useCallback((title: string, content: React.ReactNode, actions: ModalAction[]) => dispatch({ type: 'SHOW_MODAL', payload: { title, content, actions } }), []);
    const hideModal = useCallback(() => dispatch({ type: 'HIDE_MODAL' }), []);
    const startDrag = useCallback((item: DraggableItem, event: React.DragEvent) => {
        dispatch({ type: 'START_DRAG', payload: item }); const img = new Image(); img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; event.dataTransfer.setDragImage(img, 0, 0); event.dataTransfer.setData('text/plain', JSON.stringify(item));
    }, []);
    const endDrag = useCallback(() => dispatch({ type: 'END_DRAG' }), []);
    
    const copyToClipboard = useCallback((item: ClipboardItem) => { dispatch({ type: 'SET_CLIPBOARD_ITEM', payload: item }); showNotification({ icon: '📋', title: 'Clipboard', message: `Item "${item.path.split('/').pop()}" is ready to be pasted.` }); }, [showNotification]);
    const pinApp = useCallback((appId: AppId) => dispatch({ type: 'PIN_APP', payload: appId }), []);
    const unpinApp = useCallback((appId: AppId) => dispatch({ type: 'UNPIN_APP', payload: appId }), []);
    const setVolume = useCallback((level: number) => dispatch({ type: 'SET_VOLUME', payload: level }), []);
    const setBrightness = useCallback((level: number) => dispatch({ type: 'SET_BRIGHTNESS', payload: level }), []);
    const setAccentColor = useCallback((color: string) => dispatch({ type: 'SET_ACCENT_COLOR', payload: color }), []);
    const connectGoogleUser = useCallback((user: GoogleUser) => dispatch({ type: 'CONNECT_GOOGLE_USER', payload: user }), []);
    const disconnectGoogleUser = useCallback(() => dispatch({ type: 'DISCONNECT_GOOGLE_USER' }), []);
    
    // FIX: Add missing functions
    const readPEPxImageData = useCallback(async (filePath: string): Promise<ImageData | null> => {
        const fileContent = await readFile(filePath);
        if (fileContent instanceof Uint8Array) {
            return pepxService.decodeToImageData(fileContent);
        }
        return null;
    }, [readFile]);

    const createSnapshot = useCallback((name: string, description: string) => { console.warn("createSnapshot not implemented"); return false; }, []);
    const listSnapshots = useCallback(() => { console.warn("listSnapshots not implemented"); return []; }, []);
    const restoreSnapshot = useCallback((name: string) => { console.warn("restoreSnapshot not implemented"); return false; }, []);
    const deleteSnapshot = useCallback((name: string) => { console.warn("deleteSnapshot not implemented"); return false; }, []);
    
    // FIX: Moved this useEffect after all its dependencies are defined via useCallback
    // Link services to the context's state and setters
    useEffect(() => {
        if (isInitialized) {
            commandInterpreter.setOS({ cwd, setCwd, openWindow, showModal, updateFs, createFile, trashFile, moveFile, envVars, currentUser, apiService, listDirectory, createDirectory, writeFile, readFile, listTrash, restoreFile, permanentlyDeleteFile, emptyTrash });
            aiKernel.setOS({ cwd, openWindow, createFile, writeFile, trashFile, updateFs, commandInterpreter, listDirectory, createDirectory, readFile, listTrash, restoreFile, permanentlyDeleteFile, emptyTrash });
        }
    }, [isInitialized, cwd, setCwd, openWindow, showModal, updateFs, createFile, trashFile, moveFile, envVars, currentUser, listDirectory, createDirectory, writeFile, readFile, listTrash, restoreFile, permanentlyDeleteFile, emptyTrash, commandInterpreter, aiKernel, apiService]);


  return (
    <OSContext.Provider value={{
        isInitialized, isLoggedIn, currentUser, login, logout, lock, getUsers, createUser, deleteUser,
        windows: sessionState.windows, openWindow, closeWindow, focusWindow, minimizeWindow, toggleMaximizeWindow, moveWindow, resizeWindow,
        desktopIcons: sessionState.desktopIcons, setDesktopIcons, moveIcon,
        theme, setTheme, wallpaper, setWallpaper, volume: sessionState.volume, setVolume, brightness: sessionState.brightness, setBrightness, accentColor: sessionState.accentColor, setAccentColor, deviceType, envVars,
        fsRevision, updateFs, createFile, createDirectory, writeFile, readFile, listDirectory, trashFile, moveFile, listTrash, restoreFile, permanentlyDeleteFile, emptyTrash,
        cwd, setCwd, apiStatus, apiService,
        contextMenu: sessionState.contextMenu, showContextMenu, hideContextMenu, modal: sessionState.modal, showModal, hideModal,
        commandInterpreter, aiKernel, firmwareService,
        draggedItem: sessionState.draggedItem, startDrag, endDrag,
        notifications: sessionState.notifications, showNotification, clipboardItem: sessionState.clipboardItem, copyToClipboard, pasteFromClipboard,
        pinnedApps: sessionState.pinnedApps, pinApp, unpinApp,
        googleUser: sessionState.googleUser, connectGoogleUser, disconnectGoogleUser,
        readPEPxImageData, createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot,
    }} >
      {children}
    </OSContext.Provider>
  );
};

export const useOS = (): OSContextType => {
  const context = useContext(OSContext);
  if (!context) throw new Error('useOS must be used within an OSProvider');
  return context;
};
