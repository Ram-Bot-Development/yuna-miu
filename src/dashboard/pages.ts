import type { GuildPersonalitySettings } from '../config/guild-settings.js';
import { SOCIAL_ACTIONS } from '../config/social-actions.js';
import type { UserInteractionPreferences } from '../config/user-preferences.js';
import type { IntentFlags } from '../intents.js';
import { csrfField, escapeHtml, page, sanitizeBotIcon } from './html.js';
import type { DashboardChannel } from './types.js';

export function loginPage(error: 'expired' | 'denied' | 'failed' | null, icon: string | null = null): string {
    const message =
        error === 'expired'
            ? 'That login ended. Log in again.'
            : error === 'denied'
              ? 'Discord login was cancelled.'
              : error === 'failed'
                ? 'Discord login did not finish. Try again.'
                : '';
    const banner = message ? `<p class="toast error">${escapeHtml(message)}</p>` : '';
    const safe = sanitizeBotIcon(icon);
    return page(
        'Yuna Miu',
        `${topbar(undefined, undefined, safe)}
<main>
<section class="hero">
<div>
<p class="kicker">Yuna Miu</p>
<h1>A playful companion for your server.</h1>
<p class="lede">Log in with Discord to change settings where you have Manage Server, and to choose how Yuna treats you.</p>
${banner}
<p class="actions"><a class="button discord" href="/auth/discord">Log in with Discord</a></p>
</div>
<div class="hero-side">
${portrait(safe)}
<aside class="snapshot">
<h2>What you can set</h2>
<ul>
<li>Mention replies, mood, and how often she talks</li>
<li>Welcome messages and the channel they use</li>
<li>Which social actions are on, and your own opt-outs</li>
</ul>
</aside>
</div>
</section>
</main>`,
        safe,
    );
}

export function guildListPage(input: {
    username: string;
    csrf: string;
    ready: boolean;
    invite: string;
    icon: string | null;
    guilds: { id: string; name: string; icon: string | null; present: boolean }[];
}): string {
    const items = guildSections(input.guilds, input.ready, input.invite);
    return shell(
        'Manage servers',
        input.username,
        input.csrf,
        input.icon,
        `<h1>Manage servers</h1>
<p class="sub">Servers you manage with Yuna come first. Servers you can still invite her to come after.</p>
${items}`,
    );
}

export function settingsPage(input: {
    username: string;
    csrf: string;
    guildId: string;
    guildName: string;
    settings: GuildPersonalitySettings;
    channels: DashboardChannel[];
    intents: IntentFlags;
    error?: string;
    saved?: boolean;
    icon: string | null;
}): string {
    const settings = input.settings;
    const mentionChannels = withSelected(input.channels, settings.allowedChannelIds);
    const contextualChannels = withSelected(input.channels, settings.contextualChannelIds);
    const welcomeChannels = input.channels.filter((channel) => channel.welcome);
    if (settings.welcomeChannelId && !welcomeChannels.some((channel) => channel.id === settings.welcomeChannelId)) {
        welcomeChannels.push({ id: settings.welcomeChannelId, name: settings.welcomeChannelId, thread: false, welcome: true });
    }
    const id = escapeHtml(input.guildId);
    return shell(
        input.guildName,
        input.username,
        input.csrf,
        input.icon,
        `<h1>${escapeHtml(input.guildName)}</h1>
<p class="sub"><a href="/guilds">Manage servers</a> · <a href="/guilds/${id}/me">Your preferences</a></p>
${banner(input.error, input.saved)}
<form method="post" action="/guilds/${id}">
${csrfField(input.csrf)}
<div class="rows">
${row('personality', 'Personality', 'Auto-replies that follow her current mood.', settings.personalityEnabled)}
${row('mentions', 'Mention replies', 'Answer when someone mentions her in a listed channel.', settings.mentionResponsesEnabled)}
${row('contextual', 'Contextual replies', 'A rare reply without a mention, only in listed channels.', settings.contextualResponsesEnabled)}
${row('mood', 'Mood variation', 'Let her fictional mood change over time.', settings.moodVariationEnabled)}
</div>
<div class="split">
<label class="field">Cooldown in seconds <input name="cooldown" type="number" min="5" max="300" step="1" required value="${settings.responseCooldownSeconds}"></label>
<label class="field">Contextual chance from 0 to 1 <input name="chance" type="number" min="0" max="1" step="0.01" required value="${settings.contextualResponseChance}"></label>
</div>
<section class="block">
<h2>Mention channels</h2>
<p class="hint">An empty list means nowhere, not every channel.</p>
${channelPicker('mention-channel', mentionChannels, settings.allowedChannelIds)}
</section>
<section class="block">
<h2>Contextual channels</h2>
<p class="hint">An empty list means nowhere, not every channel.</p>
${channelPicker('contextual-channel', contextualChannels, settings.contextualChannelIds)}
</section>
<section class="block">
<h2>Welcomes</h2>
<div class="rows">
${row('welcomes', 'Welcome messages', 'Greet someone when they join.', settings.welcomeMessagesEnabled)}
${row('welcome-embed', 'Welcome embed', 'Use an embed instead of plain text.', settings.welcomeUseEmbed)}
${row('welcome-dm', 'Welcome direct messages', 'Also try a direct message. Off unless you turn it on.', settings.welcomeDmEnabled)}
</div>
<label class="field">Welcome channel <select name="welcome-channel"><option value="">Not set</option>${welcomeChannels
            .map((channel) => {
                const selected = channel.id === settings.welcomeChannelId ? ' selected' : '';
                return `<option value="${escapeHtml(channel.id)}"${selected}>${escapeHtml(channelLabel(channel))}</option>`;
            })
            .join('')}</select></label>
</section>
<section class="block">
<h2>Social actions</h2>
<div class="rows">
${row('social', 'Social actions', 'Master switch for hugs, waves, and the rest.', settings.socialInteractionsEnabled)}
${SOCIAL_ACTIONS.map((action) => row('action', actionTitle(action.id), action.commandDescription, settings.enabledSocialActions.includes(action.id), action.id)).join('')}
</div>
</section>
${intentBlock(settings, input.intents)}
<div class="savebar"><button type="submit">Save settings</button></div>
</form>`,
    );
}

export function preferencesPage(input: {
    username: string;
    csrf: string;
    guildId: string;
    guildName: string;
    prefs: UserInteractionPreferences;
    saved?: boolean;
    icon: string | null;
}): string {
    const id = escapeHtml(input.guildId);
    const prefs = input.prefs;
    return shell(
        'Your preferences',
        input.username,
        input.csrf,
        input.icon,
        `<h1>Your preferences</h1>
<p class="sub">${escapeHtml(input.guildName)} · <a href="/guilds">Manage servers</a> · <a href="/guilds/${id}">Settings</a></p>
<p class="hint center">These apply to you in this server.</p>
${banner(undefined, input.saved)}
<form method="post" action="/guilds/${id}/me">
${csrfField(input.csrf)}
<div class="rows">
${row('social', 'Social actions', 'Let other people aim waves, cheers, and affection at you.', prefs.allowSocialActions)}
${row('affection', 'Affection', 'Hugs, pats, and boops aimed at you.', prefs.allowAffection)}
${row('mentions', 'Mention replies', 'Let Yuna answer when you mention her.', prefs.allowMentionReplies)}
</div>
<div class="savebar"><button type="submit">Save preferences</button></div>
</form>`,
    );
}

export function messagePage(
    title: string,
    text: string,
    links: { href: string; label: string }[] = [{ href: '/', label: 'Back' }],
    icon: string | null = null,
): string {
    const safe = sanitizeBotIcon(icon);
    const anchors = links.map((link) => `<a class="button" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('');
    return page(
        title,
        `${topbar(undefined, undefined, safe)}
<main class="stage"><section class="sheet narrow">${portrait(safe)}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><p class="actions">${anchors}</p></section></main>`,
        safe,
    );
}

function brandMark(icon: string | null): string {
    if (!icon) return '<span class="paw" aria-hidden="true"></span>';
    return `<img class="brand-icon" src="${escapeHtml(icon)}" alt="">`;
}

function portrait(icon: string | null): string {
    if (!icon) return '';
    return `<img class="portrait" src="${escapeHtml(icon)}" alt="Yuna Miu">`;
}

function topbar(username?: string, csrf?: string, icon: string | null = null): string {
    const safe = sanitizeBotIcon(icon);
    const account =
        username && csrf
            ? `<nav class="nav"><a href="/guilds">Manage servers</a><span class="user">${escapeHtml(username)}</span><form method="post" action="/logout">${csrfField(csrf)}<button class="ghost" type="submit">Log out</button></form></nav>`
            : `<nav class="nav"><a href="/auth/discord">Log in</a></nav>`;
    const home = username ? '/guilds' : '/';
    return `<header class="topbar"><div class="topbar-inner"><a class="brand" href="${home}">${brandMark(safe)}Yuna Miu</a>${account}</div></header>`;
}

function shell(title: string, username: string, csrf: string, icon: string | null, body: string): string {
    const safe = sanitizeBotIcon(icon);
    return page(
        title,
        `${topbar(username, csrf, safe)}
<main><div class="sheet">
${body}
</div></main>`,
        safe,
    );
}

function banner(error?: string, saved?: boolean): string {
    if (error) return `<p class="toast error">${escapeHtml(error)}</p>`;
    if (saved) return '<p class="toast saved">Saved.</p>';
    return '';
}

function guildSections(
    guilds: { id: string; name: string; icon: string | null; present: boolean }[],
    ready: boolean,
    invite: string,
): string {
    if (guilds.length === 0) {
        return '<section class="server"><p>Discord did not list any servers where you have Manage Server.</p></section>';
    }
    if (!ready) {
        return `<div class="servers">${guilds.map((guild) => guildItem(guild, ready, invite)).join('')}</div>`;
    }
    const withBot = guilds.filter((guild) => guild.present);
    const canInvite = guilds.filter((guild) => !guild.present);
    return [serverGroup('With Yuna', withBot, ready, invite), serverGroup('Invite Yuna', canInvite, ready, invite)].join('');
}

function serverGroup(
    title: string,
    guilds: { id: string; name: string; icon: string | null; present: boolean }[],
    ready: boolean,
    invite: string,
): string {
    if (guilds.length === 0) return '';
    const cards = guilds.map((guild) => guildItem(guild, ready, invite)).join('');
    return `<h2 class="group">${escapeHtml(title)}</h2><div class="servers">${cards}</div>`;
}

function guildItem(
    guild: { id: string; name: string; icon: string | null; present: boolean },
    ready: boolean,
    invite: string,
): string {
    const name = escapeHtml(guild.name);
    const face = guild.icon
        ? `<img class="mark" src="${escapeHtml(guild.icon)}" alt="">`
        : `<div class="mark" aria-hidden="true">${escapeHtml(initial(guild.name))}</div>`;
    if (!ready) {
        return `<article class="server">${face}<h2>${name}</h2><p class="hint">Yuna is still connecting. Refresh before changing anything.</p></article>`;
    }
    if (!guild.present) {
        return `<article class="server">${face}<h2>${name}</h2><p class="hint">Yuna is not in this server yet.</p><p class="actions"><a class="button" href="${escapeHtml(invite)}">Invite</a></p></article>`;
    }
    const id = escapeHtml(guild.id);
    return `<article class="server">${face}<h2>${name}</h2><p class="actions"><a class="button" href="/guilds/${id}">Manage</a><a class="button ghost" href="/guilds/${id}/me">Preferences</a></p></article>`;
}

function initial(name: string): string {
    const letter = [...name.trim()][0] ?? '?';
    return letter.toLocaleUpperCase();
}

function row(name: string, title: string, detail: string, on: boolean, value?: string): string {
    const checked = on ? ' checked' : '';
    const box = value ?? 'on';
    return `<label class="row"><span class="row-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(box)}"${checked}><span class="track" aria-hidden="true"></span></label>`;
}

function channelPicker(name: string, channels: DashboardChannel[], selected: readonly string[]): string {
    if (channels.length === 0) return '<p class="hint">No text channels are visible to Yuna yet.</p>';
    const picked = new Set(selected);
    const boxes = channels
        .map((channel) => {
            const checked = picked.has(channel.id) ? ' checked' : '';
            return `<label class="check"><input type="checkbox" name="${name}" value="${escapeHtml(channel.id)}"${checked}> ${escapeHtml(channelLabel(channel))}</label>`;
        })
        .join('');
    return `<div class="picker"><input class="filter" type="search" placeholder="Search channels" oninput="filterList(this)"><div class="checks">${boxes}</div></div>`;
}

function channelLabel(channel: DashboardChannel): string {
    return channel.thread ? `${channel.name} (thread)` : `# ${channel.name}`;
}

function actionTitle(id: string): string {
    if (id === 'highfive') return 'High five';
    return id.slice(0, 1).toUpperCase() + id.slice(1);
}

function withSelected(channels: DashboardChannel[], selected: readonly string[]): DashboardChannel[] {
    const known = new Set(channels.map((channel) => channel.id));
    const extras = selected
        .filter((id) => !known.has(id))
        .map((id): DashboardChannel => ({ id, name: id, thread: false, welcome: false }));
    return [...channels, ...extras];
}

function intentBlock(settings: GuildPersonalitySettings, intents: IntentFlags): string {
    const lines = [
        `Message content intent: ${intents.messageContent ? 'on' : 'off'}.`,
        `Server members intent: ${intents.guildMembers ? 'on' : 'off'}.`,
    ];
    if (settings.contextualResponsesEnabled && !intents.messageContent) {
        lines.push('Contextual replies stay quiet until ENABLE_MESSAGE_CONTENT_INTENT is on and the bot is restarted.');
    }
    if (settings.welcomeMessagesEnabled && !intents.guildMembers) {
        lines.push('Welcomes stay quiet until ENABLE_GUILD_MEMBERS_INTENT is on and the bot is restarted.');
    }
    return `<aside class="notice">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</aside>`;
}
