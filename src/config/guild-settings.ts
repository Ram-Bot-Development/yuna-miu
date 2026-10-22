import type { IntentFlags } from '../intents.js';
import { isSnowflake } from '../personality/safety.js';
import { DEFAULT_SOCIAL_ACTIONS, isSocialActionId, type SocialActionId } from './social-actions.js';

export interface GuildPersonalitySettings {
    personalityEnabled: boolean;
    mentionResponsesEnabled: boolean;
    contextualResponsesEnabled: boolean;
    welcomeMessagesEnabled: boolean;
    welcomeChannelId: string | null;
    welcomeUseEmbed: boolean;
    welcomeDmEnabled: boolean;
    moodVariationEnabled: boolean;
    aiEnabled: boolean;
    /** In-memory context only, and only when the process allows a context window. */
    aiContextEnabled: boolean;
    /**
     * Channels where mention replies are allowed.
     * Empty means nowhere. It does not mean every channel.
     */
    allowedChannelIds: string[];
    /**
     * Channels where opt-in contextual replies are allowed.
     * Empty means nowhere.
     */
    contextualChannelIds: string[];
    responseCooldownSeconds: number;
    contextualResponseChance: number;
    socialInteractionsEnabled: boolean;
    enabledSocialActions: SocialActionId[];
}

export const DEFAULT_GUILD_SETTINGS: GuildPersonalitySettings = {
    personalityEnabled: true,
    mentionResponsesEnabled: true,
    contextualResponsesEnabled: false,
    welcomeMessagesEnabled: false,
    welcomeChannelId: null,
    welcomeUseEmbed: false,
    welcomeDmEnabled: false,
    moodVariationEnabled: true,
    aiEnabled: false,
    aiContextEnabled: false,
    allowedChannelIds: [],
    contextualChannelIds: [],
    responseCooldownSeconds: 30,
    contextualResponseChance: 0.03,
    socialInteractionsEnabled: true,
    enabledSocialActions: [...DEFAULT_SOCIAL_ACTIONS],
};

export type GuildSettingsPatch = Partial<GuildPersonalitySettings>;

function flag(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function channelIds(value: unknown, fallback: readonly string[]): string[] {
    if (!Array.isArray(value)) return [...fallback];
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && isSnowflake(item)))];
}

function actions(value: unknown): SocialActionId[] {
    if (!Array.isArray(value)) return [...DEFAULT_SOCIAL_ACTIONS];
    return value.filter((item): item is SocialActionId => typeof item === 'string' && isSocialActionId(item));
}

function cooldown(value: unknown): number {
    const parsed = typeof value === 'number' ? value : DEFAULT_GUILD_SETTINGS.responseCooldownSeconds;
    if (!Number.isFinite(parsed)) return DEFAULT_GUILD_SETTINGS.responseCooldownSeconds;
    return Math.min(300, Math.max(5, Math.round(parsed)));
}

function chance(value: unknown): number {
    const parsed = typeof value === 'number' ? value : DEFAULT_GUILD_SETTINGS.contextualResponseChance;
    if (!Number.isFinite(parsed)) return DEFAULT_GUILD_SETTINGS.contextualResponseChance;
    return Math.min(1, Math.max(0, parsed));
}

export function normalizeGuildSettings(raw: unknown): GuildPersonalitySettings {
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const welcomeChannelId =
        typeof input.welcomeChannelId === 'string' && isSnowflake(input.welcomeChannelId) ? input.welcomeChannelId : null;
    return {
        personalityEnabled: flag(input.personalityEnabled, DEFAULT_GUILD_SETTINGS.personalityEnabled),
        mentionResponsesEnabled: flag(input.mentionResponsesEnabled, DEFAULT_GUILD_SETTINGS.mentionResponsesEnabled),
        contextualResponsesEnabled: flag(input.contextualResponsesEnabled, DEFAULT_GUILD_SETTINGS.contextualResponsesEnabled),
        welcomeMessagesEnabled: flag(input.welcomeMessagesEnabled, DEFAULT_GUILD_SETTINGS.welcomeMessagesEnabled),
        welcomeChannelId,
        welcomeUseEmbed: flag(input.welcomeUseEmbed, DEFAULT_GUILD_SETTINGS.welcomeUseEmbed),
        welcomeDmEnabled: flag(input.welcomeDmEnabled, DEFAULT_GUILD_SETTINGS.welcomeDmEnabled),
        moodVariationEnabled: flag(input.moodVariationEnabled, DEFAULT_GUILD_SETTINGS.moodVariationEnabled),
        aiEnabled: flag(input.aiEnabled, DEFAULT_GUILD_SETTINGS.aiEnabled),
        aiContextEnabled: flag(input.aiContextEnabled, DEFAULT_GUILD_SETTINGS.aiContextEnabled),
        allowedChannelIds: channelIds(input.allowedChannelIds, DEFAULT_GUILD_SETTINGS.allowedChannelIds),
        contextualChannelIds: channelIds(input.contextualChannelIds, DEFAULT_GUILD_SETTINGS.contextualChannelIds),
        responseCooldownSeconds: cooldown(input.responseCooldownSeconds),
        contextualResponseChance: chance(input.contextualResponseChance),
        socialInteractionsEnabled: flag(input.socialInteractionsEnabled, DEFAULT_GUILD_SETTINGS.socialInteractionsEnabled),
        enabledSocialActions: actions(input.enabledSocialActions),
    };
}

export type ChannelListKey = 'allowedChannelIds' | 'contextualChannelIds';

export function applyChannelEdit(
    settings: GuildPersonalitySettings,
    list: ChannelListKey,
    action: 'add' | 'remove' | 'clear',
    channelId?: string,
): GuildPersonalitySettings | { error: string } {
    if (action === 'clear') return { ...settings, [list]: [] };
    if (!channelId || !isSnowflake(channelId)) return { error: 'Pick a text channel, announcement channel, or thread.' };
    const current = settings[list];
    if (action === 'add') {
        if (current.includes(channelId)) return settings;
        return { ...settings, [list]: [...current, channelId] };
    }
    return { ...settings, [list]: current.filter((id) => id !== channelId) };
}

export function applyActionToggle(
    settings: GuildPersonalitySettings,
    action: SocialActionId,
    enabled: boolean,
): GuildPersonalitySettings {
    const has = settings.enabledSocialActions.includes(action);
    if (enabled && !has) {
        return { ...settings, enabledSocialActions: [...settings.enabledSocialActions, action] };
    }
    if (!enabled && has) {
        return { ...settings, enabledSocialActions: settings.enabledSocialActions.filter((id) => id !== action) };
    }
    return settings;
}

function listChannels(ids: readonly string[]): string {
    if (ids.length === 0) return 'none. An empty list is nowhere, not every channel.';
    return ids.map((id) => `<#${id}>`).join(', ');
}

export function describeGuildSettings(settings: GuildPersonalitySettings, intents: IntentFlags): string {
    const on = (value: boolean) => (value ? 'on' : 'off');
    const percent = Math.round(settings.contextualResponseChance * 1000) / 10;
    return [
        `Personality auto-replies: ${on(settings.personalityEnabled)}`,
        `Mention replies: ${on(settings.mentionResponsesEnabled)}`,
        `Mention channels: ${listChannels(settings.allowedChannelIds)}`,
        `Contextual replies: ${on(settings.contextualResponsesEnabled)}`,
        `Contextual channels: ${listChannels(settings.contextualChannelIds)}`,
        `Contextual chance: ${percent}%`,
        `Welcome messages: ${on(settings.welcomeMessagesEnabled)}`,
        `Welcome channel: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : 'not set'}`,
        `Welcome style: ${settings.welcomeUseEmbed ? 'embed' : 'plain text'}`,
        `Welcome DMs: ${on(settings.welcomeDmEnabled)}`,
        `Mood variation: ${on(settings.moodVariationEnabled)}`,
        `AI mention replies: ${on(settings.aiEnabled)}`,
        'AI context: ' + (settings.aiContextEnabled ? 'on, memory only, not saved to disk' : 'off'),
        `Social actions: ${on(settings.socialInteractionsEnabled)} (${settings.enabledSocialActions.join(', ') || 'none'})`,
        `Auto-reply cooldown: ${settings.responseCooldownSeconds}s`,
        `Message content intent: ${intents.messageContent ? 'on' : 'off. Contextual keywords need ENABLE_MESSAGE_CONTENT_INTENT'}`,
        `Server members intent: ${intents.guildMembers ? 'on' : 'off. Welcomes need ENABLE_GUILD_MEMBERS_INTENT'}`,
    ].join('\n');
}
