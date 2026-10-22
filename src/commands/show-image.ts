import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { FoundImage } from '../images/resolve-image.js';
import { character } from '../personality/character.js';
import { clampText } from '../personality/safety.js';

export function imageEmbed(found: FoundImage): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(character.color).setImage(found.url);
    if (found.source === 'neko') {
        embed.setFooter({ text: found.credit ? `Neko art by ${found.credit}` : 'Neko image from nekos.best' });
    } else {
        embed.setFooter({ text: 'Image from Ram API' });
    }
    return embed;
}

export async function deliverImage(
    interaction: ChatInputCommandInteraction,
    content: string,
    found: FoundImage | null,
    userIds: readonly string[] = [],
): Promise<void> {
    const payload = {
        content: clampText(content, 1900),
        embeds: found ? [imageEmbed(found)] : [],
        allowedMentions: { parse: [] as [], users: [...userIds] },
    };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply(payload);
}
