import { EmbedBuilder, PermissionFlagsBits, type GuildMember, type SendableChannels } from 'discord.js';
import { character } from '../personality/character.js';
import { logger } from '../logger.js';

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
    const runtime = member.client.personality;
    if (!runtime || !member.user || member.user.bot) return;
    if (!runtime.intents.guildMembers) return;

    const preview = runtime.planMemberWelcome({
        guildId: member.guild.id,
        userId: member.id,
        userIsBot: member.user.bot,
        alreadyGreeted: false,
    });
    if (!preview) return;

    const claimed = await runtime.store.markGreeted(member.guild.id, member.id, Date.now());
    if (!claimed) return;

    if (preview.channelId) {
        try {
            await sendChannelWelcome(member, preview.channelId, preview.content, preview.useEmbed, preview.allowedUserIds);
        } catch (error) {
            logger.error(`Could not send a welcome${errorCode(error)}`);
        }
    }
    if (preview.dm) await sendDirectWelcome(member, preview.content, preview.useEmbed, preview.allowedUserIds);
}

async function sendChannelWelcome(member: GuildMember, channelId: string, content: string, useEmbed: boolean, users: string[]): Promise<void> {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        logger.warn(`Welcome channel is missing in guild ${member.guild.id}.`);
        return;
    }
    const me = member.guild.members.me ?? (await member.guild.members.fetchMe());
    const perms = channel.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        logger.warn(`Welcome channel is not writable in guild ${member.guild.id}.`);
        return;
    }
    const embedOk = useEmbed && perms.has(PermissionFlagsBits.EmbedLinks);
    await (channel as SendableChannels).send(payload(content, users, embedOk));
}

async function sendDirectWelcome(member: GuildMember, content: string, useEmbed: boolean, users: string[]): Promise<void> {
    try {
        await member.send(payload(content, users, useEmbed));
    } catch (error) {
        logger.warn(`Could not direct-message a welcome in guild ${member.guild.id}${errorCode(error)}.`);
    }
}

function payload(content: string, users: string[], useEmbed: boolean) {
    return {
        content: useEmbed ? undefined : content,
        embeds: useEmbed ? [new EmbedBuilder().setColor(character.color).setDescription(content)] : [],
        allowedMentions: { parse: [] as [], users },
    };
}

function errorCode(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code == null) return '';
    return ` (${String(error.code)})`;
}
