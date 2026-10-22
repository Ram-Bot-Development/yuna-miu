import type { IncomingMessage } from '../interactions/incoming.js';

/** Stand-in for a Discord message. Tests and local callers can use this instead of the gateway. */
export function mockMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
    return {
        id: '100000000000000001',
        guildId: '100000000000000002',
        channelId: '100000000000000003',
        parentChannelId: null,
        authorId: '100000000000000004',
        authorIsBot: false,
        webhookId: null,
        system: false,
        content: 'hello',
        mentionedBot: false,
        mentionsEveryone: false,
        ...overrides,
    };
}

export const MOCK_BOT_ID = '100000000000000099';
export const MOCK_GUILD_ID = '100000000000000002';
export const MOCK_CHANNEL_ID = '100000000000000003';
export const MOCK_USER_ID = '100000000000000004';
