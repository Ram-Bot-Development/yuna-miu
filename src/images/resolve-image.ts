import type { SocialActionId } from '../config/social-actions.js';

export const RAM_IMAGE_KINDS = [
    'hug',
    'kiss',
    'cuddle',
    'slap',
    'laugh',
    'cry',
    'tired',
    'sick',
    'meme',
    'ram',
    'nekopara',
    'miku',
    'goodMorning',
    'goodNight',
    'animal',
] as const;

export type RamImageKind = (typeof RAM_IMAGE_KINDS)[number];
export type ImageKind = RamImageKind | 'neko';

const RAM_KIND_SET = new Set<string>(RAM_IMAGE_KINDS);

export function isRamImageKind(value: string): value is RamImageKind {
    return RAM_KIND_SET.has(value);
}

/** Hug is the social action Ram API actually has a picture for. The others use a neko. */
export function imageKindForAction(action: SocialActionId): ImageKind {
    if (action === 'hug') return 'hug';
    return 'neko';
}

export interface FoundImage {
    url: string;
    source: 'ram' | 'neko';
    credit?: string;
    fellBack: boolean;
}

export function httpsUrl(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 2000) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        return url.toString();
    } catch {
        return null;
    }
}

export function readImageUrl(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const record = data as { url?: unknown; image?: unknown };
    return httpsUrl(record.url) ?? httpsUrl(record.image);
}

export async function resolveImage(
    kind: ImageKind,
    deps: {
        ram: (kind: RamImageKind) => Promise<string | null>;
        neko: () => Promise<FoundImage | null>;
    },
): Promise<FoundImage | null> {
    if (kind === 'neko') {
        const image = await deps.neko();
        return image ? { ...image, source: 'neko', fellBack: false } : null;
    }
    try {
        const url = await deps.ram(kind);
        if (url) return { url, source: 'ram', fellBack: false };
    } catch {
        // Fall through to a neko image.
    }
    const fallback = await deps.neko();
    if (!fallback) return null;
    return { ...fallback, source: 'neko', fellBack: true };
}
