import type { GuildPersonalitySettings, GuildSettingsPatch } from '../config/guild-settings.js';
import type { UserInteractionPreferences, UserPreferencesPatch } from '../config/user-preferences.js';
import type { IntentFlags } from '../intents.js';

export interface DashboardChannel {
    id: string;
    name: string;
    thread: boolean;
    welcome: boolean;
}

export interface DashboardGuild {
    id: string;
    name: string;
    channels: DashboardChannel[];
}

/** What the dashboard needs from the running bot. Tests can supply a fake. */
export interface DashboardBot {
    isReady(): boolean;
    /** Current bot avatar, or null before login. */
    icon(): string | null;
    guild(guildId: string): DashboardGuild | null;
    settings(guildId: string): GuildPersonalitySettings;
    saveSettings(guildId: string, patch: GuildSettingsPatch): Promise<GuildPersonalitySettings>;
    preferences(guildId: string, userId: string): UserInteractionPreferences;
    savePreferences(guildId: string, userId: string, patch: UserPreferencesPatch): Promise<UserInteractionPreferences>;
    intents: IntentFlags;
}
