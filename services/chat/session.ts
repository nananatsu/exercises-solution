import { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, ChatCompletionUserMessageParam } from 'openai/resources/chat/completions';
import { createOpenAI } from '@/services/openai';
import { chatHistory, } from './history';
import { ChatConf, ChatInput, ChatMessage, ChatRole, ChatSession, ChatTurn } from './types';
import OpenAI from 'openai';

const systemPrompt = `你是一个专业的解题助手，擅长解答数学、物理、化学等学科的题目。

请按照以下格式进行解答：

# 解题思路
[分析题目要求，列出已知条件和目标]

# 详细步骤
1. [第一步]
2. [第二步]
...

# 最终答案
[给出最终结果]

注意事项：
1. 所有数学公式和方程式必须使用 LaTeX 格式书写
2. 重要的计算步骤要详细展示
3. 如果有多种解法，请说明最优解法
4. 如果题目信息不完整或有歧义，请指出并说明假设条件
5. 对于物理化学题目，需要说明使用的定理或原理
6. 适当添加图示说明（使用文字描述）`;

const ocrSystemPrompt = `你是一个专业的题目识别助手，主要负责识别数学、物理、化学等学科的试题。

请注意以下要求：
1. 只识别纯文字题目，如果题目包含几何图形、坐标系图、示意图等非纯文字内容，则返回识别失败
2. 对于数学符号，需要转换为 LaTeX 格式
3. 返回格式必须是合法的 JSON 字符串：{ "success": boolean, "text": string }
   - success: true 表示识别成功，false 表示识别失败
   - text: 识别成功时返回题目文本，失败时返回失败原因

示例输出：
成功：{"success":true,"text":"已知函数f(x)=2x+1，求f(3)的值。"}
失败：{"success":false,"text":"题目包含非纯文字内容，无法识别"}`;

export class Session {

    private session: ChatSession;
    private messages: Record<string, ChatMessage>;
    public currentMessages: ChatMessage[];

    private needOcr: boolean = false;
    private recognizeText?: (imageUrl: string) => Promise<string>;

    private solvingModel: string;
    private solvingClient: OpenAI;

    constructor(conf: ChatConf, session: ChatSession, messages: Record<string, ChatMessage>) {
        if (!conf.activeSolvingModel) {
            throw new Error('未设置解题模型');
        }
        const solvingModel = conf.models.find(m => m.title === conf.activeSolvingModel);
        if (!solvingModel) {
            throw new Error(`解题模型 ${conf.activeSolvingModel} 未找到`);
        }

        this.solvingModel = solvingModel.model;
        this.solvingClient = createOpenAI({
            apiKey: solvingModel.apiKey,
            apiBase: solvingModel.apiBase,
        });

        if (solvingModel.type === 'text') {
            this.needOcr = true;
            if (!conf.activeOCRModel) {
                throw new Error('解题模型为文本模型时，需设置题目识别模型');
            }
            const ocrModel = conf.models.find(m => m.title === conf.activeOCRModel);
            if (!ocrModel) {
                throw new Error('题目识别模型未找到');
            }
            this.recognizeText = this.recognizeTextFunction(ocrModel.model, createOpenAI({
                apiKey: ocrModel.apiKey,
                apiBase: ocrModel.apiBase,
            }));
        }

        this.session = session;
        this.messages = messages;

        this.currentMessages = this.getCurrentMessages();

    }

    // 获取当前显示的消息列表
    private getCurrentMessages(): ChatMessage[] {
        return this.session.turns.map(turn => {
            const messageId = turn.messages[turn.version];
            return this.messages[messageId];
        });
    }

    // 获取指定位置的当前消息
    getCurrentMessage(turn: number): ChatMessage | null {
        const t = this.session.turns[turn];
        if (!t) return null;
        const messageId = t.messages[t.version];
        return this.messages[messageId] || null;
    }

    nextMessageId(): string {
        return `${this.session.id}_msg_${Object.keys(this.messages).length + 1}`;
    }

    getMessage(messageId: string): ChatMessage | null {
        return this.messages[messageId] || null;
    }

    getTurn(turn: number): ChatTurn | null {
        return this.session.turns[turn] || null;
    }

    // 创建用户消息
    async createMessage(turn: number, role: ChatRole, { text, imageUri, originalUri }: ChatInput): Promise<ChatMessage> {
        if (turn < 0) {
            turn = this.session.turns.length;
        }
        const message: ChatMessage = {
            id: this.nextMessageId(),
            role,
            content: text,
            imageUri,
            originalUri,
            timestamp: Date.now(),
            turn,
            version: 0
        };

        if (turn >= this.session.turns.length) {
            this.session.turns.push({
                turn,
                messages: [message.id],
                version: 0
            });
            this.currentMessages.push(message);
        } else {
            const t = this.session.turns[turn];
            if (!t) throw new Error(`对话轮次${turn}不存在`);

            t.messages.push(message.id);
            t.version = t.messages.length - 1;
            this.currentMessages[turn] = message;
        }
        this.messages[message.id] = message;

        await chatHistory.updateSession(this.session, message);
        return message;
    }

    // 创建用户消息
    async createUserMessage(input: ChatInput): Promise<ChatMessage> {
        if (input.imageUri && this.needOcr) {
            console.log("识别题目", input.imageUri)
            const text = await this.recognizeText!(input.imageUri);
            if (!text) {
                throw new Error('识别题目失败');
            }
            return await this.createMessage(-1, 'user', { text, imageUri: undefined, originalUri: input.originalUri ? input.originalUri : input.imageUri });
        }

        return await this.createMessage(-1, 'user', input);
    }

    async updateUserMessage(turn: number, input: ChatInput): Promise<ChatMessage> {
        return await this.createMessage(turn, 'user', input);
    }

    // 创建助手消息
    async createAssistantMessage(content: string): Promise<ChatMessage> {
        return await this.createMessage(-1, 'assistant', { text: content, });
    }

    async updateAssistantMessage(turn: number, content: string): Promise<ChatMessage> {
        return await this.createMessage(turn, 'assistant', { text: content });
    }

    recognizeTextFunction(ocrModel: string, ocrClient: OpenAI): (imageUrl: string) => Promise<string> {
        return async (imageUrl: string) => {
            try {
                const response = await ocrClient.chat.completions.create({
                    model: ocrModel,
                    messages: [
                        {
                            role: 'system',
                            content: ocrSystemPrompt,
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageUrl,
                                    },
                                },
                                {
                                    type: 'text',
                                    text: '请识别这道题目。如果题目包含公式或其他非纯文字内容，请返回识别失败。',
                                },
                            ],
                        },
                    ],
                    response_format: { type: 'json_object' },
                });

                const result = JSON.parse(response.choices[0].message.content || '');
                if (!result.success) {
                    throw new Error(result.text);
                }
                console.log('识别结果：', result);
                return result.text;
            } catch (error) {
                console.error('OCR failed:', error);
                throw new Error(error instanceof Error ? error.message : '识别文字失败');
            }
        }
    }

    // 获取LLM所需的消息格式
    getChatCompletionMessages(turn: number): ChatCompletionMessageParam[] {
        return this.currentMessages
            .filter(msg => (!msg.content || !msg.imageUri) && msg.turn <= turn)
            .map(msg => {
                if (msg.role == 'user') {
                    if (msg.imageUri) {
                        const param: ChatCompletionUserMessageParam = {
                            role: "user",
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: msg.imageUri,
                                    },
                                },
                                {
                                    type: 'text',
                                    text: '请解答这道题目，给出详细的解题步骤。如果题目中包含图片，请在分析中说明图片中的重要信息。',
                                },
                            ],
                        }
                        return param;
                    } else {
                        const param: ChatCompletionUserMessageParam = {
                            role: "user",
                            content: msg.content as string,
                        }
                        return param;
                    }
                } else {
                    const param: ChatCompletionAssistantMessageParam = {
                        role: "assistant",
                        content: msg.content,
                    }
                    return param;
                }
            });
    }

    async resetChat(turn: number): Promise<void> {
        const removeIds = this.session.turns.slice(turn).map(t => t.messages).flat();
        this.session.turns = this.session.turns.slice(0, turn);
        this.currentMessages = this.getCurrentMessages();
        await chatHistory.resetSession(this.session, removeIds);
    }

    async refreshChat(turn: number): Promise<string> {
        const currentMessage = this.currentMessages[turn];
        if (!currentMessage) throw new Error(`消息${turn}不存在`);
        if (currentMessage.role === "user") {
            if (turn < this.session.turns.length - 1) {
                await this.resetChat(turn + 1);
            }
            return await this.chat(turn);
        } else {
            if (turn < this.session.turns.length - 1) {
                await this.resetChat(turn + 1);
            }
            return await this.chat(turn - 1);
        }
    }

    // 发送消息到LLM
    async chat(turn?: number): Promise<string> {
        try {
            if (!turn) {
                turn = this.session.turns.length - 1;
            }

            const messages = this.getChatCompletionMessages(turn);
            messages.unshift({
                role: 'system',
                content: systemPrompt,
            });

            const response = await this.solvingClient.chat.completions.create({
                model: this.solvingModel,
                messages,
                temperature: 0.7,
                presence_penalty: 0.1,
            });
            return response.choices[0].message.content || '';
        } catch (error) {
            console.error('LLM请求失败:', error);
            throw error;
        }
    }

    // 切换消息版本
    async switchVersion(turn: number, version: number): Promise<void> {
        this.session.turns[turn].version = version;
        const message = this.getCurrentMessage(turn);
        if (!message) throw new Error(`消息${turn} ${version}不存在`);
        this.currentMessages[turn] = message;

        await chatHistory.updateSession(this.session);
    }
} 
