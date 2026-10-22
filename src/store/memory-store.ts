import { normalizeGuildSettings, type GuildPersonalitySettings, type GuildSettingsPatch } from '../config/guild-settings.js';
import {
    normalizeUserPreferences,
    type UserInteractionPreferences,
    type UserPreferencesPatch,
} from '../config/user-preferences.js';
import { isSnowflake } from '../personality/safety.js';
import type { SettingsRepository } from './repository.js';

function userKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

export class MemorySettingsStore implements SettingsRepository {
    private readonly guilds = new Map<string, GuildPersonalitySettings>();
    private readonly users = new Map<string, UserInteractionPreferences>();
    private readonly greeted = new Map<string, number>();

    getGuild(guildId: string): GuildPersonalitySettings {
        return copyGuild(this.guilds.get(guildId) ?? normalizeGuildSettings({}));
    }

    async updateGuild(guildId: string, patch: GuildSettingsPatch): Promise<GuildPersonalitySettings> {
        const next = normalizeGuildSettings({ ...this.getGuild(guildId), ...defined(patch) });
        this.guilds.set(guildId, next);
        return copyGuild(next);
    }

    getUser(guildId: string, userId: string): UserInteractionPreferences {
        return { ...(this.users.get(userKey(guildId, userId)) ?? normalizeUserPreferences({})) };
    }

    async updateUser(guildId: string, userId: string, patch: UserPreferencesPatch): Promise<UserInteractionPreferences> {
        const next = normalizeUserPreferences({ ...this.getUser(guildId, userId), ...defined(patch) });
        this.users.set(userKey(guildId, userId), next);
        return { ...next };
    }

    async markGreeted(guildId: string, userId: string, now: number): Promise<boolean> {
        if (!isSnowflake(guildId) || !isSnowflake(userId)) return false;
        const key = userKey(guildId, userId);
        if (this.greeted.has(key)) return false;
        this.greeted.set(key, now);
        return true;
    }
}

function copyGuild(settings: GuildPersonalitySettings): GuildPersonalitySettings {
    return {
        ...settings,
        allowedChannelIds: [...settings.allowedChannelIds],
        contextualChannelIds: [...settings.contextualChannelIds],
        enabledSocialActions: [...settings.enabledSocialActions],
    };
}

function defined<T extends object>(patch: T): Partial<T> {
    return Object.fromEntries(Object.entries(patch).filter((entry) => entry[1] !== undefined)) as Partial<T>;
}
