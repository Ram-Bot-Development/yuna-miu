import type { GuildPersonalitySettings } from '../config/guild-settings.js';
import type { MoodId } from '../personality/moods.js';
import type { Rng } from '../personality/mood-selector.js';
import { renderPool } from '../personality/responses.js';
import { ResponseSelector } from '../personality/response-selector.js';
import { allowedUserIds, mentionToken } from '../personality/safety.js';

export interface WelcomePlan {
    channelId: string | null;
    dm: boolean;
    content: string;
    useEmbed: boolean;
    allowedUserIds: string[];
}

export function planWelcome(input: {
    settings: GuildPersonalitySettings;
    userId: string;
    userIsBot: boolean;
    alreadyGreeted: boolean;
    guildId: string;
    mood: MoodId;
    selector: ResponseSelector;
    rng: Rng;
}): WelcomePlan | null {
    if (input.userIsBot || input.alreadyGreeted || !input.settings.welcomeMessagesEnabled) return null;
    const channelId = input.settings.welcomeChannelId;
    const dm = input.settings.welcomeDmEnabled;
    if (!channelId && !dm) return null;
    const content = renderPool(
        'welcome',
        input.mood,
        { user: mentionToken(input.userId), mood: input.mood },
        input.selector,
        `${input.guildId}:welcome`,
        input.rng,
    );
    return {
        channelId,
        dm,
        content,
        useEmbed: input.settings.welcomeUseEmbed,
        allowedUserIds: allowedUserIds([input.userId]),
    };
}
