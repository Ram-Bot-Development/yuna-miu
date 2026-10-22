export interface UserInteractionPreferences {
    allowSocialActions: boolean;
    /** Hugs, pats, and boops. Separate from waves, cheers, and high-fives. */
    allowAffection: boolean;
    allowAi: boolean;
    allowMentionReplies: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserInteractionPreferences = {
    allowSocialActions: true,
    allowAffection: true,
    allowAi: true,
    allowMentionReplies: true,
};

export type UserPreferencesPatch = Partial<UserInteractionPreferences>;

function flag(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

export function normalizeUserPreferences(raw: unknown): UserInteractionPreferences {
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        allowSocialActions: flag(input.allowSocialActions, DEFAULT_USER_PREFERENCES.allowSocialActions),
        allowAffection: flag(input.allowAffection, DEFAULT_USER_PREFERENCES.allowAffection),
        allowAi: flag(input.allowAi, DEFAULT_USER_PREFERENCES.allowAi),
        allowMentionReplies: flag(input.allowMentionReplies, DEFAULT_USER_PREFERENCES.allowMentionReplies),
    };
}

export function describeUserPreferences(prefs: UserInteractionPreferences): string {
    const on = (value: boolean) => (value ? 'allowed' : 'off');
    return [
        `Social actions aimed at you: ${on(prefs.allowSocialActions)}`,
        `Hugs, pats, and boops aimed at you: ${on(prefs.allowAffection)}`,
        `Mention replies to you: ${on(prefs.allowMentionReplies)}`,
        `AI replies to you: ${on(prefs.allowAi)}`,
    ].join('\n');
}
