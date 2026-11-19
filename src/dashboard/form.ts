import type { GuildSettingsPatch } from '../config/guild-settings.js';
import type { UserPreferencesPatch } from '../config/user-preferences.js';
import { isSocialActionId, SOCIAL_ACTIONS, type SocialActionId } from '../config/social-actions.js';
import { isSnowflake } from '../personality/safety.js';

export type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

const CHANNEL_CAP = 200;

export function guildSettingsFromForm(params: URLSearchParams): FormResult<GuildSettingsPatch> {
    const cooldown = readCooldown(params.get('cooldown') ?? '');
    if (cooldown == null) return { ok: false, error: 'Cooldown must be a whole number from 5 to 300.' };
    const chance = readChance(params.get('chance') ?? '');
    if (chance == null) return { ok: false, error: 'Contextual chance must be a number from 0 to 1.' };

    const mentionChannels = readChannels(params.getAll('mention-channel'));
    if (!mentionChannels.ok) return mentionChannels;
    const contextualChannels = readChannels(params.getAll('contextual-channel'));
    if (!contextualChannels.ok) return contextualChannels;
    const actions = readActions(params.getAll('action'));
    if (!actions.ok) return actions;

    const welcomeRaw = (params.get('welcome-channel') ?? '').trim();
    if (welcomeRaw && !isSnowflake(welcomeRaw)) {
        return { ok: false, error: 'Pick a welcome channel from the list.' };
    }

    return {
        ok: true,
        value: {
            personalityEnabled: checked(params, 'personality'),
            mentionResponsesEnabled: checked(params, 'mentions'),
            contextualResponsesEnabled: checked(params, 'contextual'),
            welcomeMessagesEnabled: checked(params, 'welcomes'),
            welcomeUseEmbed: checked(params, 'welcome-embed'),
            welcomeDmEnabled: checked(params, 'welcome-dm'),
            moodVariationEnabled: checked(params, 'mood'),
            socialInteractionsEnabled: checked(params, 'social'),
            responseCooldownSeconds: cooldown,
            contextualResponseChance: chance,
            welcomeChannelId: welcomeRaw || null,
            allowedChannelIds: mentionChannels.value,
            contextualChannelIds: contextualChannels.value,
            enabledSocialActions: actions.value,
        },
    };
}

export function preferencesFromForm(params: URLSearchParams): UserPreferencesPatch {
    return {
        allowSocialActions: checked(params, 'social'),
        allowAffection: checked(params, 'affection'),
        allowMentionReplies: checked(params, 'mentions'),
    };
}

function checked(params: URLSearchParams, name: string): boolean {
    return params.get(name) === 'on';
}

function readCooldown(raw: string): number | null {
    const text = raw.trim();
    if (!/^\d+$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 5 || value > 300) return null;
    return value;
}

function readChance(raw: string): number | null {
    const text = raw.trim();
    if (!/^(?:0|1|0?\.\d+|1\.0+)$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 1) return null;
    return Math.round(value * 10000) / 10000;
}

function readChannels(values: string[]): FormResult<string[]> {
    if (values.length > CHANNEL_CAP) return { ok: false, error: 'Too many channels.' };
    const ids: string[] = [];
    for (const value of values) {
        const id = value.trim();
        if (!isSnowflake(id)) return { ok: false, error: 'Pick channels from the list.' };
        if (!ids.includes(id)) ids.push(id);
    }
    return { ok: true, value: ids };
}

function readActions(values: string[]): FormResult<SocialActionId[]> {
    const selected = new Set<string>();
    for (const value of values) {
        const id = value.trim();
        if (!isSocialActionId(id)) return { ok: false, error: 'Pick a social action from the list.' };
        selected.add(id);
    }
    return { ok: true, value: SOCIAL_ACTIONS.map((action) => action.id).filter((id) => selected.has(id)) };
}
