import { GatewayIntentBits, type Message } from 'discord.js';
import type { IncomingMessage } from '../interactions/incoming.js';
import { logger } from '../logger.js';

export async function handleMessage(message: Message): Promise<void> {
    const runtime = message.client.personality;
    const botId = message.client.user?.id;
    if (!runtime || !botId || !message.guildId || !message.guild) return;

    const incoming = toIncoming(message, botId);
    const messageContent = message.client.options.intents.has(GatewayIntentBits.MessageContent);
    const plan = runtime.planMessage(incoming, botId, messageContent);
    if (!plan) {
        const reason = runtime.mentionSkipReason(incoming, botId);
        if (reason) logger.info(`Ignored a mention: ${reason}`);
        return;
    }

    if (!message.channel.isTextBased() || message.channel.isDMBased()) return;

    try {
        const content = runtime.composeAutoReply(incoming, plan);
        await message.reply({
            content,
            allowedMentions: { parse: [], users: [message.author.id] },
        });
    } catch (error) {
        logger.error(`Could not answer a message${errorCode(error)}`);
    }
}

function toIncoming(message: Message, botId: string): IncomingMessage {
    const parent = 'parentId' in message.channel ? message.channel.parentId : null;
    return {
        id: message.id,
        guildId: message.guildId,
        channelId: message.channelId,
        parentChannelId: typeof parent === 'string' ? parent : null,
        authorId: message.author.id,
        authorIsBot: message.author.bot,
        webhookId: message.webhookId,
        system: message.system,
        content: typeof message.content === 'string' ? message.content : '',
        mentionedBot: message.mentions.users.has(botId),
        mentionsEveryone: message.mentions.everyone,
    };
}

function errorCode(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code == null) return '';
    return ` (${String(error.code)})`;
}
