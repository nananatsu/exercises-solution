import OpenAI from 'openai';

interface OpenAIConfig {
    apiKey: string;
    apiBase: string;
}

let openaiInstances: Map<string, OpenAI> = new Map();

export function createOpenAI(config: OpenAIConfig): OpenAI {
    if (openaiInstances.has(config.apiBase)) {
        return openaiInstances.get(config.apiBase)!;
    }

    const baseURL = config.apiBase;
    const openaiInstance = new OpenAI({
        apiKey: config.apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true, // 允许在浏览器中使用
    });
    openaiInstances.set(config.apiBase, openaiInstance);
    return openaiInstance;
}