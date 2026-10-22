import { MOODS, type MoodId } from './moods.js';

export interface MoodSnapshot {
    id: MoodId;
    since: number;
    until: number;
}

export type Rng = () => number;

/** First roll stays on Happy or Cozy. Later rolls can use the full set. */
const STARTER: readonly MoodId[] = ['happy', 'cozy'];
const ALL: readonly MoodId[] = MOODS.map((mood) => mood.id);

export const DEFAULT_MOOD_HOLD_MS = 30 * 60 * 1000;

function pickFrom(options: readonly MoodId[], rng: Rng): MoodId {
    const index = Math.min(options.length - 1, Math.floor(rng() * options.length));
    return options[index] ?? 'happy';
}

/**
 * Holds one fictional style for a while so a conversation does not flip every reply.
 * Turning variation off pins the style to Happy.
 */
export function nextMood(
    current: MoodSnapshot | undefined,
    now: number,
    variationEnabled: boolean,
    rng: Rng,
    holdMs = DEFAULT_MOOD_HOLD_MS,
): MoodSnapshot {
    if (!variationEnabled) {
        return {
            id: 'happy',
            since: current?.id === 'happy' ? current.since : now,
            until: now + holdMs,
        };
    }

    if (current && now < current.until) return current;

    const options = current ? ALL.filter((id) => id !== current.id) : STARTER;
    const id = pickFrom(options.length > 0 ? options : STARTER, rng);
    return { id, since: now, until: now + holdMs };
}
