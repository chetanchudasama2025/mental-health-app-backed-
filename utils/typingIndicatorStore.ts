// In-memory store for typing indicators
// Typing indicators expire after 4 seconds of inactivity (longer to account for network delays)

interface TypingIndicator {
    userId: string;
    conversationId: string;
    timestamp: number;
    timeoutId?: NodeJS.Timeout;
}

class TypingIndicatorStore {
    private indicators: Map<string, TypingIndicator> = new Map();
    private readonly TTL = 4000; // 4 seconds - longer to account for network delays and polling intervals

    // Set typing indicator - refreshes timestamp if already exists
    setTyping(conversationId: string, userId: string): void {
        const key = `${conversationId}:${userId}`;
        const existing = this.indicators.get(key);
        
        // Clear existing timeout if present
        if (existing?.timeoutId) {
            clearTimeout(existing.timeoutId);
        }

        // Update or create indicator with new timestamp
        const indicator: TypingIndicator = {
            userId,
            conversationId,
            timestamp: Date.now(),
        };

        // Set new timeout to auto-remove after TTL
        indicator.timeoutId = setTimeout(() => {
            this.indicators.delete(key);
        }, this.TTL);

        this.indicators.set(key, indicator);
    }

    // Remove typing indicator
    removeTyping(conversationId: string, userId: string): void {
        const key = `${conversationId}:${userId}`;
        const indicator = this.indicators.get(key);
        
        // Clear timeout if present
        if (indicator?.timeoutId) {
            clearTimeout(indicator.timeoutId);
        }
        
        this.indicators.delete(key);
    }

    // Get all typing users for a conversation
    getTypingUsers(conversationId: string): string[] {
        const now = Date.now();
        const typingUsers: string[] = [];

        // Clean up expired indicators and collect active ones
        for (const [key, indicator] of this.indicators.entries()) {
            if (indicator.conversationId === conversationId) {
                if (now - indicator.timestamp < this.TTL) {
                    typingUsers.push(indicator.userId);
                } else {
                    // Remove expired indicator
                    this.indicators.delete(key);
                }
            }
        }

        return typingUsers;
    }

    // Clean up expired indicators
    cleanup(): void {
        const now = Date.now();
        for (const [key, indicator] of this.indicators.entries()) {
            if (now - indicator.timestamp >= this.TTL) {
                this.indicators.delete(key);
            }
        }
    }
}

// Singleton instance
export const typingIndicatorStore = new TypingIndicatorStore();

// Cleanup expired indicators every 5 seconds
setInterval(() => {
    typingIndicatorStore.cleanup();
}, 5000);

