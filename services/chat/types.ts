export type ChatType = 'text' | 'image';
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatConf {
    models: Array<{
        title: string;
        type: 'mm' | 'vl' | 'text';
        model: string;
        apiBase: string;
        apiKey: string;
        provider: string;
    }>;
    activeOCRModel: string;
    activeSolvingModel: string;
}

export interface ChatInput {
    text?: string;
    imageUri?: string;
    originalUri?: string;
}

export interface ChatTurn {
    turn: number;     // 位置索引
    messages: string[];   // 该位置的消息ID列表
    version: number; // 当前显示的消息版本
}

export interface ChatMessage {
    id: string;           // 消息唯一ID
    role: ChatRole;
    content?: string;
    imageUri?: string;
    originalUri?: string;
    timestamp: number;
    turn: number;     // 消息在对话中的位置
    version: number;      // 该位置的消息版本
}

export interface ChatSession {
    id: string;
    title: string;
    turns: ChatTurn[];
    timestamp: number;
}