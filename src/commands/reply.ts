import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { clampText } from '../personality/safety.js';

export async function quiet(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    const text = clampText(content, 1900);
    if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: text });
        return;
    }
    const body = { content: text, flags: MessageFlags.Ephemeral as const };
    if (interaction.replied) await interaction.followUp(body);
    else await interaction.reply(body);
}

export async function say(interaction: ChatInputCommandInteraction, content: string, userIds: readonly string[]): Promise<void> {
    await interaction.reply({
        content: clampText(content, 1900),
        allowedMentions: { parse: [], users: [...userIds] },
    });
}
