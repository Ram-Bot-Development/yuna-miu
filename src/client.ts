import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { Command } from './commands/types.js';
import { readIntentFlags } from './intents.js';
import type { PersonalityRuntime } from './services/runtime.js';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
        personality?: PersonalityRuntime;
    }
}

const flags = readIntentFlags();
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (flags.guildMembers) intents.push(GatewayIntentBits.GuildMembers);
if (flags.messageContent) intents.push(GatewayIntentBits.MessageContent);

export const YunaBot = new Client({
    intents,
    allowedMentions: { parse: [] },
});

YunaBot.commands = new Collection();