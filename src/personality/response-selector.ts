import { SAFE_LINE } from './character.js';
import type { Rng } from './mood-selector.js';

/** Remembers the last line per key so the next pick can skip it. */
export class ResponseSelector {
    private readonly last = new Map<string, string>();

    pick(key: string, lines: readonly string[], rng: Rng): string {
        const usable = lines.map((line) => line.trim()).filter((line) => line.length > 0);
        if (usable.length === 0) return SAFE_LINE;

        const previous = this.last.get(key);
        const choices = usable.length > 1 && previous ? usable.filter((line) => line !== previous) : usable;
        const pool = choices.length > 0 ? choices : usable;
        const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
        const line = pool[index] ?? SAFE_LINE;
        this.last.set(key, line);
        if (this.last.size > 5000) {
            const oldest = this.last.keys().next().value;
            if (oldest) this.last.delete(oldest);
        }
        return line;
    }
}
