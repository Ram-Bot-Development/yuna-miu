import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { applyActionToggle, applyChannelEdit, describeGuildSettings, type ChannelListKey, type GuildSettingsPatch } from '../config/guild-settings.js';
import { describeUserPreferences, type UserPreferencesPatch } from '../config/user-preferences.js';
import { isSocialActionId } from '../config/social-actions.js';
import { quiet } from './reply.js';

function canManage(interaction: ChatInputCommandInteraction): boolean {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export async function handleSettings(interaction: ChatInputCommandInteraction, sub: string): Promise<void> {
    const runtime = interaction.client.personality;
    const guild = interaction.guild;
    if (!runtime || !guild) {
        await quiet(interaction, 'I am not ready for that yet.');
        return;
    }
    if (!canManage(interaction)) {
        await quiet(interaction, 'You need the Manage Server permission to change that.');
        return;
    }

    if (sub === 'view') {
        await quiet(interaction, describeGuildSettings(runtime.getGuild(guild.id), runtime.intents));
        return;
    }

    if (sub === 'channel') {
        const which = interaction.options.getString('list', true);
        const action = interaction.options.getString('action', true);
        const list: ChannelListKey = which === 'contextual' ? 'contextualChannelIds' : 'allowedChannelIds';
        const editAction = action === 'remove' || action === 'clear' ? action : 'add';
        const edited = applyChannelEdit(runtime.getGuild(guild.id), list, editAction, interaction.options.getChannel('channel')?.id);
        if ('error' in edited) {
            await quiet(interaction, edited.error);
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const saved = await runtime.updateGuild(guild.id, edited);
        await quiet(interaction, describeGuildSettings(saved, runtime.intents));
        return;
    }

    if (sub === 'action') {
        const name = interaction.options.getString('name', true);
        if (!isSocialActionId(name)) {
            await quiet(interaction, 'I do not know that action.');
            return;
        }
        const next = applyActionToggle(runtime.getGuild(guild.id), name, interaction.options.getBoolean('enabled', true));
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const saved = await runtime.updateGuild(guild.id, { enabledSocialActions: next.enabledSocialActions });
        await quiet(interaction, describeGuildSettings(saved, runtime.intents));
        return;
    }

    const patch = readSettingsPatch(interaction);
    if (Object.keys(patch).length === 0) {
        await quiet(interaction, 'Nothing changed. Add at least one option, or use `/yuna settings view`.');
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const saved = await runtime.updateGuild(guild.id, patch);
    const notes = intentNotes(saved, runtime.intents, runtime.ai.provider != null);
    await quiet(interaction, [describeGuildSettings(saved, runtime.intents), ...notes].join('\n'));
}

export async function handlePreferences(interaction: ChatInputCommandInteraction, sub: string): Promise<void> {
    const runtime = interaction.client.personality;
    const guild = interaction.guild;
    if (!runtime || !guild) {
        await quiet(interaction, 'I am not ready for that yet.');
        return;
    }
    if (sub === 'view') {
        await quiet(interaction, describeUserPreferences(runtime.getUser(guild.id, interaction.user.id)));
        return;
    }
    const patch = readPreferencePatch(interaction);
    if (Object.keys(patch).length === 0) {
        await quiet(interaction, 'Nothing changed. Add at least one option, or use `/yuna preferences view`.');
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const saved = await runtime.updateUser(guild.id, interaction.user.id, patch);
    await quiet(interaction, describeUserPreferences(saved));
}

function readSettingsPatch(interaction: ChatInputCommandInteraction): GuildSettingsPatch {
    const patch: GuildSettingsPatch = {};
    const setBool = (option: string, key: keyof GuildSettingsPatch) => {
        const value = interaction.options.getBoolean(option);
        if (value != null) patch[key] = value as never;
    };
    setBool('personality', 'personalityEnabled');
    setBool('mentions', 'mentionResponsesEnabled');
    setBool('contextual', 'contextualResponsesEnabled');
    setBool('welcomes', 'welcomeMessagesEnabled');
    setBool('mood', 'moodVariationEnabled');
    setBool('ai', 'aiEnabled');
    setBool('ai-context', 'aiContextEnabled');
    setBool('social', 'socialInteractionsEnabled');
    setBool('welcome-embed', 'welcomeUseEmbed');
    setBool('welcome-dm', 'welcomeDmEnabled');
    const cooldown = interaction.options.getInteger('cooldown');
    if (cooldown != null) patch.responseCooldownSeconds = cooldown;
    const chance = interaction.options.getNumber('chance');
    if (chance != null) patch.contextualResponseChance = chance;
    const channel = interaction.options.getChannel('welcome-channel');
    if (channel) patch.welcomeChannelId = channel.id;
    return patch;
}

function readPreferencePatch(interaction: ChatInputCommandInteraction): UserPreferencesPatch {
    const patch: UserPreferencesPatch = {};
    const social = interaction.options.getBoolean('social');
    const affection = interaction.options.getBoolean('affection');
    const mentions = interaction.options.getBoolean('mentions');
    const ai = interaction.options.getBoolean('ai');
    if (social != null) patch.allowSocialActions = social;
    if (affection != null) patch.allowAffection = affection;
    if (mentions != null) patch.allowMentionReplies = mentions;
    if (ai != null) patch.allowAi = ai;
    return patch;
}

function intentNotes(settings: GuildSettingsPatch, intents: { messageContent: boolean; guildMembers: boolean }, aiReady: boolean): string[] {
    const notes: string[] = [];
    if (settings.contextualResponsesEnabled && !intents.messageContent) {
        notes.push('Contextual replies stay quiet until ENABLE_MESSAGE_CONTENT_INTENT is on and the bot is restarted.');
    }
    if (settings.welcomeMessagesEnabled && !intents.guildMembers) {
        notes.push('Welcomes stay quiet until ENABLE_GUILD_MEMBERS_INTENT is on and the bot is restarted.');
    }
    if (settings.aiEnabled && !aiReady) {
        notes.push('AI is on for this server, but this process has no AI adapter, so I will keep using scripted lines.');
    }
    return notes;
}
