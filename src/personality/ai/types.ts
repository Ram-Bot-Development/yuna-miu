export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiCompletionRequest {
    system: string;
    messages: readonly ChatTurn[];
    maxTokens: number;
    signal: AbortSignal;
}

/** A model adapter. Implementations must not execute tools or shell commands. */
export interface AiProvider {
    readonly id: string;
    complete(request: AiCompletionRequest): Promise<string>;
}

export interface AiRuntimeConfig {
    provider: AiProvider | null;
    timeoutMs: number;
    maxTokens: number;
    contextMessages: number;
    userPerMinute: number;
    guildPerMinute: number;
    unavailableReason: string | null;
}
