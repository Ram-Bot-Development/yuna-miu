import type { AiCompletionRequest, AiProvider } from './types.js';

export interface OpenAiCompatibleOptions {
    id: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    fetchImpl?: typeof fetch;
}

/**
 * Talks to any chat-completions endpoint, including a local server.
 * The model name, URL, and key always come from the caller.
 */
export class OpenAiCompatibleProvider implements AiProvider {
    readonly id: string;
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly model: string;
    private readonly fetchImpl: typeof fetch;

    constructor(options: OpenAiCompatibleOptions) {
        this.id = options.id;
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    async complete(request: AiCompletionRequest): Promise<string> {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
        const response = await this.fetchImpl(chatUrl(this.baseUrl), {
            method: 'POST',
            headers,
            signal: request.signal,
            body: JSON.stringify({
                model: this.model,
                messages: [{ role: 'system', content: request.system }, ...request.messages],
                max_tokens: request.maxTokens,
                temperature: 0.8,
            }),
        });
        if (!response.ok) throw new Error(`AI provider status ${response.status}`);
        const payload = (await response.json()) as unknown;
        const text = readContent(payload);
        if (!text) throw new Error('AI provider returned an empty reply');
        return text;
    }
}

export function chatUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    return `${trimmed}/chat/completions`;
}

function readContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return '';
    const message = (choices[0] as { message?: unknown }).message;
    if (!message || typeof message !== 'object') return '';
    const content = (message as { content?: unknown }).content;
    return typeof content === 'string' ? content : '';
}
