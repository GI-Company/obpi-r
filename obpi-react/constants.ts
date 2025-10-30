
import type { AppDefinition, DesktopIconType, AppId, BiosSettings } from './types';
import Terminal from './apps/Terminal';
import PEPxExplorer from './apps/PEPxExplorer';
import GeminiStudio from './apps/GeminiStudio';
import Browser from './apps/Browser';
import SystemSettings from './apps/SystemSettings';
import WelcomeNote from './apps/WelcomeNote';
import ServerManager from './apps/ServerManager';
import RecycleBin from './apps/RecycleBin';
import AudioRecorder from './apps/AudioRecorder';
import VideoAnalyzer from './apps/VideoAnalyzer';
import LiveConversation from './apps/LiveConversation';
import SystemMonitor from './apps/SystemMonitor';
import AgentHub from './apps/AgentHub';
import AIBuildAgent from './apps/AIBuildAgent';
import CodeCanvas from './apps/CodeCanvas';
import AIAssistant from './apps/AIAssistant';
import DevStudio from './apps/DevStudio';
import PEPxEditor from './apps/PEPxEditor';
import DeviceManager from './apps/DeviceManager';
import CalendarApp from './apps/CalendarApp';
import MediaPlayer from './apps/MediaPlayer';
import Gallery from './apps/Gallery';
import YouTube from './apps/YouTube';
import SnapshotManager from './apps/SnapshotManager';


export const LOCAL_STORAGE_KEYS = {
  FILESYSTEM_BINARY: 'obpi_react_fs_v4_binary', // New key for binary VFS
  THEME: 'obpi_react_theme_v2',
  WALLPAPER: 'obpi_react_wallpaper_v1',
  VOLUME: 'obpi_react_volume_v1',
  BRIGHTNESS: 'obpi_react_brightness_v1',
  SNAPSHOT_MANIFEST: 'obpi_react_vfs_snapshots_manifest_v1',
  BIOS_SETTINGS: 'obpi_react_bios_settings_v1',
};

export const getUserWindowsKey = (username: string): string => `obpi_react_windows_v2_${username}`;
export const getUserIconsKey = (username: string): string => `obpi_react_icons_v2_${username}`;
export const getUserPinnedAppsKey = (username: string): string => `obpi_react_pinned_apps_v1_${username}`;
export const getUserSettingsKey = (username: string): string => `obpi_react_user_settings_v1_${username}`;


export const TASKBAR_HEIGHT = 48;

export const DEFAULT_BIOS_SETTINGS: BiosSettings = {
    virtualAudio: true,
    virtualNetwork: true,
    bootOrder: ['OBPI VFS Drive', 'PXE Network Boot', 'USB Device'],
};

export const APPS: AppDefinition[] = [
  { id: 'terminal', name: 'Terminal', icon: '🖥️', component: Terminal, defaultSize: [700, 450] },
  { id: 'pepx_explorer', name: 'PEPx Explorer', icon: '🖼️', component: PEPxExplorer, defaultSize: [800, 600] },
  { id: 'gemini_studio', name: 'Gemini Studio', icon: '✨', component: GeminiStudio, defaultSize: [950, 700] },
  { id: 'dev_studio', name: 'Dev Studio', icon: '🧑‍💻', component: DevStudio, defaultSize: [1000, 700] },
  { id: 'live_conversation', name: 'Live Conversation', icon: '🎙️', component: LiveConversation, defaultSize: [400, 500] },
  { id: 'ai_assistant', name: 'AI Assistant', icon: '💡', component: AIAssistant, defaultSize: [380, 550] },
  { id: 'audio_recorder', name: 'Audio Recorder', icon: '⏺️', component: AudioRecorder, defaultSize: [450, 250] },
  { id: 'video_analyzer', name: 'Video Analyzer', icon: '🎬', component: VideoAnalyzer, defaultSize: [800, 600] },
  { id: 'browser', name: 'Browser', icon: '🌐', component: Browser, defaultSize: [900, 600] },
  { id: 'server_manager', name: 'Server Manager', icon: '📡', component: ServerManager, defaultSize: [400, 300] },
  { id: 'recycle_bin', name: 'Recycle Bin', icon: '🗑️', component: RecycleBin, defaultSize: [600, 450]},
  { id: 'system_monitor', name: 'System Monitor', icon: '📊', component: SystemMonitor, defaultSize: [500, 450]},
  { id: 'agent_hub', name: 'Agent Hub', icon: '🤖', component: AgentHub, defaultSize: [600, 500]},
  { id: 'device_manager', name: 'Device Manager', icon: '🎛️', component: DeviceManager, defaultSize: [400, 500]},
  { id: 'snapshot_manager', name: 'Snapshot Manager', icon: '💾', component: SnapshotManager, defaultSize: [500, 400] },
  { id: 'ai_build_agent', name: 'AI Build Agent', icon: '🛠️', component: AIBuildAgent, defaultSize: [500, 600]},
  { id: 'code_canvas', name: 'Code & Canvas', icon: '🧑‍🤝‍🧑', component: CodeCanvas, defaultSize: [1000, 700]},
  { id: 'calendar', name: 'Calendar', icon: '📅', component: CalendarApp, defaultSize: [700, 550] },
  { id: 'media_player', name: 'Media Player', icon: '🎵', component: MediaPlayer, defaultSize: [450, 300] },
  { id: 'gallery', name: 'Gallery', icon: '🏞️', component: Gallery, defaultSize: [800, 600] },
  { id: 'youtube', name: 'YouTube', icon: '📺', component: YouTube, defaultSize: [900, 600] },
  { id: 'system_settings', name: 'Settings', icon: '⚙️', component: SystemSettings, defaultSize: [600, 450] },
  { id: 'welcome_note', name: 'Welcome', icon: '👋', component: WelcomeNote, defaultSize: [500, 300] },
  { id: 'pepx_editor', name: 'PEPx Editor', icon: '🔲', component: PEPxEditor, defaultSize: [700, 500] },
];

export const DEFAULT_ICONS: DesktopIconType[] = [
  { id: 'icon-terminal', name: 'Terminal', icon: '🖥️', appId: 'terminal', position: { x: 20, y: 20 } },
  { id: 'icon-pepx', name: 'PEPx Explorer', icon: '🖼️', appId: 'pepx_explorer', position: { x: 20, y: 110 } },
  { id: 'icon-gemini', name: 'Gemini Studio', icon: '✨', appId: 'gemini_studio', position: { x: 20, y: 200 } },
  { id: 'icon-recyclebin', name: 'Recycle Bin', icon: '🗑️', appId: 'recycle_bin', position: { x: 20, y: 290 } },
  { id: 'icon-ai-assistant', name: 'AI Assistant', icon: '💡', appId: 'ai_assistant', position: { x: 20, y: 380 } },
  
  { id: 'icon-devstudio', name: 'Dev Studio', icon: '🧑‍💻', appId: 'dev_studio', position: { x: 120, y: 20 } },
  { id: 'icon-calendar', name: 'Calendar', icon: '📅', appId: 'calendar', position: { x: 120, y: 110 } },
  { id: 'icon-gallery', name: 'Gallery', icon: '🏞️', appId: 'gallery', position: { x: 120, y: 200 } },
  { id: 'icon-mediaplayer', name: 'Media Player', icon: '🎵', appId: 'media_player', position: { x: 120, y: 290 } },
  { id: 'icon-youtube', name: 'YouTube', icon: '📺', appId: 'youtube', position: { x: 120, y: 380 } },

  { id: 'icon-agenthub', name: 'Agent Hub', icon: '🤖', appId: 'agent_hub', position: { x: 220, y: 20 } },
  { id: 'icon-sysmon', name: 'System Monitor', icon: '📊', appId: 'system_monitor', position: { x: 220, y: 110 } },
  { id: 'icon-devicemanager', name: 'Device Manager', icon: '🎛️', appId: 'device_manager', position: { x: 220, y: 200 } },
  { id: 'icon-snapshotmanager', name: 'Snapshot Manager', icon: '💾', appId: 'snapshot_manager', position: { x: 220, y: 290 } },
];

export const DEFAULT_PINNED_APPS: AppId[] = [
    'pepx_explorer',
    'terminal',
    'dev_studio',
    'browser',
    'gallery'
];

export const WALLPAPERS = [
    { name: 'Nebula', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop' },
    { name: 'Sphere', url: 'https://images.unsplash.com/photo-1506443432602-ac2fcd6f54e0?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Aurora', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Liquid', url: 'https://images.unsplash.com/photo-1558518354-e91a78895043?q=80&w=2070&auto=format&fit=crop' },
];

export const FILE_ASSOCIATIONS: Record<string, AppId> = {
    // Code
    'txt': 'dev_studio',
    'js': 'dev_studio',
    'ts': 'dev_studio',
    'py': 'dev_studio',
    'c': 'dev_studio',
    'rs': 'dev_studio',
    'olic': 'dev_studio',
    'json': 'dev_studio',
    'html': 'dev_studio',
    'css': 'dev_studio',
    'pepx': 'pepx_editor',
    // Media
    'mp3': 'media_player',
    'wav': 'media_player',
    'ogg': 'media_player',
    'mp4': 'media_player',
    'webm': 'media_player',
    'png': 'gallery',
    'jpg': 'gallery',
    'jpeg': 'gallery',
    'gif': 'gallery',
};