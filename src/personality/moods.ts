export const MOODS = [
    { id: 'happy', label: 'Happy', blurb: 'Cheerful and upbeat wording.' },
    { id: 'playful', label: 'Playful', blurb: 'Mischievous, still friendly.' },
    { id: 'sleepy', label: 'Sleepy', blurb: 'Calmer and softer.' },
    { id: 'curious', label: 'Curious', blurb: 'Interested in what you are making.' },
    { id: 'excited', label: 'Excited', blurb: 'Energetic, without shouting every line.' },
    { id: 'cozy', label: 'Cozy', blurb: 'Warm and low-key.' },
] as const;

export type MoodId = (typeof MOODS)[number]['id'];

const MOOD_IDS = new Set<string>(MOODS.map((mood) => mood.id));

export function isMoodId(value: string): value is MoodId {
    return MOOD_IDS.has(value);
}

export function moodById(id: MoodId): (typeof MOODS)[number] {
    const mood = MOODS.find((item) => item.id === id);
    if (!mood) return MOODS[0];
    return mood;
}
