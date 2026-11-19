import assert from 'node:assert/strict';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { after, describe, it } from 'node:test';
import { canManageDashboardGuild, hasManageGuild } from '../src/dashboard/access.js';
import { readDashboardConfig, type DashboardConfig } from '../src/dashboard/config.js';
import { guildSettingsFromForm, preferencesFromForm } from '../src/dashboard/form.js';
import { fetchManageableGuilds, readGuildList } from '../src/dashboard/oauth.js';
import { cookieHeader, openSeal, seal } from '../src/dashboard/session.js';
import { createDashboardServer, type DashboardHandle } from '../src/dashboard/server.js';
import { normalizeGuildSettings, type GuildSettingsPatch } from '../src/config/guild-settings.js';
import { normalizeUserPreferences, type UserPreferencesPatch } from '../src/config/user-preferences.js';
import type { DashboardBot } from '../src/dashboard/types.js';

const GUILD = '123456789012345678';
const OTHER = '223456789012345678';
const CHANNEL = '323456789012345678';
const CLIENT = '423456789012345678';
const USER = '523456789012345678';
const SECRET = 'session-secret-value';

describe('dashboard session cookie', () => {
    it('round-trips a signed id and rejects tampering', () => {
        const sealed = seal('session-id-value-ok', SECRET);
        assert.equal(openSeal(sealed, SECRET), 'session-id-value-ok');
        const flipped = sealed.slice(0, -1) + (sealed.endsWith('a') ? 'b' : 'a');
        assert.equal(openSeal(flipped, SECRET), null);
        assert.equal(openSeal(sealed, 'other-secret-value!'), null);
        assert.equal(openSeal('not-a-seal', SECRET), null);
        assert.equal(openSeal('', SECRET), null);
    });

    it('marks the cookie Secure only for https', () => {
        const secure = cookieHeader('yuna_session', 'abc', { maxAge: 10, secure: true });
        const local = cookieHeader('yuna_session', 'abc', { maxAge: 10, secure: false });
        assert.match(secure, /HttpOnly/);
        assert.match(secure, /SameSite=Lax/);
        assert.match(secure, /Secure/);
        assert.equal(local.includes('Secure'), false);
    });
});

describe('dashboard access', () => {
    it('checks the Manage Server bit', () => {
        assert.equal(hasManageGuild('32'), true);
        assert.equal(hasManageGuild('31'), false);
        assert.equal(hasManageGuild('0'), false);
        assert.equal(hasManageGuild(''), false);
        assert.equal(hasManageGuild('nope'), false);
        assert.equal(hasManageGuild('8'), false);
        assert.equal(hasManageGuild((32n | (1n << 40n)).toString()), true);
    });

    it('also allows owners and administrators', () => {
        assert.equal(canManageDashboardGuild({ permissions: '0', owner: true }), true);
        assert.equal(canManageDashboardGuild({ permissions: '8', owner: false }), true);
        assert.equal(canManageDashboardGuild({ permissions: '16', owner: false }), false);
        assert.equal(canManageDashboardGuild({ permissions: '32', owner: false }), true);
    });

    it('keeps only guilds the user can manage', () => {
        const guilds = readGuildList([
            { id: GUILD, name: 'Cats', owner: false, permissions: '32' },
            { id: OTHER, name: 'Nope', owner: false, permissions: '0' },
            { id: CHANNEL, name: 'Owned', owner: true, permissions: '0' },
            { id: 'not-an-id', name: 'Broken', owner: true, permissions: '32' },
        ]);
        assert.deepEqual(guilds?.map((guild) => guild.name), ['Cats', 'Owned']);
        assert.equal(readGuildList({ nope: true }), null);
    });

    it('asks Discord once more when the guild list is rate limited', async () => {
        let calls = 0;
        const fetchImpl: typeof fetch = async () => {
            calls += 1;
            if (calls === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
            return Response.json([{ id: GUILD, name: 'Cats', owner: true, permissions: '0' }]);
        };
        const result = await fetchManageableGuilds(fetchImpl, 'token-token-token');
        assert.equal(result.ok, true);
        assert.equal(calls, 2);
    });
});

describe('dashboard forms', () => {
    it('turns a settings form into a guild patch', () => {
        const missing = guildSettingsFromForm(new URLSearchParams());
        assert.equal(missing.ok, false);
        const low = guildSettingsFromForm(new URLSearchParams({ cooldown: '4', chance: '0.03' }));
        assert.equal(low.ok, false);
        const high = guildSettingsFromForm(new URLSearchParams({ cooldown: '30', chance: '1.5' }));
        assert.equal(high.ok, false);
        const channel = guildSettingsFromForm(new URLSearchParams({ cooldown: '30', chance: '0.03', 'mention-channel': 'nope' }));
        assert.equal(channel.ok, false);
        const action = guildSettingsFromForm(new URLSearchParams({ cooldown: '30', chance: '0.03', action: 'kick' }));
        assert.equal(action.ok, false);

        const saved = guildSettingsFromForm(
            new URLSearchParams([
                ['cooldown', '30'],
                ['chance', '0.03'],
                ['mention-channel', CHANNEL],
                ['mention-channel', CHANNEL],
                ['contextual-channel', OTHER],
                ['action', 'wave'],
                ['action', 'hug'],
                ['personality', 'on'],
                ['welcome-channel', ''],
            ]),
        );
        assert.equal(saved.ok, true);
        if (!saved.ok) return;
        assert.equal(saved.value.personalityEnabled, true);
        assert.equal(saved.value.mentionResponsesEnabled, false);
        assert.equal(saved.value.responseCooldownSeconds, 30);
        assert.equal(saved.value.contextualResponseChance, 0.03);
        assert.equal(saved.value.welcomeChannelId, null);
        assert.deepEqual(saved.value.allowedChannelIds, [CHANNEL]);
        assert.deepEqual(saved.value.contextualChannelIds, [OTHER]);
        assert.deepEqual(saved.value.enabledSocialActions, ['hug', 'wave']);
    });

    it('reads the three preference switches', () => {
        assert.deepEqual(preferencesFromForm(new URLSearchParams()), {
            allowSocialActions: false,
            allowAffection: false,
            allowMentionReplies: false,
        });
        assert.deepEqual(preferencesFromForm(new URLSearchParams({ social: 'on', mentions: 'on' })), {
            allowSocialActions: true,
            allowAffection: false,
            allowMentionReplies: true,
        });
    });
});

describe('dashboard config', () => {
    it('stays off until the public settings are present and does not echo them', () => {
        const secret = 'super-secret-value';
        const off = readDashboardConfig({ DISCORD_CLIENT_ID: CLIENT });
        assert.equal(off.enabled, false);
        if (!off.enabled) assert.match(off.reason, /DISCORD_CLIENT_SECRET/);

        const short = readDashboardConfig({
            DISCORD_CLIENT_ID: CLIENT,
            DISCORD_CLIENT_SECRET: secret,
            DASHBOARD_SESSION_SECRET: 'too-short',
            DASHBOARD_PUBLIC_URL: 'http://127.0.0.1:8787',
        });
        assert.equal(short.enabled, false);
        if (!short.enabled) assert.equal(short.reason.includes(secret), false);

        const sneaky = readDashboardConfig({
            DISCORD_CLIENT_ID: CLIENT,
            DISCORD_CLIENT_SECRET: secret,
            DASHBOARD_SESSION_SECRET: SECRET,
            DASHBOARD_PUBLIC_URL: `https://${secret}@example.com/yuna`,
        });
        assert.equal(sneaky.enabled, false);
        if (!sneaky.enabled) assert.equal(sneaky.reason.includes(secret), false);

        const ready = readDashboardConfig({
            DISCORD_CLIENT_ID: CLIENT,
            DISCORD_CLIENT_SECRET: secret,
            DASHBOARD_SESSION_SECRET: SECRET,
            DASHBOARD_PUBLIC_URL: 'https://yuna.example.com/',
        });
        assert.equal(ready.enabled, true);
        if (!ready.enabled) return;
        assert.equal(ready.config.publicUrl, 'https://yuna.example.com');
        assert.equal(ready.config.secureCookie, true);
        assert.equal(ready.config.port, 8787);
    });
});

describe('dashboard http', () => {
    const config: DashboardConfig = {
        clientId: CLIENT,
        clientSecret: 'client-secret-value',
        sessionSecret: SECRET,
        publicUrl: 'http://127.0.0.1:8787',
        port: 0,
        secureCookie: false,
    };
    let settings = normalizeGuildSettings({ allowedChannelIds: [CHANNEL] });
    let prefs = normalizeUserPreferences({});
    const bot: DashboardBot = {
        isReady: () => true,
        icon: () => null,
        guild(id) {
            if (id !== GUILD) return null;
            return { id, name: 'Cats', channels: [{ id: CHANNEL, name: 'general', thread: false, welcome: true }] };
        },
        settings: () => settings,
        async saveSettings(_guildId, patch: GuildSettingsPatch) {
            settings = normalizeGuildSettings({ ...settings, ...patch });
            return settings;
        },
        preferences: () => prefs,
        async savePreferences(_guildId, _userId, patch: UserPreferencesPatch) {
            prefs = normalizeUserPreferences({ ...prefs, ...patch });
            return prefs;
        },
        intents: { messageContent: false, guildMembers: false },
    };
    let handle: DashboardHandle;

    after(async () => {
        await handle?.close();
    });

    it('logs in, saves settings, and keeps Discord tokens out of the page', async () => {
        handle = await createDashboardServer({
            config,
            bot,
            host: '127.0.0.1',
            fetchImpl: fakeDiscord,
        });

        const home = await ask(handle.port, '/');
        assert.equal(home.status, 200);
        assert.match(home.body, /Log in with Discord/);
        assert.equal(home.body.includes('client-secret-value'), false);

        const locked = await ask(handle.port, '/guilds');
        assert.equal(locked.status, 302);
        assert.equal(locked.headers.location, '/');

        const started = await ask(handle.port, '/auth/discord');
        assert.equal(started.status, 302);
        const authorize = new URL(String(started.headers.location));
        assert.equal(authorize.origin, 'https://discord.com');
        assert.equal(authorize.searchParams.get('client_id'), CLIENT);
        assert.equal(authorize.searchParams.get('redirect_uri'), 'http://127.0.0.1:8787/auth/callback');
        const state = authorize.searchParams.get('state') ?? '';
        const oauth = cookiePairs(started.headers).find((pair) => pair.startsWith('yuna_oauth='));
        assert.ok(oauth);
        assert.match(String(started.headers['set-cookie']), /HttpOnly/);

        const rejected = await ask(handle.port, `/auth/callback?code=good-secret-code&state=wrong-state-value`, { cookie: oauth });
        assert.equal(rejected.status, 400);
        assert.equal(rejected.body.includes('good-secret-code'), false);

        const again = await ask(handle.port, '/auth/discord');
        const againUrl = new URL(String(again.headers.location));
        const againState = againUrl.searchParams.get('state') ?? '';
        const againOauth = cookiePairs(again.headers).find((pair) => pair.startsWith('yuna_oauth='));
        assert.ok(againOauth);
        const loggedIn = await ask(handle.port, `/auth/callback?code=good&state=${againState}`, { cookie: againOauth });
        assert.equal(loggedIn.status, 302);
        assert.equal(loggedIn.headers.location, '/guilds');
        const session = cookiePairs(loggedIn.headers).find((pair) => pair.startsWith('yuna_session=') && pair.length > 'yuna_session='.length);
        assert.ok(session);

        const guilds = await ask(handle.port, '/guilds', { cookie: session });
        assert.equal(guilds.status, 200);
        assert.match(guilds.body, /Cats &lt;script&gt;/);
        assert.equal(guilds.body.includes('<script>'), false);
        assert.equal(guilds.body.includes('token-1'), false);

        const page = await ask(handle.port, `/guilds/${GUILD}`, { cookie: session });
        assert.equal(page.status, 200);
        assert.match(page.body, /general/);
        const csrf = csrfOf(page.body);

        const forged = await ask(handle.port, `/guilds/${GUILD}`, {
            method: 'POST',
            cookie: session,
            body: `csrf=${encodeURIComponent(csrf)}&cooldown=45&chance=0.25&mention-channel=nope`,
        });
        assert.equal(forged.status, 400);
        assert.equal(settings.allowedChannelIds[0], CHANNEL);

        const missing = await ask(handle.port, `/guilds/${GUILD}`, {
            method: 'POST',
            cookie: session,
            body: 'cooldown=45&chance=0.25',
        });
        assert.equal(missing.status, 403);

        const saved = await ask(handle.port, `/guilds/${GUILD}`, {
            method: 'POST',
            cookie: session,
            body: `csrf=${encodeURIComponent(csrf)}&cooldown=45&chance=0.25&contextual=on&mention-channel=${CHANNEL}&action=hug`,
        });
        assert.equal(saved.status, 303);
        assert.equal(saved.headers.location, `/guilds/${GUILD}?saved=1`);
        assert.equal(settings.personalityEnabled, false);
        assert.equal(settings.responseCooldownSeconds, 45);
        assert.equal(settings.contextualResponsesEnabled, true);
        assert.deepEqual(settings.enabledSocialActions, ['hug']);
        assert.deepEqual(settings.allowedChannelIds, [CHANNEL]);

        const shown = await ask(handle.port, String(saved.headers.location), { cookie: session });
        assert.equal(shown.status, 200);
        assert.match(shown.body, /Saved\./);
        assert.match(shown.body, /value="45"/);
        assert.match(shown.body, /ENABLE_MESSAGE_CONTENT_INTENT/);

        const prefsPage = await ask(handle.port, `/guilds/${GUILD}/me`, { cookie: session });
        assert.equal(prefsPage.status, 200);
        const prefsCsrf = csrfOf(prefsPage.body);
        const prefSave = await ask(handle.port, `/guilds/${GUILD}/me`, {
            method: 'POST',
            cookie: session,
            body: `csrf=${encodeURIComponent(prefsCsrf)}&social=on&affection=on`,
        });
        assert.equal(prefSave.status, 303);
        assert.equal(prefs.allowMentionReplies, false);
        assert.equal(prefs.allowSocialActions, true);
        const prefShown = await ask(handle.port, String(prefSave.headers.location), { cookie: session });
        assert.match(prefShown.body, /Saved\./);

        const loggedOut = await ask(handle.port, '/logout', {
            method: 'POST',
            cookie: session,
            body: `csrf=${encodeURIComponent(prefsCsrf)}`,
        });
        assert.equal(loggedOut.status, 303);
        assert.equal(loggedOut.headers.location, '/');
        const afterLogout = await ask(handle.port, '/guilds', { cookie: session });
        assert.equal(afterLogout.status, 302);
        assert.equal(state.length > 0, true);
    });
});

function fakeDiscord(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
    const url = String(input);
    if (url.endsWith('/oauth2/token')) {
        const body = String(init?.body ?? '');
        if (!body.includes('code=good')) return Promise.resolve(new Response('{}', { status: 400 }));
        return Promise.resolve(Response.json({ access_token: 'token-1-long-enough', token_type: 'Bearer', expires_in: 3600 }));
    }
    if (url.endsWith('/users/@me/guilds')) {
        return Promise.resolve(
            Response.json([{ id: GUILD, name: 'Cats <script>', owner: false, permissions: '32' }]),
        );
    }
    if (url.endsWith('/users/@me')) {
        return Promise.resolve(Response.json({ id: USER, username: 'ada', global_name: 'Ada' }));
    }
    return Promise.resolve(new Response('no', { status: 404 }));
}

function ask(
    port: number,
    path: string,
    options: { method?: string; cookie?: string; body?: string } = {},
): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        const req = httpRequest(
            {
                host: '127.0.0.1',
                port,
                path,
                method: options.method ?? 'GET',
                headers: {
                    ...(options.cookie ? { Cookie: options.cookie } : {}),
                    ...(options.body
                        ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(options.body) }
                        : {}),
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
                });
            },
        );
        req.on('error', reject);
        req.end(options.body);
    });
}

function cookiePairs(headers: IncomingHttpHeaders): string[] {
    const raw = headers['set-cookie'];
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((cookie) => cookie.split(';')[0] ?? '').filter((pair) => pair.length > 0);
}

function csrfOf(body: string): string {
    const match = body.match(/name="csrf" value="([^"]+)"/);
    assert.ok(match?.[1]);
    return match[1];
}
