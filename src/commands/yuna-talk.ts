import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { isSocialActionId, SOCIAL_ACTIONS } from '../config/social-actions.js';
import { ABOUT_TEXT, character } from '../personality/character.js';
import { moodById } from '../personality/moods.js';
import type { PoolId } from '../personality/responses.js';
import { quiet, say } from './reply.js';
import { runSocial } from './run-social.js';

const TALK: Record<string, PoolId> = {
    hello: 'hello',
    joke: 'joke',
    compliment: 'compliment',
    encourage: 'encourage',
};

export async function handleTalk(interaction: ChatInputCommandInteraction, sub: string): Promise<void> {
    const runtime = interaction.client.personality;
    const guild = interaction.guild;
    if (!runtime || !guild) {
        await quiet(interaction, 'I am not ready for that yet.');
        return;
    }

    if (sub === 'about') {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(character.color)
                    .setTitle(character.fullName)
                    .setDescription(ABOUT_TEXT)
                    .addFields(
                        { name: 'Also called', value: `${character.preferredName}, or ${character.nickname}`, inline: true },
                        { name: 'What I am', value: 'A fictional Discord bot', inline: true },
                    ),
            ],
        });
        return;
    }

    const settings = runtime.getGuild(guild.id);
    const mood = runtime.moodFor(guild.id, settings);
    if (sub === 'mood') {
        const sample = runtime.render(guild.id, 'hello', mood.id, interaction.user.id);
        const style = moodById(mood.id);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(character.color)
                    .setTitle(`Fictional mood: ${style.label}`)
                    .setDescription(`${style.blurb}\n\n${sample}\n\nThis is a presentation style, not an emotion I actually have.`),
            ],
            allowedMentions: { parse: [], users: [interaction.user.id] },
        });
        return;
    }

    if (sub === 'interact') {
        const actionName = interaction.options.getString('action', true);
        const target = interaction.options.getUser('user');
        if (!isSocialActionId(actionName)) {
            await quiet(interaction, 'I do not know that action.');
            return;
        }
        if (!target) {
            const enabled = new Set(settings.enabledSocialActions);
            const lines = SOCIAL_ACTIONS.map((action) => {
                const state = settings.socialInteractionsEnabled && enabled.has(action.id) ? 'on' : 'off';
                return `\`/${action.id}\` — ${action.commandDescription} (${state})`;
            });
            await quiet(interaction, ['Social actions do not change friendship. Pick someone, or use the command directly.', ...lines].join('\n'));
            return;
        }
        await runSocial(interaction, actionName, target);
        return;
    }

    const pool = TALK[sub];
    if (!pool) {
        await quiet(interaction, 'I do not know that one.');
        return;
    }
    const reserved = runtime.reservePublic(guild.id, interaction.user.id, pool, settings.responseCooldownSeconds);
    if (!reserved.ok) {
        await quiet(interaction, reserved.message);
        return;
    }
    await say(interaction, runtime.render(guild.id, pool, mood.id, interaction.user.id), [interaction.user.id]);
}
