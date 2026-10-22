import { GatewayIntentBits, type Message } from 'discord.js';
import type { IncomingMessage } from '../interactions/incoming.js';
import { logger } from '../logger.js';

const WAITING_TEXT = 'Miu~ still working on that. I have not forgotten you.';
const WAITING_AFTER_MS = 4_000;
const TYPING_EVERY_MS = 8_000;

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

    const typing = 'sendTyping' in message.channel ? keepTyping(message.channel) : { stop() {} };
    const pending = runtime.composeAutoReply(incoming, plan);
    const waiting = noticeIfSlow(message);
    try {
        const content = await pending;
        clearTimeout(waiting.timer);
        const placeholder = waiting.message ?? (waiting.pending ? await waiting.pending : undefined);
        const payload = { content, allowedMentions: { parse: [] as const, users: [message.author.id] } };
        if (placeholder) await placeholder.edit(payload);
        else await message.reply(payload);
    } catch (error) {
        logger.error(`Could not answer a message${errorCode(error)}`);
        const placeholder = waiting.message ?? (waiting.pending ? await waiting.pending : undefined);
        if (placeholder) {
            await placeholder.edit({ content: 'Miu~ I lost that reply. Try me again in a bit.', allowedMentions: { parse: [] } }).catch(() => undefined);
        }
    } finally {
        typing.stop();
        clearTimeout(waiting.timer);
    }
}

function keepTyping(channel: { sendTyping(): Promise<void> }): { stop(): void } {
    const pulse = () => {
        void channel.sendTyping().catch(() => undefined);
    };
    pulse();
    const timer = setInterval(pulse, TYPING_EVERY_MS);
    if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
    return { stop() { clearInterval(timer); } };
}

function noticeIfSlow(message: Message): { timer: ReturnType<typeof setTimeout>; message?: Message; pending?: Promise<Message | undefined> } {
    const state: { timer: ReturnType<typeof setTimeout>; message?: Message; pending?: Promise<Message | undefined> } = {
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
    };
    state.timer = setTimeout(() => {
        state.pending = message.reply({ content: WAITING_TEXT, allowedMentions: { parse: [] } }).then(
            (sent) => {
                state.message = sent;
                return sent;
            },
            () => undefined,
        );
    }, WAITING_AFTER_MS);
    if (typeof state.timer === 'object' && state.timer && 'unref' in state.timer) state.timer.unref();
    return state;
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
