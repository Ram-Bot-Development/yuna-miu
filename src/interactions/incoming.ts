/** A Discord message reduced to the fields the personality system is allowed to use. */
export interface IncomingMessage {
    id: string;
    guildId: string | null;
    channelId: string;
    parentChannelId: string | null;
    authorId: string;
    authorIsBot: boolean;
    webhookId: string | null;
    system: boolean;
    content: string;
    mentionedBot: boolean;
    mentionsEveryone: boolean;
}
