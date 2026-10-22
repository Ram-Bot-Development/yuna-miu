import type { AiCompletionRequest, AiProvider, ChatTurn } from './types.js';

/** Public Ram AI origin. Override with RAM_AI_BASE_URL or AI_BASE_URL. */
export const RAM_AI_ORIGIN = 'https://ai.rambot.xyz';

/** Short replies, so a Discord mention can finish before the timeout. */
export const RAM_AI_DEFAULT_MODEL = 'ram-ai-2-fast';

/** Public chat pool size. A third request waits here instead of stacking the shared queue. */
export const RAM_AI_PUBLIC_SLOTS = 2;

const STATUS_INTERVAL_MS = 3_000;

export interface RamAiOptions {
    baseUrl?: string;
    apiKey: string;
    model?: string;
    fetchImpl?: typeof fetch;
}

/**
 * Ram AI chat via POST /api/ask.
 * The request stays open while the shared queue runs (`: ping` lines), GET /status
 * reports that wait, and POST /task/stop cancels the job if Yuna stops waiting.
 * The key always comes from the environment. This adapter does not generate images or call tools.
 */
export class RamAiProvider implements AiProvider {
    readonly id = 'ram-ai';
    private readonly askUrl: string;
    private readonly statusUrl: string;
    private readonly stopUrl: string;
    private readonly apiKey: string;
    private readonly model: string;
    private readonly fetchImpl: typeof fetch;
    private readonly slots = new SlotQueue(RAM_AI_PUBLIC_SLOTS);

    constructor(options: RamAiOptions) {
        this.askUrl = ramAiAskUrl(options.baseUrl?.trim() || RAM_AI_ORIGIN);
        const root = this.askUrl.replace(/\/api\/ask$/, '');
        this.statusUrl = `${root}/status`;
        this.stopUrl = `${root}/task/stop`;
        this.apiKey = options.apiKey;
        this.model = options.model?.trim() || RAM_AI_DEFAULT_MODEL;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    async complete(request: AiCompletionRequest): Promise<string> {
        const release = await this.slots.acquire(request.signal);
        try {
            return await this.ask(request);
        } finally {
            release();
        }
    }

    private async ask(request: AiCompletionRequest): Promise<string> {
        const { message, history } = splitLatestUserMessage(request.messages);
        const response = await this.fetchImpl(this.askUrl, {
            method: 'POST',
            headers: this.headers(),
            signal: request.signal,
            body: JSON.stringify({
                message,
                model: this.model,
                stream: true,
                system: request.system,
                messages: history,
                max_tokens: request.maxTokens,
            }),
        });
        if (!response.ok) throw new Error(`AI provider status ${response.status}`);

        const taskId = response.headers.get('x-ramai-task-id');
        let queued = false;
        const poll = this.watchQueue(taskId, request.signal, () => {
            queued = true;
        });
        try {
            const raw = await this.readBody(response, request.signal);
            const text = readRamBody(raw, response.headers.get('content-type') ?? '');
            if (!text) {
                throw new Error(queued ? 'Ram AI queue did not finish' : 'AI provider returned an empty reply');
            }
            return text;
        } catch (error) {
            if (request.signal.aborted) await this.stop(taskId);
            throw error;
        } finally {
            poll.stop();
        }
    }

    private readBody(response: Response, signal: AbortSignal): Promise<string> {
        const reading = response.text();
        reading.catch(() => undefined);
        if (signal.aborted) {
            void response.body?.cancel().catch(() => undefined);
            return Promise.reject(aborted());
        }
        return new Promise((resolve, reject) => {
            const onAbort = () => {
                void response.body?.cancel().catch(() => undefined);
                reject(aborted());
            };
            signal.addEventListener('abort', onAbort, { once: true });
            reading.then(
                (text) => {
                    signal.removeEventListener('abort', onAbort);
                    resolve(text);
                },
                (error: unknown) => {
                    signal.removeEventListener('abort', onAbort);
                    reject(error);
                },
            );
        });
    }

    private watchQueue(taskId: string | null, signal: AbortSignal, onQueued: () => void): { stop(): void } {
        if (!taskId) return { stop() {} };
        const tick = async () => {
            try {
                const response = await this.fetchImpl(this.statusUrl, {
                    method: 'GET',
                    headers: { authorization: `Bearer ${this.apiKey}` },
                    signal,
                });
                if (!response.ok) return;
                const position = queuePosition((await response.json()) as unknown, taskId);
                if (position !== null && position > 0) onQueued();
            } catch {
                // Queue position is optional. A failed status check does not fail the reply.
            }
        };
        void tick();
        const timer = setInterval(() => void tick(), STATUS_INTERVAL_MS);
        if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
        return { stop() { clearInterval(timer); } };
    }

    private async stop(taskId: string | null): Promise<void> {
        if (!taskId) return;
        try {
            await this.fetchImpl(this.stopUrl, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify({ task_id: taskId }),
            });
        } catch {
            // Cancel is best-effort. The Discord reply already falls back.
        }
    }

    private headers(): Record<string, string> {
        return {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
        };
    }
}

export function ramAiAskUrl(baseUrl: string): string {
    let trimmed = baseUrl.trim().replace(/\/+$/, '');
    trimmed = trimmed.replace(/\/v1\/chat\/completions$/, '').replace(/\/chat\/completions$/, '').replace(/\/v1$/, '');
    if (trimmed.endsWith('/api/ask')) return trimmed;
    return `${trimmed}/api/ask`;
}

export function splitLatestUserMessage(messages: readonly ChatTurn[]): { message: string; history: ChatTurn[] } {
    const turns = [...messages];
    const last = turns[turns.length - 1];
    if (last?.role === 'user') {
        return { message: last.content, history: turns.slice(0, -1) };
    }
    return { message: turns.map((turn) => turn.content).join('\n'), history: [] };
}

const STREAM_MARKER = /\[\/?(?:stream_end|stream_start|endoftext|im_end|im_start)\]|<\|[^|\n>]{1,40}\|>/gi;

/** Drop proxy pulses (`: ping`) and stream control markers. Keep the assistant text. */
export function collectAssistantText(raw: string): string {
    const kept: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^:\s*(ping|heartbeat|keepalive)\b/i.test(trimmed)) continue;
        if (/^ping$/i.test(trimmed)) continue;
        const cleaned = trimmed.replace(STREAM_MARKER, '').replace(/[ \t]{2,}/g, ' ').trim();
        if (cleaned) kept.push(cleaned);
    }
    return kept.join('\n').trim();
}

export function readRamBody(raw: string, contentType: string): string {
    const trimmed = raw.trim();
    if (contentType.includes('json') || trimmed.startsWith('{')) {
        try {
            return readRamReply(JSON.parse(trimmed) as unknown);
        } catch {
            // A text stream can contain a brace without being a JSON reply.
        }
    }
    return collectAssistantText(raw);
}

export function readRamReply(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as { reply?: unknown; choices?: unknown };
    if (typeof record.reply === 'string') return collectAssistantText(record.reply);
    if (!Array.isArray(record.choices) || record.choices.length === 0) return '';
    const message = (record.choices[0] as { message?: { content?: unknown } }).message;
    return typeof message?.content === 'string' ? collectAssistantText(message.content) : '';
}

/**
 * Where this task sits in GET /status.
 * `0` means it is already running. A positive number means it is still queued.
 */
export function queuePosition(status: unknown, taskId: string): number | null {
    if (!status || typeof status !== 'object') return null;
    const record = status as Record<string, unknown>;
    for (const list of [record.tasks, record.active_tasks]) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (!item || typeof item !== 'object') continue;
            const row = item as Record<string, unknown>;
            const id = row.id ?? row.task_id ?? row.taskId;
            if (id !== taskId) continue;
            const position = row.position ?? row.queue_position ?? row.place;
            if (typeof position === 'number') return position;
        }
    }
    if (activeTaskIds(record).has(taskId)) return 0;
    return typeof record.tasks === 'number' ? record.tasks : null;
}

function activeTaskIds(record: Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    if (typeof record.active_task_id === 'string') ids.add(record.active_task_id);
    if (!Array.isArray(record.active_tasks)) return ids;
    for (const item of record.active_tasks) {
        if (typeof item === 'string') ids.add(item);
        else if (item && typeof item === 'object') {
            const row = item as Record<string, unknown>;
            const id = row.id ?? row.task_id ?? row.taskId;
            if (typeof id === 'string') ids.add(id);
        }
    }
    return ids;
}

class SlotQueue {
    private active = 0;
    private readonly waiters: Array<() => void> = [];

    constructor(private readonly limit: number) {}

    async acquire(signal: AbortSignal): Promise<() => void> {
        while (this.active >= this.limit) {
            if (signal.aborted) throw aborted();
            await new Promise<void>((resolve, reject) => {
                const wake = () => {
                    signal.removeEventListener('abort', onAbort);
                    resolve();
                };
                const onAbort = () => {
                    const index = this.waiters.indexOf(wake);
                    if (index >= 0) this.waiters.splice(index, 1);
                    reject(aborted());
                };
                signal.addEventListener('abort', onAbort, { once: true });
                this.waiters.push(wake);
            });
        }
        if (signal.aborted) throw aborted();
        this.active += 1;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.active -= 1;
            this.waiters.shift()?.();
        };
    }
}

function aborted(): Error {
    const error = new Error('This operation was aborted');
    error.name = 'AbortError';
    return error;
}
