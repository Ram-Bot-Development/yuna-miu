export type MentionKind = 'sensitive' | 'caring' | 'greeting' | 'celebration' | 'curious' | 'general';
export type ContextualKind = 'celebration' | 'morning' | 'news' | 'game';

const SENSITIVE =
    /\b(suicid\w*|self[-\s]?harm|kill myself|killing myself|want to die|end my life|kms)\b/i;
const SERIOUS =
    /\b(exhausted|exhausting|tired|sad|depressed|depressing|rough day|bad day|overwhelmed|anxious|anxiety|lonely|grief|funeral)\b/i;
const GREETING = /\b(hi+|hello|hey+|yo|good morning|good night)\b/i;
const CELEBRATION = /\b(i (finally )?(won|beat|passed|finished)|we (won|did it)|got the job)\b/i;
const CURIOUS = /\b(i'm working on|im working on|my project|new project)\b/i;
const MORNING = /\bgood morning\b/i;
const NEWS = /\b(exciting news|big news|guess what)\b/i;
const GAME = /\b(beat the boss|boss fight|new high score|clutch(?:ed)?|ranked win)\b/i;

export function isSensitive(text: string): boolean {
    return SENSITIVE.test(text);
}

export function isSerious(text: string): boolean {
    return SERIOUS.test(text);
}

/** Keyword hints only. This is not an understanding of how someone feels. */
export function classifyMention(content: string): MentionKind {
    const text = content.slice(0, 500);
    if (isSensitive(text)) return 'sensitive';
    if (isSerious(text)) return 'caring';
    if (CELEBRATION.test(text)) return 'celebration';
    if (CURIOUS.test(text)) return 'curious';
    if (GREETING.test(text)) return 'greeting';
    return 'general';
}

export function classifyContextual(content: string): ContextualKind | null {
    const text = content.slice(0, 500);
    if (isSensitive(text) || isSerious(text)) return null;
    if (CELEBRATION.test(text)) return 'celebration';
    if (MORNING.test(text)) return 'morning';
    if (NEWS.test(text)) return 'news';
    if (GAME.test(text)) return 'game';
    return null;
}
