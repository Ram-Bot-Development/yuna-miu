import type { ChatInputCommandInteraction, User } from 'discord.js';
import type { SocialActionId } from '../config/social-actions.js';
import { findActionImage } from '../images/sources.js';
import { deliverImage } from './show-image.js';
import { quiet } from './reply.js';

export async function runSocial(interaction: ChatInputCommandInteraction, action: SocialActionId, target: User): Promise<void> {
    const runtime = interaction.client.personality;
    const guild = interaction.guild;
    const botId = interaction.client.user?.id;
    if (!runtime || !guild || !botId) {
        await quiet(interaction, 'I am not ready for that yet.');
        return;
    }

    const isSelf = target.id === interaction.user.id;
    const isYuna = target.id === botId;
    const member = interaction.options.getMember('user');
    const plan = runtime.planSocialAction({
        action,
        guildId: guild.id,
        actorId: interaction.user.id,
        targetId: target.id,
        targetInGuild: isSelf || isYuna || member != null,
        targetIsBot: target.bot,
        botId,
    });
    if (!plan.ok) {
        await quiet(interaction, plan.ephemeral);
        return;
    }
    await interaction.deferReply();
    const found = await findActionImage(action);
    await deliverImage(interaction, plan.content, found, plan.allowedUserIds);
}
