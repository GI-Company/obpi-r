import { User } from '../types';
import { ApiService } from './apiService';

export class AuthService {
    private currentUser: User | null = null;
    private apiService: ApiService;

    constructor(apiService: ApiService) {
        this.apiService = apiService;
    }

    public async login(username: string, password?: string): Promise<User | null> {
        try {
            const response = await this.apiService.login(username, password || '');
            this.currentUser = response.user;
            return this.currentUser;
        } catch (error) {
            console.error("Login failed:", error);
            this.currentUser = null;
            return null;
        }
    }

    public logout(): void {
        this.currentUser = null;
        this.apiService.disconnect();
    }

    public getCurrentUser(): User | null {
        return this.currentUser;
    }

    // The following methods would also need to be implemented on the backend
    // For now, they are placeholders.
    public getUsers(): User[] {
        console.warn("getUsers is not implemented on the backend yet.");
        return this.currentUser ? [this.currentUser] : [];
    }

    public createUser(username: string, password?: string, role: User['role'] = 'Standard'): boolean {
        console.warn("createUser is not implemented on the backend yet.");
        return false;
    }

    public deleteUser(userId: string): boolean {
         console.warn("deleteUser is not implemented on the backend yet.");
        return false;
    }
}
