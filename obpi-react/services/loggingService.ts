
interface LogEntry {
    timestamp: string;
    source: string;
    message: string;
}

class LoggingService {
    private logs: LogEntry[] = [];
    private subscribers: ((logs: LogEntry[]) => void)[] = [];
    private readonly MAX_LOGS = 100;

    public log(source: string, message: string) {
        const newEntry: LogEntry = {
            timestamp: new Date().toISOString(),
            source,
            message,
        };

        this.logs.unshift(newEntry); // Add to the beginning

        // Keep the log size manageable
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }

        this.notifySubscribers();
    }

    public getLogs(): LogEntry[] {
        return this.logs;
    }

    public subscribe(callback: (logs: LogEntry[]) => void): () => void {
        this.subscribers.push(callback);
        // Immediately notify with current logs
        callback(this.logs);

        // Return an unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    private notifySubscribers() {
        for (const callback of this.subscribers) {
            callback(this.logs);
        }
    }
}

// Export a singleton instance
export const logger = new LoggingService();
