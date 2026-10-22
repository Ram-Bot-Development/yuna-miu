import type { GuildPersonalitySettings } from '../config/guild-settings.js';
import type { UserInteractionPreferences } from '../config/user-preferences.js';
import type { PoolId } from '../personality/responses.js';
import type { Rng } from '../personality/mood-selector.js';
import { classifyContextual, classifyMention, type ContextualKind, type MentionKind } from './classify.js';
import { autoCooldownKeys, CooldownService } from './cooldowns.js';
import type { IncomingMessage } from './incoming.js';
import { isChannelListed, isDirectMention, textForModel } from './message-text.js';
import { SeenIds } from './seen.js';

const MENTION_POOLS: Record<MentionKind, PoolId> = {
    sensitive: 'mentionSensitive',
    caring: 'mentionCaring',
    greeting: 'mentionGreeting',
    celebration: 'mentionCelebration',
    curious: 'mentionCurious',
    general: 'mentionGeneral',
};

const CONTEXT_POOLS: Record<ContextualKind, PoolId> = {
    celebration: 'contextualCelebration',
    morning: 'contextualMorning',
    news: 'contextualNews',
    game: 'contextualGame',
};

export interface AutoReplyPlan {
    kind: 'mention' | 'contextual';
    pool: PoolId;
    /** Crisis mentions stay on the scripted line and are not forwarded to a model. */
    sensitive: boolean;
    userText: string;
}

export interface PlanAutoInput {
    message: IncomingMessage;
    settings: GuildPersonalitySettings;
    prefs: UserInteractionPreferences;
    seen: SeenIds;
    cooldowns: CooldownService;
    botId: string;
    messageContent: boolean;
    now: number;
    rng: Rng;
}

export function planAutoReply(input: PlanAutoInput): AutoReplyPlan | null {
    const message = input.message;
    if (!message.guildId) return null;
    if (!input.seen.observe(message.id)) return null;
    if (message.system || message.authorIsBot || message.webhookId) return null;
    if (message.mentionsEveryone) return null;
    if (!input.settings.personalityEnabled) return null;

    if (isDirectMention(message, input.botId)) {
        return planMention(input);
    }
    return planContextual(input);
}

/** Why a real mention was ignored. Null when it is not a mention, or when nothing is blocking it. */
export function mentionSkipReason(input: Omit<PlanAutoInput, 'seen' | 'messageContent' | 'rng'>): string | null {
    const { message, settings, prefs, cooldowns, now } = input;
    if (!message.guildId || message.system || message.authorIsBot || message.webhookId || message.mentionsEveryone) return null;
    if (!isDirectMention(message, input.botId)) return null;
    if (!settings.personalityEnabled) return 'personality is off';
    if (!settings.mentionResponsesEnabled) return 'mention replies are off';
    if (!prefs.allowMentionReplies) return 'that member opted out of mention replies';
    if (!isChannelListed(message.channelId, message.parentChannelId, settings.allowedChannelIds)) {
        return 'this channel is not on the mention list';
    }
    const wait = cooldowns.retryAfter(autoCooldownKeys(message.guildId, message.channelId, message.authorId), now);
    if (wait > 0) return 'mention replies are on cooldown';
    return null;
}

function planMention(input: PlanAutoInput): AutoReplyPlan | null {
    const { message, settings, prefs, cooldowns, now } = input;
    if (!message.guildId) return null;
    if (!settings.mentionResponsesEnabled || !prefs.allowMentionReplies) return null;
    if (!isChannelListed(message.channelId, message.parentChannelId, settings.allowedChannelIds)) return null;
    const reserved = cooldowns.reserve(
        autoCooldownKeys(message.guildId, message.channelId, message.authorId),
        settings.responseCooldownSeconds,
        now,
    );
    if (!reserved.ok) return null;

    const userText = textForModel(message.content, input.botId);
    const kind = classifyMention(userText);
    return {
        kind: 'mention',
        pool: MENTION_POOLS[kind],
        sensitive: kind === 'sensitive',
        userText: kind === 'sensitive' ? '' : userText,
    };
}

function planContextual(input: PlanAutoInput): AutoReplyPlan | null {
    const { message, settings, cooldowns, now, rng, messageContent } = input;
    if (!message.guildId || !messageContent || !settings.contextualResponsesEnabled) return null;
    if (!isChannelListed(message.channelId, message.parentChannelId, settings.contextualChannelIds)) return null;
    const category = classifyContextual(message.content);
    if (!category) return null;
    if (rng() >= settings.contextualResponseChance) return null;
    const reserved = cooldowns.reserve(
        autoCooldownKeys(message.guildId, message.channelId, message.authorId),
        settings.responseCooldownSeconds,
        now,
    );
    if (!reserved.ok) return null;
    return {
        kind: 'contextual',
        pool: CONTEXT_POOLS[category],
        sensitive: false,
        userText: '',
    };
}
