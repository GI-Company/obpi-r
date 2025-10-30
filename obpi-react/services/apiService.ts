
import { v4 as uuidv4 } from 'uuid';
import { FSNode, TrashedFile, User } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type EventHandler = (...args: any[]) => void;
type RequestResolver = { resolve: (value: any) => void; reject: (reason?: any) => void };

export class ApiService {
    private ws: WebSocket | null = null;
    private status: ConnectionStatus = 'disconnected';
    private eventListeners: Map<string, EventHandler[]> = new Map();
    private pendingRequests: Map<string, RequestResolver> = new Map();

    public on(eventName: string, handler: EventHandler) {
        if (!this.eventListeners.has(eventName)) this.eventListeners.set(eventName, []);
        this.eventListeners.get(eventName)?.push(handler);
    }

    public off(eventName: string, handler: EventHandler) {
        const handlers = this.eventListeners.get(eventName);
        if (handlers) this.eventListeners.set(eventName, handlers.filter(h => h !== handler));
    }

    private emit(eventName: string, ...args: any[]) {
        this.eventListeners.get(eventName)?.forEach(handler => handler(...args));
    }

    private setStatus(newStatus: ConnectionStatus) {
        if (this.status !== newStatus) {
            this.status = newStatus;
            this.emit('statusChange', this.status);
        }
    }
    // FIX: Add getStatus method
    public getStatus(): ConnectionStatus {
        return this.status;
    }


    private handleMessage(event: MessageEvent) {
        try {
            const message = JSON.parse(event.data);
            
            // Handle Responses to requests
            if (message.request_id) {
                const resolver = this.pendingRequests.get(message.request_id);
                if (resolver) {
                    if (message.type === 'error') {
                        resolver.reject(new Error(message.payload.message));
                    } else {
                        resolver.resolve(message.payload);
                    }
                    this.pendingRequests.delete(message.request_id);
                }
            } 
            // Handle Server Pushes
            else if (message.type) {
                this.emit(message.type, message.payload);
            }
        } catch (e) {
            console.error('[ApiService] Error parsing message:', e);
        }
    }

    connect() {
        if (this.ws || this.status === 'connecting') return;
        this.setStatus('connecting');
        try {
            this.ws = new WebSocket('ws://localhost:8080/ws');
            this.ws.onopen = () => this.setStatus('connected');
            this.ws.onclose = () => { this.ws = null; this.setStatus('disconnected'); };
            this.ws.onerror = () => this.setStatus('error');
            this.ws.onmessage = (event) => this.handleMessage(event);
        } catch (e) {
            this.setStatus('error');
        }
    }

    disconnect() {
        this.ws?.close();
    }

    private sendRequest<T>(type: string, payload: any = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.status !== 'connected' || !this.ws) {
                return reject(new Error("Not connected to the server."));
            }
            const request_id = uuidv4();
            this.pendingRequests.set(request_id, { resolve, reject });

            this.ws.send(JSON.stringify({ request_id, type, payload }));

            setTimeout(() => {
                if (this.pendingRequests.has(request_id)) {
                    this.pendingRequests.delete(request_id);
                    reject(new Error("Request timed out."));
                }
            }, 10000); // 10 second timeout
        });
    }

    // --- API Methods ---

    public login(username: string, password: string): Promise<{ user: User }> {
        return this.sendRequest('login', { username, password });
    }
    
    public runCommand(command: string): void {
        // This is fire-and-forget
        if (this.status === 'connected' && this.ws) {
            this.ws.send(JSON.stringify({ request_id: uuidv4(), type: 'runCommand', payload: { command } }));
        }
    }
    
    public listDirectory(path: string): Promise<{ items: { [key: string]: FSNode } }> {
        return this.sendRequest('vfsList', { path });
    }

    public readFile(path: string): Promise<{ content: string }> {
        return this.sendRequest('vfsReadFile', { path });
    }
    
    public writeFile(path: string, content: string | Uint8Array): Promise<{ success: boolean }> {
        const base64Content = typeof content === 'string'
            ? btoa(unescape(encodeURIComponent(content))) // Correctly handle UTF-8
            : btoa(String.fromCharCode.apply(null, Array.from(content)));
        return this.sendRequest('vfsWriteFile', { path, content: base64Content });
    }

    public createFile(path: string): Promise<{ success: boolean }> {
        return this.sendRequest('vfsCreateNode', { path, node_type: 'file' });
    }
    
    public createDirectory(path: string): Promise<{ success: boolean }> {
        return this.sendRequest('vfsCreateNode', { path, node_type: 'dir' });
    }

    public moveFile(oldPath: string, newPath: string): Promise<{ success: boolean }> {
        return this.sendRequest('vfsMoveNode', { old_path: oldPath, new_path: newPath });
    }

    public trashFile(path: string): Promise<{ success: boolean }> {
        return this.sendRequest('vfsTrashNode', { path });
    }

    public listTrash(): Promise<{ items: TrashedFile[] }> {
        return this.sendRequest('vfsListTrash');
    }

    public restoreFile(id: number): Promise<{ success: boolean }> {
        return this.sendRequest('vfsRestoreNode', { id });
    }
    
    public permanentlyDeleteFile(id: number): Promise<{ success: boolean }> {
        return this.sendRequest('vfsDeleteNode', { id });
    }

    public emptyTrash(): Promise<{ success: boolean }> {
        return this.sendRequest('vfsEmptyTrash');
    }
}
