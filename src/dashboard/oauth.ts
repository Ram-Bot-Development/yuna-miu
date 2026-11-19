import { canManageDashboardGuild } from './access.js';
import { redirectUri, type DashboardConfig } from './config.js';
import { isSnowflake } from '../personality/safety.js';

const API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (yuna-miu, 0.1.0)';

export interface DiscordGuildAccess {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; unauthorized: boolean; status: number };

export function authorizeUrl(config: DashboardConfig, state: string): string {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri(config));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify guilds');
    url.searchParams.set('state', state);
    return url.toString();
}

export function inviteUrl(clientId: string): string {
    return (
        `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
        '&permissions=19456&scope=bot%20applications.commands'
    );
}

export async function exchangeCode(
    fetchImpl: typeof fetch,
    config: DashboardConfig,
    code: string,
): Promise<ApiResult<{ accessToken: string; expiresIn: number }>> {
    const response = await request(fetchImpl, `${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri(config),
        }),
    });
    if (!response.ok) return response;
    const token = readToken(response.value);
    if (!token) return { ok: false, unauthorized: false, status: 0 };
    return { ok: true, value: token };
}

export async function fetchIdentity(
    fetchImpl: typeof fetch,
    accessToken: string,
): Promise<ApiResult<{ id: string; username: string }>> {
    const response = await getJson(fetchImpl, `${API}/users/@me`, accessToken);
    if (!response.ok) return response;
    const identity = readIdentity(response.value);
    if (!identity) return { ok: false, unauthorized: false, status: 0 };
    return { ok: true, value: identity };
}

export async function fetchManageableGuilds(
    fetchImpl: typeof fetch,
    accessToken: string,
): Promise<ApiResult<DiscordGuildAccess[]>> {
    const response = await getJson(fetchImpl, `${API}/users/@me/guilds`, accessToken);
    if (!response.ok) return response;
    const guilds = readGuildList(response.value);
    if (!guilds) return { ok: false, unauthorized: false, status: 0 };
    return { ok: true, value: guilds };
}

export function readIdentity(raw: unknown): { id: string; username: string } | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== 'string' || !isSnowflake(row.id)) return null;
    const globalName = typeof row.global_name === 'string' ? row.global_name.trim() : '';
    const username = typeof row.username === 'string' ? row.username.trim() : '';
    const display = (globalName || username).slice(0, 64);
    if (!display) return null;
    return { id: row.id, username: display };
}

/** Manageable guilds, or null when the payload is not a guild list. */
export function readGuildList(raw: unknown): DiscordGuildAccess[] | null {
    if (!Array.isArray(raw)) return null;
    const guilds: DiscordGuildAccess[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') return null;
        const guild = readGuild(item as Record<string, unknown>);
        if (!guild) continue;
        if (canManageDashboardGuild(guild)) guilds.push(guild);
    }
    guilds.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return guilds;
}

async function getJson(fetchImpl: typeof fetch, url: string, accessToken: string): Promise<ApiResult<unknown>> {
    return request(fetchImpl, url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
        },
    });
}

async function request(fetchImpl: typeof fetch, url: string, init: RequestInit, attempt = 0): Promise<ApiResult<unknown>> {
    let response: Response;
    try {
        response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(10_000) });
    } catch {
        if (attempt < 1) return request(fetchImpl, url, init, attempt + 1);
        return { ok: false, unauthorized: false, status: 0 };
    }
    if (response.status === 429 && attempt < 1) {
        await wait(retryWaitMs(response));
        return request(fetchImpl, url, init, attempt + 1);
    }
    if (response.status === 401) return { ok: false, unauthorized: true, status: 401 };
    if (!response.ok) return { ok: false, unauthorized: false, status: response.status };
    try {
        return { ok: true, value: await response.json() };
    } catch {
        return { ok: false, unauthorized: false, status: 0 };
    }
}

function retryWaitMs(response: Response): number {
    const header = Number(response.headers.get('retry-after'));
    const seconds = Number.isFinite(header) && header >= 0 ? header : 0.25;
    return Math.min(2_000, Math.ceil(seconds * 1000));
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readToken(raw: unknown): { accessToken: string; expiresIn: number } | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.access_token !== 'string' || row.access_token.length < 10 || row.access_token.length > 4096) return null;
    if (typeof row.expires_in !== 'number' || !Number.isFinite(row.expires_in)) return null;
    const expiresIn = Math.floor(row.expires_in);
    if (expiresIn < 30) return null;
    return { accessToken: row.access_token, expiresIn: Math.min(expiresIn, 7 * 24 * 60 * 60) };
}

function readGuild(row: Record<string, unknown>): DiscordGuildAccess | null {
    if (typeof row.id !== 'string' || !isSnowflake(row.id)) return null;
    if (typeof row.name !== 'string') return null;
    const permissions = permissionString(row.permissions);
    if (permissions == null && row.owner !== true) return null;
    return {
        id: row.id,
        name: row.name.trim().slice(0, 100) || row.id,
        icon: iconHash(row.icon),
        owner: row.owner === true,
        permissions: permissions ?? '',
    };
}

/** Discord CDN icon, or null when the guild has no safe icon hash. */
export function guildIconUrl(id: string, icon: string | null): string | null {
    if (!icon || !isSnowflake(id)) return null;
    const ext = icon.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=128`;
}

function iconHash(value: unknown): string | null {
    if (typeof value !== 'string' || !/^(?:a_)?[A-Za-z0-9_]{2,64}$/.test(value)) return null;
    return value;
}

function permissionString(value: unknown): string | null {
    if (typeof value === 'string' && /^\d+$/.test(value)) return value;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
    return null;
}
