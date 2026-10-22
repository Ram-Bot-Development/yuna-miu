import type { SocialActionId } from '../config/social-actions.js';
import { clampText, sanitizeOutgoing } from '../personality/safety.js';
import {
    imageKindForAction,
    readImageUrl,
    resolveImage,
    type FoundImage,
    type ImageKind,
    type RamImageKind,
} from './resolve-image.js';

const RAM_GAP_MS = 1200;
let nextRamAt = 0;
let ramClient: { call(kind: RamImageKind): Promise<unknown> } | null = null;

async function ramCall(kind: RamImageKind): Promise<unknown> {
    if (!ramClient) {
        const { DemoEndpoints } = await import('ram-api.js');
        const demo = new DemoEndpoints(0, 0);
        ramClient = {
            call(requested) {
                switch (requested) {
                    case 'hug':
                        return demo.hugAsync();
                    case 'kiss':
                        return demo.kissAsync();
                    case 'cuddle':
                        return demo.cuddleAsync();
                    case 'slap':
                        return demo.slapAsync();
                    case 'laugh':
                        return demo.laughAsync();
                    case 'cry':
                        return demo.cryAsync();
                    case 'tired':
                        return demo.tiredAsync();
                    case 'sick':
                        return demo.sickAsync();
                    case 'meme':
                        return demo.memeAsync();
                    case 'ram':
                        return demo.ramAsync();
                    case 'nekopara':
                        return demo.nekoparaAsync();
                    case 'miku':
                        return demo.mikuAsync();
                    case 'goodMorning':
                        return demo.goodMorningAsync();
                    case 'goodNight':
                        return demo.goodNightAsync();
                    case 'animal':
                        return demo.animalAsync();
                    default:
                        return Promise.resolve(null);
                }
            },
        };
    }
    return ramClient.call(kind);
}

export async function fetchRamImage(kind: RamImageKind): Promise<string | null> {
    const now = Date.now();
    if (now < nextRamAt) return null;
    nextRamAt = now + RAM_GAP_MS;
    try {
        return readImageUrl(await ramCall(kind));
    } catch {
        return null;
    }
}

export async function fetchNekoImage(fetchImpl: typeof fetch = fetch): Promise<FoundImage | null> {
    try {
        const response = await fetchImpl('https://nekos.best/api/v2/neko', { signal: AbortSignal.timeout(4000) });
        if (!response.ok) return null;
        const body = (await response.json()) as { results?: { url?: unknown; artist_name?: unknown }[] };
        const item = body.results?.[0];
        const url = readImageUrl(item);
        if (!url) return null;
        const artist = typeof item?.artist_name === 'string' ? clampText(sanitizeOutgoing(item.artist_name), 80) : '';
        return { url, source: 'neko', fellBack: false, credit: artist || undefined };
    } catch {
        return null;
    }
}

export function findImage(kind: ImageKind): Promise<FoundImage | null> {
    return resolveImage(kind, { ram: fetchRamImage, neko: () => fetchNekoImage() });
}

export function findActionImage(action: SocialActionId): Promise<FoundImage | null> {
    return findImage(imageKindForAction(action));
}
