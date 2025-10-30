
import React from 'react';
import type { AppId, EnvVars, User, FSNode, TrashedFile } from '../types';
import { APPS } from '../constants';
import { VFS } from './VFS';
import { performComplexReasoning, performGroundedSearch } from './geminiService';
import { ApiService } from './apiService';


// A subset of the OS context that commands are allowed to interact with
// FIX: Update interface to match CDE context
interface CommandOSInterface {
    cwd: string;
    setCwd: React.Dispatch<React.SetStateAction<string>>;
    openWindow: (appId: AppId, args?: { title?: string, content?: React.ReactNode, args?: Record<string, any> }) => void;
    showModal: (title: string, content: React.ReactNode, actions: any[]) => void;
    updateFs: () => void;
    createFile: (path: string, content?: string | Uint8Array) => Promise<boolean>;
    trashFile: (path: string) => Promise<boolean>;
    moveFile: (oldPath: string, newPath: string) => Promise<boolean>;
    envVars: EnvVars;
    currentUser: User | null;
    apiService: ApiService;
    listDirectory: (path: string) => Promise<{ [key: string]: FSNode } | null>;
    createDirectory: (path: string) => Promise<boolean>;
    writeFile: (path: string, content: string | Uint8Array) => Promise<boolean>;
    readFile: (path: string) => Promise<string | Uint8Array | null>;
    listTrash: () => Promise<TrashedFile[]>;
    restoreFile: (id: number) => Promise<boolean>;
    permanentlyDeleteFile: (id: number) => Promise<boolean>;
    emptyTrash: () => Promise<boolean>;
}


type CommandHandler = (args: string[], os: CommandOSInterface) => Promise<string | React.ReactNode>;


export class CommandInterpreter {
    private os: CommandOSInterface | null = null;
    private localCommands: Record<string, CommandHandler> = {};

    constructor() {
        this.registerLocalCommands();
    }

    setOS(os: CommandOSInterface) {
        this.os = os;
    }

    private registerLocalCommands() {
        // These commands are safe to run client-side or are essential for UI interaction
        this.localCommands['help'] = async () => 'Available commands: ls, cd, pwd, cat, echo, run, clear, date, gemini... (and more on the backend)';
        this.localCommands['clear'] = async () => ''; // Handled by terminal UI
        this.localCommands['date'] = async () => new Date().toString();
        this.localCommands['pwd'] = async (_, os) => os.cwd;

        this.localCommands['cd'] = async (args, os) => {
            const homeDir = os.currentUser ? `/home/${os.currentUser.username}` : '/home/guest';
            const target = args[0] || homeDir;
            if (target === '~') {
                os.setCwd(homeDir);
                return '';
            }
            // FIX: Use static VFS.resolvePath
            const newPath = VFS.resolvePath(target, os.cwd);
            // In CDE mode, we can't verify if a directory exists client-side.
            // We just optimistically set the path and let the backend handle errors on subsequent commands.
            os.setCwd(newPath);
            // Send a 'cd' command to the backend to sync its CWD as well.
            await os.apiService.runCommand(`cd ${newPath}`);
            return '';
        };

        this.localCommands['run'] = async (args, os) => {
            const appId = args[0];
            if (!appId) return 'run: missing app id. Try: ' + APPS.map(a => a.id).join(', ');
            
            const app = APPS.find(a => a.id === appId);
            if (app) {
                os.openWindow(app.id);
                return `Starting ${app.name}...`;
            }
            return `run: app not found: ${appId}`;
        };

        this.localCommands['gemini'] = async (args, os) => {
            const subCommand = args[0];
            const prompt = args.slice(1).join(' ');
            if (!subCommand || !prompt) return 'Usage: gemini <command> <prompt>\nCommands: chat, think, search, maps';
            
            switch (subCommand) {
                case 'chat':
                    os.openWindow('gemini_studio', { args: { initialPrompt: prompt, initialTab: 'chat' } });
                    return `Sending prompt to Gemini Studio...`;
                case 'think':
                    return `Thinking... (this may take a moment)\n\n` + await performComplexReasoning(prompt);
                case 'search':
                case 'maps': {
                    const response = await performGroundedSearch(prompt, subCommand === 'maps');
                    let output = response.text + '\n\nSources:\n';
                    response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach(chunk => {
                        if (chunk.web) output += `- [Web] ${chunk.web.title}: ${chunk.web.uri}\n`;
                        if (chunk.maps) output += `- [Map] ${chunk.maps.title}: ${chunk.maps.uri}\n`;
                    });
                    return output;
                }
                default:
                    return `Unknown gemini command: ${subCommand}. Available: chat, think, search, maps`;
            }
        };
    }
    
    async execute(
        commandString: string, 
        onAiStatusUpdate?: (message: string) => void,
        onAiResultUpdate?: (message: string) => void
    ): Promise<string | React.ReactNode> {
        if (!this.os) throw new Error("OS not attached to interpreter.");

        const [command, ...args] = commandString.trim().split(/\s+/).filter(Boolean);
        if (!command) return '';

        // 1. Check for local client-side commands first
        if (this.localCommands[command]) {
            return await this.localCommands[command](args, this.os);
        }

        // 2. If not a local command, send it to the backend for execution.
        // This is now fire-and-forget. The terminal UI will listen for 'terminalOutput' events.
        try {
            this.os.apiService.runCommand(commandString);
            return ''; // Return immediately, don't wait for output.
        } catch (error) {
            return error instanceof Error ? error.message : "An unknown error occurred while sending the command to the server.";
        }
    }
}
