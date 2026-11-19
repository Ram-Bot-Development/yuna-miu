import { ChannelType, type Client, type Guild } from 'discord.js';
import type { Log } from '../log.js';
import type { DashboardConfig } from './config.js';
import { createDashboardServer, type DashboardHandle } from './server.js';
import type { DashboardBot, DashboardChannel } from './types.js';

export type { DashboardHandle };

/** Listen inside the container. The host port stays closed unless a compose file publishes it. */
export async function startDashboard(options: {
    config: DashboardConfig;
    client: Client;
    logger: Log;
}): Promise<DashboardHandle | null> {
    try {
        const handle = await createDashboardServer({
            config: options.config,
            bot: botFromClient(options.client),
            log: options.logger,
            host: '0.0.0.0',
        });
        options.logger.info(`Dashboard listening inside the container on port ${handle.port} for ${options.config.publicUrl}.`);
        return handle;
    } catch (error) {
        options.logger.error('Dashboard could not listen. The bot will still start.', error);
        return null;
    }
}

function botFromClient(client: Client): DashboardBot {
    return {
        isReady: () => client.isReady(),
        icon() {
            const user = client.user;
            if (!user) return null;
            return user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });
        },
        guild(guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return null;
            return { id: guild.id, name: guild.name, channels: listChannels(guild) };
        },
        settings(guildId) {
            return runtime(client).getGuild(guildId);
        },
        saveSettings(guildId, patch) {
            return runtime(client).updateGuild(guildId, patch);
        },
        preferences(guildId, userId) {
            return runtime(client).getUser(guildId, userId);
        },
        savePreferences(guildId, userId, patch) {
            return runtime(client).updateUser(guildId, userId, patch);
        },
        get intents() {
            return runtime(client).intents;
        },
    };
}

function runtime(client: Client) {
    const personality = client.personality;
    if (!personality) throw new Error('Dashboard started before settings were ready.');
    return personality;
}

function listChannels(guild: Guild): DashboardChannel[] {
    const channels: DashboardChannel[] = [];
    for (const channel of guild.channels.cache.values()) {
        const welcome = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
        const thread = channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread;
        if (!welcome && !thread) continue;
        const name = 'name' in channel && typeof channel.name === 'string' && channel.name.trim() ? channel.name : channel.id;
        channels.push({ id: channel.id, name, thread, welcome });
    }
    channels.sort((a, b) => Number(a.thread) - Number(b.thread) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return channels;
}
