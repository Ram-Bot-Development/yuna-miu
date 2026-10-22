import type { IncomingMessage } from './incoming.js';
import { clampText, isSnowflake } from '../personality/safety.js';

function stripFences(content: string): string {
    let out = '';
    let index = 0;
    while (index < content.length) {
        const start = content.indexOf('```', index);
        if (start === -1) {
            out += content.slice(index);
            break;
        }
        out += content.slice(index, start);
        const end = content.indexOf('```', start + 3);
        if (end === -1) break;
        index = end + 3;
    }
    return out;
}

/** Drops fenced code, inline code, and quoted lines so a mention hidden there is ignored. */
export function stripUntrustedRegions(content: string): string {
    const withoutFences = stripFences(content.slice(0, 4000));
    const withoutInline = withoutFences.replace(/`[^`\n]*`/g, ' ');
    return withoutInline
        .split('\n')
        .filter((line) => !line.trim().startsWith('>'))
        .join('\n');
}

export function containsMention(content: string, userId: string): boolean {
    if (!isSnowflake(userId)) return false;
    return new RegExp(`<@!?${userId}>`).test(content);
}

export function isDirectMention(message: Pick<IncomingMessage, 'content' | 'mentionedBot'>, botId: string): boolean {
    const content = message.content ?? '';
    const visible = stripUntrustedRegions(content);
    if (containsMention(visible, botId)) return true;
    return message.mentionedBot && content.trim().length === 0;
}

/** Text safe to forward to an optional model. Other people are not named. */
export function textForModel(content: string, botId: string): string {
    const visible = stripUntrustedRegions(content);
    const withoutBot = isSnowflake(botId) ? visible.replace(new RegExp(`<@!?${botId}>`, 'g'), 'Yuna') : visible;
    const generalized = withoutBot
        .replace(/<@!?\d+>/g, 'someone')
        .replace(/<@&\d+>/g, 'a role')
        .replace(/<#\d+>/g, 'a channel')
        .replace(/@(everyone|here)/gi, 'everyone');
    return clampText(generalized, 1000);
}

export function isChannelListed(channelId: string, parentChannelId: string | null, allowed: readonly string[]): boolean {
    if (allowed.length === 0) return false;
    if (allowed.includes(channelId)) return true;
    return parentChannelId != null && allowed.includes(parentChannelId);
}
