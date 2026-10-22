import type { Log } from '../../log.js';
import { clampText, sanitizeOutgoing } from '../safety.js';
import type { MoodId } from '../moods.js';
import { CooldownService } from '../../interactions/cooldowns.js';
import { MemoryContext } from './memory-context.js';
import { buildSystemPrompt } from './prompt-builder.js';
import type { AiProvider } from './types.js';

const AI_NOTE = '*(AI model, in Yuna\'s voice)*';

export interface ComposeAiInput {
    fallback: string;
    provider: AiProvider | null;
    guildAllowsAi: boolean;
    userAllowsAi: boolean;
    contextEnabled: boolean;
    sensitive: boolean;
    userText: string;
    mood: MoodId;
    memory: MemoryContext;
    memoryKey: string;
    cooldowns: CooldownService;
    guildId: string;
    userId: string;
    now: number;
    timeoutMs: number;
    maxTokens: number;
    contextLimit: number;
    userPerMinute: number;
    guildPerMinute: number;
    log: Log;
}

export async function composeWithOptionalAi(input: ComposeAiInput): Promise<{ text: string; usedAi: boolean }> {
    const fallback = clampText(sanitizeOutgoing(input.fallback)) || 'Miu~! I am here.';
    if (!canAsk(input)) return { text: fallback, usedAi: false };

    const guildOk = input.cooldowns.allow(`ai:guild:${input.guildId}`, input.guildPerMinute, 60_000, input.now);
    if (!guildOk) return { text: fallback, usedAi: false };
    const userOk = input.cooldowns.allow(`ai:user:${input.guildId}:${input.userId}`, input.userPerMinute, 60_000, input.now);
    if (!userOk) return { text: fallback, usedAi: false };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    const aborted = rejectOnAbort(controller.signal);
    aborted.catch(() => undefined);
    try {
        const history = input.contextEnabled ? input.memory.recent(input.memoryKey, input.contextLimit, input.now) : [];
        const provider = input.provider;
        if (!provider) return { text: fallback, usedAi: false };
        const pending = provider.complete({
            system: buildSystemPrompt(input.mood),
            messages: [...history, { role: 'user', content: input.userText.trim() }],
            maxTokens: input.maxTokens,
            signal: controller.signal,
        });
        pending.catch(() => undefined);
        const reply = await Promise.race([pending, aborted]);
        const text = clampText(sanitizeOutgoing(reply));
        if (!text) return { text: fallback, usedAi: false };
        if (input.contextEnabled) {
            input.memory.push(input.memoryKey, 'user', input.userText.trim(), input.now, input.contextLimit);
            input.memory.push(input.memoryKey, 'assistant', text, input.now, input.contextLimit);
        }
        return { text: `${text}\n${AI_NOTE}`, usedAi: true };
    } catch (error) {
        const name = error instanceof Error ? error.name : 'Error';
        input.log.warn(`AI reply failed (${name}). Used a scripted line instead.`);
        return { text: fallback, usedAi: false };
    } finally {
        clearTimeout(timer);
        controller.abort();
    }
}

function canAsk(input: ComposeAiInput): boolean {
    if (!input.provider || !input.guildAllowsAi || !input.userAllowsAi) return false;
    if (input.sensitive || !input.userText.trim()) return false;
    return true;
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
    return new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('The operation was aborted.', 'TimeoutError'));
        if (signal.aborted) fail();
        else signal.addEventListener('abort', fail, { once: true });
    });
}
