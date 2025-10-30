import type React from 'react';
import type { AppId, FSNode } from '../types';
import { CommandInterpreter } from './commandInterpreter';
import { OSContextType } from '../contexts/OSContext';

// The AIKernel provides a safe, structured API for the AI to interact with the OS.
type KernelOSInterface = Pick<OSContextType, 
    | 'cwd' | 'openWindow' | 'createFile' | 'writeFile' | 'trashFile' 
    | 'updateFs' | 'commandInterpreter' | 'listDirectory' | 'createDirectory'
    | 'readFile' | 'listTrash' | 'restoreFile' | 'permanentlyDeleteFile' | 'emptyTrash'
>;

export class AIKernel {
    private os: KernelOSInterface | null = null;
    
    setOS(os: KernelOSInterface) {
        this.os = os;
    }

    async execute(functionName: string, args: any): Promise<any> {
        if (!this.os) return { error: "OS Kernel not initialized." };

        const resolvePath = (p: string) => p; // Path resolution is now handled by backend

        switch(functionName) {
            case 'openWindow': return this.openWindow(args.appId);
            case 'listFiles': return this.listFiles(resolvePath(args.path));
            case 'readFile': return await this.readFile(resolvePath(args.path));
            case 'createFile': return await this.createFile(resolvePath(args.path), args.content);
            case 'writeFile': return await this.writeFile(resolvePath(args.path), args.content);
            case 'deleteFile': return await this.deleteFile(resolvePath(args.path)); // Note: This is now 'trashFile'
            case 'searchWeb': return this.searchWeb(args.query);
            case 'proposeBuildPlan': return this.proposeBuildPlan(args.steps, args.outputFile);
            case 'analyzeProjectStructure': return await this.analyzeProjectStructure(resolvePath(args.path));
            case 'compileFile': return { success: false, message: 'Compilation via AI is disabled in CDE mode. Use terminal commands.' };
            case 'linkFiles': return { success: false, message: 'Linking via AI is disabled in CDE mode. Use terminal commands.' };
            case 'runCommand': return await this.runCommand(args.command);
            default: return { error: `Unknown kernel function: ${functionName}` };
        }
    }

    private openWindow(appId: AppId): { success: boolean, message: string } {
        this.os!.openWindow(appId);
        return { success: true, message: `Opened window for ${appId}` };
    }

    private async listFiles(path: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
        const items = await this.os!.listDirectory(path);
        if (!items) return { success: false, error: `Path not found or not a directory: ${path}` };
        // FIX: listDirectory returns an object, not an array. Use Object.entries to iterate.
        const fileList = Object.entries(items).map(([name, node]) => node.type === 'dir' ? `${name}/` : name);
        return { success: true, data: fileList };
    }

    private async readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }> {
        const content = await this.os!.readFile(path);
        if (content === null) return { success: false, error: `File not found or is a directory: ${path}` };
        if (typeof content === 'string') return { success: true, content };
        // FIX: Decode Uint8Array to string for the AI agent, which expects text.
        const textContent = new TextDecoder().decode(content);
        return { success: true, content: textContent };
    }

    private async createFile(path: string, content?: string): Promise<{ success: boolean; message: string }> {
        if (await this.os!.createFile(path)) {
            if (content) await this.os!.writeFile(path, content);
            return { success: true, message: `File created at ${path}` };
        }
        return { success: false, message: `Failed to create file at ${path}` };
    }

    private async writeFile(path: string, content: string): Promise<{ success: boolean; message: string }> {
        if (await this.os!.writeFile(path, content)) {
            return { success: true, message: `Content written to ${path}` };
        }
        return { success: false, message: `Failed to write to file at ${path}` };
    }

    private async deleteFile(path: string): Promise<{ success: boolean; message: string }> {
        if (await this.os!.trashFile(path)) {
            return { success: true, message: `File moved to Recycle Bin from ${path}` };
        }
        return { success: false, message: `Failed to delete file at ${path}.` };
    }

    private searchWeb(query: string): { success: boolean; message: string } {
        this.os!.openWindow('browser', { title: `Search: ${query}`, args: { initialQuery: query } });
        return { success: true, message: `Opened browser to search for "${query}".` };
    }
    
    private proposeBuildPlan(steps: string[], outputFile: string): { status: 'plan_proposed', plan: { steps: string[], outputFile: string } } {
        return { status: 'plan_proposed', plan: { steps, outputFile } };
    }

    private async analyzeProjectStructure(path: string): Promise<{ success: boolean; structure?: string; error?: string }> {
        const getStructure = async (currentPath: string, depth: number): Promise<string> => {
            const items = await this.os!.listDirectory(currentPath);
            if (!items) return '';
            let structure = '';
            // FIX: listDirectory returns an object, not an array. Use Object.entries to iterate.
            for (const [name, node] of Object.entries(items)) {
                const prefix = '  '.repeat(depth);
                structure += `${prefix}- ${name}${node.type === 'dir' ? '/' : ''}\n`;
                if (node.type === 'dir') {
                    structure += await getStructure(`${currentPath}/${name}`, depth + 1);
                }
            }
            return structure;
        };
        return { success: true, structure: await getStructure(path, 0) };
    }
    
    private async runCommand(command: string): Promise<{ success: boolean; output: string }> {
         const result = await this.os!.commandInterpreter.execute(command);
         return { success: true, output: result as string };
    }
}
