import type { ChatTurn } from './types.js';

interface StoredTurn extends ChatTurn {
    at: number;
}

/** Process memory only. Nothing here is written to the settings file. */
export class MemoryContext {
    private readonly turns = new Map<string, StoredTurn[]>();

    constructor(private readonly ttlMs = 10 * 60 * 1000) {}

    recent(key: string, limit: number, now: number): ChatTurn[] {
        if (limit <= 0) return [];
        const fresh = this.fresh(key, now).slice(-limit);
        this.turns.set(key, fresh);
        return fresh.map((turn) => ({ role: turn.role, content: turn.content }));
    }

    push(key: string, role: ChatTurn['role'], content: string, now: number, limit: number): void {
        if (limit <= 0 || !content.trim()) return;
        const fresh = this.fresh(key, now);
        fresh.push({ role, content, at: now });
        this.turns.set(key, fresh.slice(-limit));
    }

    size(key: string): number {
        return this.turns.get(key)?.length ?? 0;
    }

    private fresh(key: string, now: number): StoredTurn[] {
        return (this.turns.get(key) ?? []).filter((turn) => now - turn.at <= this.ttlMs);
    }
}
