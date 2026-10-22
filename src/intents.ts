export interface IntentFlags {
    messageContent: boolean;
    guildMembers: boolean;
}

function flag(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
    const value = env[name]?.trim().toLowerCase();
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return fallback;
}

/** Message Content is on by default. Server Members stays off until welcomes are wanted. */
export function readIntentFlags(env: NodeJS.ProcessEnv = process.env): IntentFlags {
    return {
        messageContent: flag(env, 'ENABLE_MESSAGE_CONTENT_INTENT', true),
        guildMembers: flag(env, 'ENABLE_GUILD_MEMBERS_INTENT', false),
    };
}
