import { createServer, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse } from 'node:http';
import type { Log } from '../log.js';
import { isSnowflake } from '../personality/safety.js';
import type { DashboardConfig } from './config.js';
import { guildSettingsFromForm, preferencesFromForm } from './form.js';
import {
    authorizeUrl,
    exchangeCode,
    fetchIdentity,
    fetchManageableGuilds,
    guildIconUrl,
    inviteUrl,
    type DiscordGuildAccess,
} from './oauth.js';
import { sanitizeBotIcon } from './html.js';
import { guildListPage, loginPage, messagePage as renderMessage, preferencesPage, settingsPage } from './pages.js';
import {
    cookieHeader,
    OAUTH_COOKIE,
    openSeal,
    randomId,
    readCookie,
    sameValue,
    seal,
    SESSION_COOKIE,
    SessionStore,
    type DashboardSession,
} from './session.js';
import type { DashboardBot } from './types.js';

const BODY_LIMIT = 65_536;

export interface DashboardServerOptions {
    config: DashboardConfig;
    bot: DashboardBot;
    fetchImpl?: typeof fetch;
    host?: string;
    now?: () => number;
    log?: Log;
    sessions?: SessionStore;
}

export interface DashboardHandle {
    port: number;
    close(): Promise<void>;
}

type FormBody = URLSearchParams | 'too-large' | 'bad-type' | 'closed';
type LoginError = 'expired' | 'denied' | 'failed';

export async function createDashboardServer(options: DashboardServerOptions): Promise<DashboardHandle> {
    const config = options.config;
    const bot = options.bot;
    const fetchImpl = options.fetchImpl ?? fetch;
    const now = options.now ?? Date.now;
    const sessions = options.sessions ?? new SessionStore();
    const secure = config.secureCookie;
    const invite = inviteUrl(config.clientId);
    const face = () => sanitizeBotIcon(bot.icon());
    const messagePage = (title: string, text: string, links?: { href: string; label: string }[]) => renderMessage(title, text, links, face());

    const server = createServer((req, res) => {
        void handle(req, res).catch((error: unknown) => {
            options.log?.error('Dashboard request failed', error);
            if (!res.headersSent) send(res, 500, messagePage('Something went wrong', 'Something went wrong. Try again.'));
        });
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    server.on('clientError', (_error, socket) => {
        if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    });

    const host = options.host ?? '0.0.0.0';
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen(config.port, host, () => {
            server.off('error', onError);
            resolve();
        });
    });
    server.on('error', (error) => {
        options.log?.error('Dashboard connection error', error);
    });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Dashboard did not bind a port.');

    return {
        port: address.port,
        close() {
            sessions.clear();
            return new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        },
    };

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = req.method ?? 'GET';
        if (method !== 'GET' && method !== 'POST') {
            send(res, 405, messagePage('Not allowed', 'That action is not available.'), { Allow: 'GET, POST' });
            return;
        }
        const url = parseUrl(req.url ?? '/');
        if (!url) {
            send(res, 400, messagePage('Bad request', 'That address is not valid.'));
            return;
        }
        const path = url.pathname;

        if ((path === '/favicon.ico' || path === '/apple-touch-icon.png') && method === 'GET') {
            const icon = face();
            if (!icon) {
                res.writeHead(404, { 'Cache-Control': 'no-store' });
                res.end();
                return;
            }
            redirect(res, 302, icon);
            return;
        }

        if (path === '/') {
            if (method !== 'GET') return methodNotAllowed(res, face());
            if (current(req)) {
                redirect(res, 302, '/guilds');
                return;
            }
            send(res, 200, loginPage(loginError(url), face()));
            return;
        }

        if (path === '/auth/discord') {
            if (method !== 'GET') return methodNotAllowed(res, face());
            const state = randomId();
            redirect(res, 302, authorizeUrl(config, state), [oauthCookie(state)]);
            return;
        }

        if (path === '/auth/callback') {
            if (method !== 'GET') return methodNotAllowed(res, face());
            await callback(req, res, url);
            return;
        }

        if (path === '/logout') {
            if (method !== 'POST') return methodNotAllowed(res, face());
            await logout(req, res);
            return;
        }

        if (path === '/guilds') {
            if (method !== 'GET') return methodNotAllowed(res, face());
            const active = current(req);
            if (!active) {
                redirect(res, 302, '/');
                return;
            }
            await showGuilds(res, active);
            return;
        }

        const guild = matchGuild(path);
        if (!guild) {
            send(res, 404, messagePage('Not found', 'That page is not here.'));
            return;
        }
        if (method !== 'GET' && method !== 'POST') return methodNotAllowed(res, face());
        const active = current(req);
        if (!active) {
            redirect(res, 302, '/');
            return;
        }
        if (guild.prefs) await preferences(req, res, active, guild.id, method, url);
        else await settings(req, res, active, guild.id, method, url);
    }

    async function callback(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
        const clear = clearCookie(OAUTH_COOKIE);
        const oauthError = url.searchParams.get('error');
        if (oauthError) {
            redirect(res, 302, `/?error=${oauthError === 'access_denied' ? 'denied' : 'failed'}`, [clear]);
            return;
        }
        const code = url.searchParams.get('code') ?? '';
        const state = url.searchParams.get('state') ?? '';
        const sealed = readCookie(req.headers.cookie, OAUTH_COOKIE);
        const expected = sealed ? openSeal(sealed, config.sessionSecret) : null;
        if (!expected || state.length < 1 || state.length > 128 || code.length < 1 || code.length > 512 || !sameValue(state, expected)) {
            send(res, 400, messagePage('Login did not finish', 'Discord login did not finish. Try again.'), { 'Set-Cookie': clear });
            return;
        }
        const token = await exchangeCode(fetchImpl, config, code);
        if (!token.ok) {
            redirect(res, 302, '/?error=failed', [clear]);
            return;
        }
        const identity = await fetchIdentity(fetchImpl, token.value.accessToken);
        if (!identity.ok) {
            redirect(res, 302, '/?error=failed', [clear]);
            return;
        }
        const created = sessions.create({
            userId: identity.value.id,
            username: identity.value.username,
            accessToken: token.value.accessToken,
            expiresAt: now() + token.value.expiresIn * 1000,
        });
        const maxAge = Math.max(1, token.value.expiresIn);
        redirect(res, 302, '/guilds', [sessionCookie(created.id, maxAge), clear]);
    }

    async function logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const active = current(req);
        if (!active) {
            redirect(res, 303, '/', [clearCookie(SESSION_COOKIE)]);
            return;
        }
        const form = await readForm(req);
        if (form === 'closed') return;
        if (form === 'too-large') {
            send(res, 413, messagePage('Too large', 'That form is too large.'));
            return;
        }
        if (typeof form !== 'object' || !sameValue(form.get('csrf') ?? '', active.session.csrf)) {
            send(res, 403, messagePage('Form expired', 'That form expired. Go back and try again.', [{ href: '/guilds', label: 'Servers' }]));
            return;
        }
        sessions.delete(active.id);
        redirect(res, 303, '/', [clearCookie(SESSION_COOKIE), clearCookie(OAUTH_COOKIE)]);
    }

    async function showGuilds(res: ServerResponse, active: ActiveSession): Promise<void> {
        const list = await fetchManageableGuilds(fetchImpl, active.session.accessToken);
        if (!list.ok) {
            if (list.unauthorized) {
                sessions.delete(active.id);
                redirect(res, 303, '/?error=expired', [clearCookie(SESSION_COOKIE)]);
                return;
            }
            const failure = discordFailure(list.status);
            send(res, failure.status, messagePage(failure.title, failure.text, [{ href: '/guilds', label: 'Try again' }]));
            return;
        }
        const ready = bot.isReady();
        send(
            res,
            200,
            guildListPage({
                username: active.session.username,
                csrf: active.session.csrf,
                ready,
                invite,
                icon: face(),
                guilds: list.value.map((guild) => ({
                    id: guild.id,
                    name: guild.name,
                    icon: guildIconUrl(guild.id, guild.icon),
                    present: ready && bot.guild(guild.id) != null,
                })),
            }),
        );
    }

    async function settings(
        req: IncomingMessage,
        res: ServerResponse,
        active: ActiveSession,
        guildId: string,
        method: string,
        url: URL,
    ): Promise<void> {
        const form = method === 'POST' ? await postedForm(req, res, `/guilds/${guildId}`) : null;
        if (form === 'stop') return;
        const access = await requireGuild(active, guildId);
        if (!access.ok) {
            deny(res, active, access);
            return;
        }
        let error: string | undefined;
        if (form) {
            const parsed = guildSettingsFromForm(form);
            if (!parsed.ok) error = parsed.error;
            else {
                try {
                    await bot.saveSettings(guildId, parsed.value);
                    redirect(res, 303, `/guilds/${guildId}?saved=1`);
                    return;
                } catch (caught) {
                    options.log?.error('Could not save guild settings', caught);
                    error = 'Could not save those settings. Try again.';
                }
            }
        }
        renderSettings(res, active, access.guild.name, guildId, error, !error && url.searchParams.get('saved') === '1');
    }

    function renderSettings(
        res: ServerResponse,
        active: ActiveSession,
        guildName: string,
        guildId: string,
        error: string | undefined,
        saved: boolean,
    ): void {
        const view = bot.guild(guildId);
        if (!view) {
            deny(res, active, {
                ok: false,
                status: 404,
                title: 'Yuna is not in that server',
                text: 'Invite Yuna to that server before changing settings here.',
                invite: true,
            });
            return;
        }
        send(
            res,
            error ? 400 : 200,
            settingsPage({
                username: active.session.username,
                csrf: active.session.csrf,
                guildId,
                guildName,
                settings: bot.settings(guildId),
                channels: view.channels,
                intents: bot.intents,
                error,
                saved,
                icon: face(),
            }),
        );
    }

    async function preferences(
        req: IncomingMessage,
        res: ServerResponse,
        active: ActiveSession,
        guildId: string,
        method: string,
        url: URL,
    ): Promise<void> {
        const form = method === 'POST' ? await postedForm(req, res, `/guilds/${guildId}/me`) : null;
        if (form === 'stop') return;
        const access = await requireGuild(active, guildId);
        if (!access.ok) {
            deny(res, active, access);
            return;
        }
        if (form) {
            try {
                await bot.savePreferences(guildId, active.session.userId, preferencesFromForm(form));
                redirect(res, 303, `/guilds/${guildId}/me?saved=1`);
                return;
            } catch (caught) {
                options.log?.error('Could not save preferences', caught);
                send(res, 500, messagePage('Could not save', 'Could not save those preferences. Try again.', [{ href: `/guilds/${guildId}/me`, label: 'Back' }]));
                return;
            }
        }
        send(
            res,
            200,
            preferencesPage({
                username: active.session.username,
                csrf: active.session.csrf,
                guildId,
                guildName: access.guild.name,
                prefs: bot.preferences(guildId, active.session.userId),
                saved: url.searchParams.get('saved') === '1',
                icon: face(),
            }),
        );
    }

    async function postedForm(req: IncomingMessage, res: ServerResponse, back: string): Promise<URLSearchParams | 'stop'> {
        const form = await readForm(req);
        if (form === 'closed') return 'stop';
        if (form === 'too-large') {
            send(res, 413, messagePage('Too large', 'That form is too large.'));
            return 'stop';
        }
        const active = current(req);
        if (form === 'bad-type' || !active || !sameValue(form.get('csrf') ?? '', active.session.csrf)) {
            send(res, 403, messagePage('Form expired', 'That form expired. Go back and try again.', [{ href: back, label: 'Back' }]));
            return 'stop';
        }
        return form;
    }

    async function requireGuild(active: ActiveSession, guildId: string): Promise<GuildAccess> {
        const list = await fetchManageableGuilds(fetchImpl, active.session.accessToken);
        if (!list.ok) {
            if (list.unauthorized) return { ok: false, status: 303, title: '', text: '', expired: true };
            const failure = discordFailure(list.status);
            return { ok: false, status: failure.status, title: failure.title, text: failure.text };
        }
        const guild = list.value.find((item) => item.id === guildId);
        if (!guild) {
            return { ok: false, status: 403, title: 'Manage Server required', text: 'You need the Manage Server permission to change that.' };
        }
        if (!bot.isReady()) {
            return { ok: false, status: 503, title: 'Still connecting', text: 'Yuna is still connecting to Discord. Refresh in a moment.' };
        }
        if (!bot.guild(guildId)) {
            return {
                ok: false,
                status: 404,
                title: 'Yuna is not in that server',
                text: 'Invite Yuna to that server before changing settings here.',
                invite: true,
            };
        }
        return { ok: true, guild };
    }

    function discordFailure(status: number): { status: number; title: string; text: string } {
        options.log?.warn(`Discord guild list failed (${status}).`);
        if (status === 429) {
            return { status: 503, title: 'Discord is busy', text: 'Discord is busy. Wait a moment and try again.' };
        }
        if (status === 403) {
            return { status: 403, title: 'Log in again', text: 'Discord did not share your servers. Log out and log in again.' };
        }
        return { status: 502, title: 'Discord did not answer', text: 'Discord did not answer. Try again.' };
    }

    function deny(res: ServerResponse, active: ActiveSession, access: Exclude<GuildAccess, { ok: true }>): void {
        if (access.expired) {
            sessions.delete(active.id);
            redirect(res, 303, '/?error=expired', [clearCookie(SESSION_COOKIE)]);
            return;
        }
        const links = [{ href: '/guilds', label: 'Servers' }];
        if (access.invite) links.unshift({ href: invite, label: 'Invite Yuna' });
        send(res, access.status, messagePage(access.title, access.text, links));
    }

    function current(req: IncomingMessage): ActiveSession | null {
        const raw = readCookie(req.headers.cookie, SESSION_COOKIE);
        if (!raw) return null;
        const id = openSeal(raw, config.sessionSecret);
        if (!id) return null;
        const session = sessions.get(id, now());
        if (!session) return null;
        return { id, session };
    }

    function sessionCookie(id: string, maxAge: number): string {
        return cookieHeader(SESSION_COOKIE, seal(id, config.sessionSecret), { maxAge, secure });
    }

    function oauthCookie(state: string): string {
        return cookieHeader(OAUTH_COOKIE, seal(state, config.sessionSecret), { maxAge: 600, secure });
    }

    function clearCookie(name: string): string {
        return cookieHeader(name, '', { maxAge: 0, secure });
    }
}

interface ActiveSession {
    id: string;
    session: DashboardSession;
}

type GuildAccess =
    | { ok: true; guild: DiscordGuildAccess }
    | { ok: false; status: number; title: string; text: string; expired?: boolean; invite?: boolean };

function matchGuild(path: string): { id: string; prefs: boolean } | null {
    if (!path.startsWith('/guilds/')) return null;
    const rest = path.slice('/guilds/'.length);
    if (rest.endsWith('/me')) {
        const id = rest.slice(0, -'/me'.length);
        if (!id || id.includes('/') || !isSnowflake(id)) return null;
        return { id, prefs: true };
    }
    if (!isSnowflake(rest)) return null;
    return { id: rest, prefs: false };
}

function loginError(url: URL): LoginError | null {
    const error = url.searchParams.get('error');
    if (error === 'expired' || error === 'denied' || error === 'failed') return error;
    return null;
}

function parseUrl(raw: string): URL | null {
    try {
        return new URL(raw, 'http://dashboard.local');
    } catch {
        return null;
    }
}

function methodNotAllowed(res: ServerResponse, icon: string | null): void {
    send(res, 405, renderMessage('Not allowed', 'That action is not available.', undefined, icon), { Allow: 'GET, POST' });
}

async function readForm(req: IncomingMessage): Promise<FormBody> {
    const type = String(req.headers['content-type'] ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase();
    if (type !== 'application/x-www-form-urlencoded') return 'bad-type';
    const declared = Number(req.headers['content-length'] ?? '0');
    if (Number.isFinite(declared) && declared > BODY_LIMIT) return 'too-large';
    const chunks: Buffer[] = [];
    let size = 0;
    try {
        for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buf.length;
            if (size > BODY_LIMIT) return 'too-large';
            chunks.push(buf);
        }
    } catch {
        return 'closed';
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function send(res: ServerResponse, status: number, body: string, extra?: OutgoingHttpHeaders): void {
    if (res.headersSent) return;
    res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        'Cache-Control': 'no-store',
        ...extra,
    });
    res.end(body);
}

function redirect(res: ServerResponse, status: number, location: string, cookies?: string[]): void {
    if (res.headersSent) return;
    const headers: OutgoingHttpHeaders = {
        Location: location,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'same-origin',
    };
    if (cookies && cookies.length > 0) headers['Set-Cookie'] = cookies;
    res.writeHead(status, headers);
    res.end();
}
