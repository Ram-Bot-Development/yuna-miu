import {Client, Collection, GatewayIntentBits} from 'discord.js';
import type { Command } from './commands/types.js';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
    }
}

export const YunaBot = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: []}
});

YunaBot.commands = new Collection();