import type { AiRuntimeConfig } from './types.js';
import { OpenAiCompatibleProvider } from './openai-compatible.js';
import { RamAiProvider } from './ram-ai.js';

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
    if (!value?.trim()) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function createAiRuntime(env: NodeJS.ProcessEnv = process.env): AiRuntimeConfig {
    const name = env.AI_PROVIDER?.trim().toLowerCase() ?? '';
    const ram = name === 'ram-ai' || name === 'ram';
    const timeoutMs = integer(env.AI_TIMEOUT_MS, ram ? 600_000 : 15_000, 1000, 1_200_000);
    const maxTokens = integer(env.AI_MAX_OUTPUT_TOKENS, 300, 32, 1000);
    const contextMessages = integer(env.AI_CONTEXT_MESSAGES, 6, 0, 20);
    const userPerMinute = integer(env.AI_USER_PER_MINUTE, 5, 1, 30);
    const guildPerMinute = integer(env.AI_GUILD_PER_MINUTE, 10, 1, 60);
    const base = { timeoutMs, maxTokens, contextMessages, userPerMinute, guildPerMinute, provider: null };

    if (!name || name === 'none' || name === 'off') {
        return { ...base, unavailableReason: null };
    }
    if (ram) {
        const apiKey = (env.RAM_AI_API_KEY ?? env.AI_API_KEY)?.trim() ?? '';
        if (!apiKey) {
            return { ...base, unavailableReason: 'RAM_AI_API_KEY or AI_API_KEY is required for the ram-ai adapter.' };
        }
        return {
            ...base,
            unavailableReason: null,
            provider: new RamAiProvider({
                baseUrl: (env.RAM_AI_BASE_URL ?? env.AI_BASE_URL)?.trim() || undefined,
                apiKey,
                model: env.AI_MODEL,
            }),
        };
    }
    if (name !== 'openai-compatible' && name !== 'local') {
        return { ...base, unavailableReason: 'AI_PROVIDER is not a supported adapter.' };
    }
    const baseUrl = env.AI_BASE_URL?.trim() ?? '';
    const model = env.AI_MODEL?.trim() ?? '';
    if (!baseUrl || !model) {
        return { ...base, unavailableReason: 'AI_BASE_URL and AI_MODEL are both required when AI is enabled.' };
    }
    return {
        ...base,
        unavailableReason: null,
        provider: new OpenAiCompatibleProvider({
            id: name,
            baseUrl,
            apiKey: env.AI_API_KEY?.trim() ?? '',
            model,
        }),
    };
}
