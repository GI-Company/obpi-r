
import type React from 'react';

export type AppId = 
  | 'terminal' 
  | 'pepx_explorer' 
  | 'gemini_studio'
  | 'ai_assistant'
  | 'browser' 
  | 'system_settings'
  | 'welcome_note'
  | 'server_manager'
  | 'recycle_bin'
  | 'audio_recorder'
  | 'video_analyzer'
  | 'live_conversation'
  | 'system_monitor'
  | 'agent_hub'
  | 'ai_build_agent'
  | 'code_canvas'
  | 'dev_studio'
  | 'pepx_editor'
  | 'device_manager'
  | 'calendar'
  | 'media_player'
  | 'gallery'
  | 'youtube'
  | string;

export interface AppDefinition {
  id: AppId;
  name: string;
  icon: string;
  component: React.FC<any>;
  defaultSize?: [number, number];
}

export interface WindowInstance {
  id: string;
  appId: AppId;
  title: string;
  icon: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  content?: React.ReactNode;
  args?: Record<string, any>; // For passing data to new windows
  lastPosition?: { x: number; y: number }; // For restoring from maximized
  lastSize?: { width: number; height: number }; // For restoring from maximized
}

export interface FileType {
  type: 'file';
  content: string | Uint8Array; // Allow binary content for compressed files
}

export interface DirectoryType {
  type: 'dir';
  children: { [key: string]: FSNode };
}

export type FSNode = FileType | DirectoryType;

export interface TrashedFile {
    id: string;
    name: string;
    originalPath: string;
    deletedDate: string;
    node: FSNode;
}

export interface DesktopIconType {
  id:string;
  name: string;
  icon: string;
  appId: AppId;
  position: { x: number, y: number };
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  label?: string;
  icon?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  items?: ContextMenuItem[];
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  content: React.ReactNode;
  actions: ModalAction[];
}

export interface ModalAction {
  text: string;
  type?: 'primary' | 'secondary' | 'danger';
  onClick: () => void | Promise<void>;
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string; placeAnswerSources?: { reviewSnippets: { uri: string; reviewText: string; reviewer: string; starRating: number }[] } };
}

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  groundingChunks?: GroundingChunk[];
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DraggableItem {
  type: 'file' | 'icon';
  id: string; // Could be icon id or file path
  path?: string; // For files
  name: string;
  icon: string;
}

export interface User {
    id: string;
    username: string;
    password?: string;
    role: 'Admin' | 'Standard' | 'Limited';
    avatar: string;
}

export interface GoogleUser {
    name: string;
    email: string;
    picture: string;
}

export interface Notification {
  id: string;
  icon: string;
  title: string;
  message: string;
}

export interface ClipboardItem {
  type: 'copy' | 'cut';
  path: string;
}

export interface VirtualDevice {
    id: string;
    name: string;
    type: 'GPU' | 'Audio' | 'Network' | 'Storage';
    status: 'OK' | 'Error' | 'Disabled';
    driverVersion: string;
}

export interface EnvVars {
  [key: string]: string;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD format
  title: string;
  time?: string;
  notes?: string;
}

export interface SimulatedFile {
  name: string;
  type: 'file' | 'dir';
  mimeType?: 'document' | 'spreadsheet' | 'presentation' | 'image' | 'pdf' | 'folder';
  children?: SimulatedFile[];
}

export interface BiosSettings {
    virtualAudio: boolean;
    virtualNetwork: boolean;
    bootOrder: string[];
}
