import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
    type ChatInputCommandInteraction
} from 'discord.js';
import type {Command} from './types.js';

export const invite = {
    data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Invite Yuna to a server.')
    .setContexts(InteractionContextType.Guild),
    async execute(int: ChatInputCommandInteraction) {
        const applicationId = int.client.application?.id;
        if (!applicationId) {
            await int.reply({
                content: 'Invite link is not  ready yet. Try Again in a sec.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const url =
            `https://discord.com/oauth2/authorize?client_id=${applicationId}` +
            '&permissions=19456&scope=bot%20applications.commands';

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Invite Yuna').setURL(url));

      await int.reply({
        content: 'Add Yuna to a server. She asks to view channels, send messages, and use embeds.',
        components: [row],
        flags: MessageFlags.Ephemeral
      })
    }
} satisfies Command;