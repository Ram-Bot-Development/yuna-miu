import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { SOCIAL_ACTIONS } from '../config/social-actions.js';
import type { Command } from './types.js';
import { handlePreferences, handleSettings } from './yuna-settings.js';
import { handleTalk } from './yuna-talk.js';

const actionChoices = SOCIAL_ACTIONS.map((action) => ({ name: action.id, value: action.id }));

export const yuna = {
    data: new SlashCommandBuilder()
        .setName('yuna')
        .setDescription('Talk with Yuna, or tune how she behaves.')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((sub) => sub.setName('hello').setDescription('Get a greeting from Yuna.'))
        .addSubcommand((sub) => sub.setName('about').setDescription("Learn Yuna's personality."))
        .addSubcommand((sub) => sub.setName('mood').setDescription("See Yuna's current fictional mood."))
        .addSubcommand((sub) => sub.setName('joke').setDescription('Ask Yuna for a light joke.'))
        .addSubcommand((sub) => sub.setName('compliment').setDescription('Get a friendly compliment.'))
        .addSubcommand((sub) => sub.setName('encourage').setDescription('Get a bit of encouragement.'))
        .addSubcommand((sub) =>
            sub
                .setName('interact')
                .setDescription('Use a social action, or see which ones are on.')
                .addStringOption((option) =>
                    option.setName('action').setDescription('Which action?').setRequired(true).addChoices(...actionChoices),
                )
                .addUserOption((option) => option.setName('user').setDescription('Who is included? Leave empty to see the list.')),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('settings')
                .setDescription('Server settings for personality and interactions.')
                .addSubcommand((sub) => sub.setName('view').setDescription("Show this server's personality settings."))
                .addSubcommand((sub) =>
                    sub
                        .setName('set')
                        .setDescription('Change personality settings. Only options you set are updated.')
                        .addBooleanOption((option) => option.setName('personality').setDescription('Master switch for mention and contextual replies.'))
                        .addBooleanOption((option) => option.setName('mentions').setDescription('Reply when Yuna is mentioned.'))
                        .addBooleanOption((option) => option.setName('contextual').setDescription('Occasional replies without a mention. Off by default.'))
                        .addBooleanOption((option) => option.setName('welcomes').setDescription('Welcome new members. Off by default.'))
                        .addBooleanOption((option) => option.setName('mood').setDescription('Let the fictional mood change over time.'))
                        .addBooleanOption((option) => option.setName('ai').setDescription('Allow an optional AI reply when Yuna is mentioned.'))
                        .addBooleanOption((option) => option.setName('ai-context').setDescription('Keep a short in-memory context for AI replies.'))
                        .addBooleanOption((option) => option.setName('social').setDescription('Allow social actions such as hugs and waves.'))
                        .addBooleanOption((option) => option.setName('welcome-embed').setDescription('Send welcomes as an embed.'))
                        .addBooleanOption((option) => option.setName('welcome-dm').setDescription('Also DM the welcome. Off by default.'))
                        .addIntegerOption((option) =>
                            option.setName('cooldown').setDescription('Seconds between automatic replies.').setMinValue(5).setMaxValue(300),
                        )
                        .addNumberOption((option) =>
                            option.setName('chance').setDescription('Contextual reply chance from 0 to 1.').setMinValue(0).setMaxValue(1),
                        )
                        .addChannelOption((option) =>
                            option
                                .setName('welcome-channel')
                                .setDescription('Where welcomes are posted.')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
                        ),
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('channel')
                        .setDescription('Choose where mentions or contextual replies are allowed.')
                        .addStringOption((option) =>
                            option
                                .setName('list')
                                .setDescription('Which list to edit.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Mentions', value: 'mentions' },
                                    { name: 'Contextual', value: 'contextual' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('action')
                                .setDescription('Add, remove, or clear.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Add', value: 'add' },
                                    { name: 'Remove', value: 'remove' },
                                    { name: 'Clear', value: 'clear' },
                                ),
                        )
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setDescription('Channel or thread. Not needed when clearing.')
                                .addChannelTypes(
                                    ChannelType.GuildText,
                                    ChannelType.GuildAnnouncement,
                                    ChannelType.PublicThread,
                                    ChannelType.PrivateThread,
                                ),
                        ),
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('action')
                        .setDescription('Turn one social action on or off.')
                        .addStringOption((option) =>
                            option.setName('name').setDescription('Which action?').setRequired(true).addChoices(...actionChoices),
                        )
                        .addBooleanOption((option) => option.setName('enabled').setDescription('Should members be able to use it?').setRequired(true)),
                ),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('preferences')
                .setDescription('Your own interaction preferences in this server.')
                .addSubcommand((sub) => sub.setName('view').setDescription('Show your interaction preferences.'))
                .addSubcommand((sub) =>
                    sub
                        .setName('set')
                        .setDescription('Change what Yuna may aim at you.')
                        .addBooleanOption((option) => option.setName('social').setDescription('Allow social actions aimed at you.'))
                        .addBooleanOption((option) => option.setName('affection').setDescription('Allow hugs, pats, and boops aimed at you.'))
                        .addBooleanOption((option) => option.setName('mentions').setDescription('Allow Yuna to reply when you mention her.'))
                        .addBooleanOption((option) => option.setName('ai').setDescription('Allow an AI reply when you mention her.')),
                ),
        ),
    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand(true);
        if (group === 'settings') {
            await handleSettings(interaction, sub);
            return;
        }
        if (group === 'preferences') {
            await handlePreferences(interaction, sub);
            return;
        }
        await handleTalk(interaction, sub);
    },
} satisfies Command;
