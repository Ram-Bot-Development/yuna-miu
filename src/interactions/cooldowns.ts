export class CooldownService {
    private readonly until = new Map<string, number>();
    private readonly hits = new Map<string, number[]>();

    /**
     * Reserves every key for the same window, or reserves none of them.
     * A failed check does not start the clock.
     */
    reserve(keys: readonly string[], seconds: number, now: number): { ok: true } | { ok: false; retryAfterMs: number } {
        this.prune(now);
        let wait = 0;
        for (const key of keys) {
            const end = this.until.get(key) ?? 0;
            if (end > now) wait = Math.max(wait, end - now);
        }
        if (wait > 0) return { ok: false, retryAfterMs: wait };
        const until = now + Math.max(1, seconds) * 1000;
        for (const key of keys) this.until.set(key, until);
        return { ok: true };
    }

    /** How long the longest key has left. Does not start a cooldown. */
    retryAfter(keys: readonly string[], now: number): number {
        let wait = 0;
        for (const key of keys) {
            const end = this.until.get(key) ?? 0;
            if (end > now) wait = Math.max(wait, end - now);
        }
        return wait;
    }

    /** Sliding window. A rejected call is not recorded. */
    allow(key: string, limit: number, windowMs: number, now: number): boolean {
        const fresh = (this.hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
        if (fresh.length >= limit) {
            this.hits.set(key, fresh);
            return false;
        }
        fresh.push(now);
        this.hits.set(key, fresh);
        return true;
    }

    private prune(now: number): void {
        if (this.until.size < 5000 && this.hits.size < 5000) return;
        for (const [key, end] of this.until) {
            if (end <= now) this.until.delete(key);
        }
        for (const [key, stamps] of this.hits) {
            const fresh = stamps.filter((stamp) => now - stamp < 120_000);
            if (fresh.length === 0) this.hits.delete(key);
            else this.hits.set(key, fresh);
        }
    }
}

export function autoCooldownKeys(guildId: string, channelId: string, userId: string): string[] {
    return [`auto:guild:${guildId}`, `auto:channel:${channelId}`, `auto:user:${guildId}:${userId}`];
}

export function paceCopy(retryAfterMs: number): string {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return `Give me about ${seconds}s. I get noisy if I don't pace myself.`;
}
