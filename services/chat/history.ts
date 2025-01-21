import { storage } from '@/services/storage';
import { STORAGE_KEYS } from '@/services/storage/constants';
import { ChatMessage, ChatSession } from './types';

export class ChatHistoryManager {
    private static instance: ChatHistoryManager;
    private currentIdx: number = -1;
    private batchSize: number = 20;

    private constructor() { }

    static getInstance(): ChatHistoryManager {
        if (!ChatHistoryManager.instance) {
            ChatHistoryManager.instance = new ChatHistoryManager();
        }
        return ChatHistoryManager.instance;
    }

    private getSessionKey(idx: number): string {
        return `${STORAGE_KEYS.CHAT_PREFIX}${idx}`;
    }

    async getNextSessionId(): Promise<string> {
        if (this.currentIdx === -1) {
            const idx = await storage.getItem<number>(STORAGE_KEYS.CHAT_IDX);
            this.currentIdx = idx || 0;
            console.log('初始化聊天历史索引:', this.currentIdx);
        }
        this.currentIdx++;
        await storage.setItem(STORAGE_KEYS.CHAT_IDX, this.currentIdx);
        return `${STORAGE_KEYS.CHAT_PREFIX}${this.currentIdx}`;
    }

    async updateSession(session: ChatSession, message?: ChatMessage): Promise<void> {
        try {
            if (message) {
                await storage.setItem(message.id, message);
            }
            await storage.setItem(session.id, session);
        } catch (error) {
            console.error('更新会话失败:', error);
            throw error;
        }
    }

    async resetSession(session: ChatSession, msgIds: string[]): Promise<void> {
        for (const msgId of msgIds) {
            await storage.removeItem(msgId);
        }
        await storage.setItem(session.id, session);
    }

    async getSession(sessionId: string): Promise<ChatSession | null> {
        try {
            return await storage.getItem<ChatSession>(sessionId);
        } catch (error) {
            console.error('获取会话失败:', error);
            return null;
        }
    }

    async getMessages(session: ChatSession): Promise<Record<string, ChatMessage>> {
        const messages: Record<string, ChatMessage> = {};
        for (const turn of session.turns) {
            for (const messageId of turn.messages) {
                const message = await storage.getItem<ChatMessage>(messageId);
                if (message) {
                    messages[messageId] = message;
                }
            }
        }
        return messages;
    }

    async loadHistory(idx: number = 0): Promise<{ idx: number, sessions: ChatSession[] }> {
        if (this.currentIdx === -1) {
            this.currentIdx = await storage.getItem<number>(STORAGE_KEYS.CHAT_IDX) || 0;
        }

        try {
            const sessions: ChatSession[] = [];
            const endIdx = Math.min(this.currentIdx - idx, this.currentIdx);

            for (let i = endIdx; i >= 0; i--) {
                const session = await storage.getItem<ChatSession>(this.getSessionKey(i));
                if (session) {
                    sessions.push(session);
                    if (sessions.length >= this.batchSize) {
                        break;
                    }
                }
                idx++;
            }
            return { idx, sessions };
        } catch (error) {
            console.error('加载历史记录失败:', error);
            return { idx, sessions: [] };
        }
    }

    async hasMoreHistory(idx: number): Promise<boolean> {
        const startIdx = this.currentIdx - idx;
        return startIdx > 0;
    }

    async clearHistory(): Promise<void> {
        try {
            for (let i = 1; i <= this.currentIdx; i++) {
                await storage.removeItem(this.getSessionKey(i));
            }
            this.currentIdx = 0;
            await storage.setItem(STORAGE_KEYS.CHAT_IDX, 0);
        } catch (error) {
            console.error('清除历史记录失败:', error);
            throw error;
        }
    }

}

export const chatHistory = ChatHistoryManager.getInstance(); 