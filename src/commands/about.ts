import {
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
    type ChatInputCommandInteraction
} from 'discord.js';
import type {Command} from './types.js';

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if(hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`, `${secs}s`);
    return parts.join(' '); 
}


export const about = {
    data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('About Yuna and this bot.')
    .setContexts(InteractionContextType.Guild),

    async execute(interaction: ChatInputCommandInteraction) {
        const uptime = interaction.client.uptime;
        const gateway = interaction.client.ws.ping;

        const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('Yuna Miu')
        .setDescription('Free and open source Discord bot. Still pree-release, so this is the basic build.')
        .setImage("https://rambot.xyz/ram-api-images/other/yunacomingsoon.png")
        .addFields(
            {name: 'Status', value: 'Pre-Release', inline: true},
            {name: 'Servers', value: String(interaction.client.guilds.cache.size), inline: true},
            {name: 'Uptime', value: uptime == null ? 'Starting' : formatUptime(uptime), inline: true},
            {name: 'Gateway', value: gateway < 0 ? 'Measuring' : ` ${Math.round(gateway)} ms`, inline: true},
            {name: 'Licence', value: 'MIT', inline: true}
        );

        await interaction.reply({ embeds: [embed]});
    }
} satisfies Command;

