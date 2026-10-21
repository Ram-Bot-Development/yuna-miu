import {
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
    type ChatInputCommandInteraction
} from 'discord.js';
import type {Command} from './types.js';

export const help = {
    data: new SlashCommandBuilder().setName('help').setDescription('Show the command list.').setContexts(InteractionContextType.Guild),
    async execute(int: ChatInputCommandInteraction) {
        const lines = [...int.client.commands.values()].sort((a,b) => a.data.name.localeCompare(b.data.name)).map((command) => `\`/${command.data.name}\` - ${command.data.description}`);

        const embed = new EmbedBuilder().setColor(0xff69b4).setTitle('Commands').setDescription(lines.join('\n') || ' No commands yet.');

        await int.reply({embeds: [embed]});
    }
} satisfies Command;