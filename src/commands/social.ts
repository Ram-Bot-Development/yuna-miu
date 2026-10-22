import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { SOCIAL_ACTIONS, type SocialActionId } from '../config/social-actions.js';
import type { Command } from './types.js';
import { quiet } from './reply.js';
import { runSocial } from './run-social.js';

function socialCommand(id: SocialActionId, description: string): Command {
    return {
        data: new SlashCommandBuilder()
            .setName(id)
            .setDescription(description)
            .setContexts(InteractionContextType.Guild)
            .addUserOption((option) => option.setName('user').setDescription('Who is included? You can pick yourself.').setRequired(true)),
        async execute(interaction) {
            const target = interaction.options.getUser('user', true);
            if (!target) {
                await quiet(interaction, 'Pick someone in the server.');
                return;
            }
            await runSocial(interaction, id, target);
        },
    };
}

export const socialCommands: Command[] = SOCIAL_ACTIONS.map((action) => socialCommand(action.id, action.commandDescription));
