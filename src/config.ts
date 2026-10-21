export interface AppConfig {
    token: string;
    clientId: string;
    guildId?: string;
    deplyCommands: boolean;
}

import { logger } from "./logger.js";

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name]?.trim() ?? '';
    if (!value) logger.fatal(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    return value;
}

function snowflake(name: string, value: string): string {
    if(!/^\d{17,20}$/.test(value)) {
        logger.fatal(`${name} should be the numeric Discord id.`);
    }

    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const token = required(env, 'DISCORD_TOKEN');
    if(token.length < 30) logger.fatal(`DISCORD_TOKEN does not look like a bot token.`);

    const guildRaw = env.DISCORD_GUILD_ID?.trim() ?? '';
    const deploy = env.DEPLY_COMMANDS?.trim().toLowerCase() ?? '';

    return {
        token,
        clientId: snowflake('DISCORD_GUILD_ID', required(env, 'DISCORD_CLIENT_ID')),
        guildId: guildRaw ? snowflake(`DISCORD_GUILD_ID`, guildRaw) : undefined,
        deplyCommands: deploy === 'true' || deploy === '1',
    }
}