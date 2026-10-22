import type { GuildPersonalitySettings, GuildSettingsPatch } from '../config/guild-settings.js';
import type { UserInteractionPreferences, UserPreferencesPatch } from '../config/user-preferences.js';

export interface SettingsRepository {
    getGuild(guildId: string): GuildPersonalitySettings;
    updateGuild(guildId: string, patch: GuildSettingsPatch): Promise<GuildPersonalitySettings>;
    getUser(guildId: string, userId: string): UserInteractionPreferences;
    updateUser(guildId: string, userId: string, patch: UserPreferencesPatch): Promise<UserInteractionPreferences>;
    markGreeted(guildId: string, userId: string, now: number): Promise<boolean>;
}
