import { normalizeGuildSettings, type GuildPersonalitySettings, type GuildSettingsPatch } from '../config/guild-settings.js';
import type { UserInteractionPreferences, UserPreferencesPatch } from '../config/user-preferences.js';
import { readIntentFlags, type IntentFlags } from '../intents.js';
import { CooldownService, paceCopy } from '../interactions/cooldowns.js';
import type { IncomingMessage } from '../interactions/incoming.js';
import { mentionSkipReason, planAutoReply, type AutoReplyPlan } from '../interactions/plan-auto-reply.js';
import { planSocial, type SocialPlan } from '../interactions/plan-social.js';
import { planWelcome, type WelcomePlan } from '../interactions/plan-welcome.js';
import { SeenIds } from '../interactions/seen.js';
import type { Log } from '../log.js';
import { createAiRuntime } from '../personality/ai/create-provider.js';
import { composeWithOptionalAi } from '../personality/ai/engine.js';
import { MemoryContext } from '../personality/ai/memory-context.js';
import type { AiRuntimeConfig } from '../personality/ai/types.js';
import { nextMood, type MoodSnapshot, type Rng } from '../personality/mood-selector.js';
import { moodById, type MoodId } from '../personality/moods.js';
import { renderPool, type PoolId } from '../personality/responses.js';
import { ResponseSelector } from '../personality/response-selector.js';
import { mentionToken } from '../personality/safety.js';
import type { SocialActionId } from '../config/social-actions.js';
import { MemorySettingsStore } from '../store/memory-store.js';
import { openSettingsStore } from '../store/file-store.js';
import type { SettingsRepository } from '../store/repository.js';

export class PersonalityRuntime {
    private readonly moods = new Map<string, MoodSnapshot>();

    constructor(
        readonly store: SettingsRepository,
        readonly cooldowns: CooldownService,
        readonly seen: SeenIds,
        readonly selector: ResponseSelector,
        readonly ai: AiRuntimeConfig,
        readonly memory: MemoryContext,
        readonly intents: IntentFlags,
        private readonly rng: Rng,
        private readonly log: Log,
    ) {}

    getGuild(guildId: string): GuildPersonalitySettings {
        return this.store.getGuild(guildId);
    }

    getUser(guildId: string, userId: string): UserInteractionPreferences {
        return this.store.getUser(guildId, userId);
    }

    updateGuild(guildId: string, patch: GuildSettingsPatch): Promise<GuildPersonalitySettings> {
        return this.store.updateGuild(guildId, patch);
    }

    updateUser(guildId: string, userId: string, patch: UserPreferencesPatch): Promise<UserInteractionPreferences> {
        return this.store.updateUser(guildId, userId, patch);
    }

    moodFor(guildId: string, settings: GuildPersonalitySettings = this.getGuild(guildId), now = Date.now()): MoodSnapshot {
        const next = nextMood(this.moods.get(guildId), now, settings.moodVariationEnabled, this.rng);
        this.moods.set(guildId, next);
        return next;
    }

    moodLabel(id: MoodId): string {
        return moodById(id).label;
    }

    render(guildId: string, pool: PoolId, mood: MoodId, userId: string): string {
        return renderPool(pool, mood, { user: mentionToken(userId), mood }, this.selector, `${guildId}:${pool}`, this.rng);
    }

    reservePublic(guildId: string, userId: string, scope: string, seconds: number, now = Date.now()) {
        const result = this.cooldowns.reserve([`public:${guildId}:${userId}:${scope}`], seconds, now);
        return result.ok ? result : { ...result, message: paceCopy(result.retryAfterMs) };
    }

    mentionSkipReason(message: IncomingMessage, botId: string, now = Date.now()): string | null {
        if (!message.guildId) return null;
        return mentionSkipReason({
            message,
            settings: this.getGuild(message.guildId),
            prefs: this.getUser(message.guildId, message.authorId),
            cooldowns: this.cooldowns,
            botId,
            now,
        });
    }

    planMessage(message: IncomingMessage, botId: string, messageContent: boolean, now = Date.now()): AutoReplyPlan | null {
        if (!message.guildId) return null;
        return planAutoReply({
            message,
            settings: this.getGuild(message.guildId),
            prefs: this.getUser(message.guildId, message.authorId),
            seen: this.seen,
            cooldowns: this.cooldowns,
            botId,
            messageContent,
            now,
            rng: this.rng,
        });
    }

    async composeAutoReply(message: IncomingMessage, plan: AutoReplyPlan, now = Date.now()): Promise<string> {
        const guildId = message.guildId ?? 'dm';
        const mood = this.moodFor(guildId, this.getGuild(guildId), now);
        const fallback = this.render(guildId, plan.pool, mood.id, message.authorId);
        if (plan.kind !== 'mention') return fallback;
        const settings = this.getGuild(guildId);
        const prefs = this.getUser(guildId, message.authorId);
        const result = await composeWithOptionalAi({
            fallback,
            provider: this.ai.provider,
            guildAllowsAi: settings.aiEnabled,
            userAllowsAi: prefs.allowAi,
            contextEnabled: settings.aiContextEnabled && this.ai.contextMessages > 0,
            sensitive: plan.sensitive,
            userText: plan.userText,
            mood: mood.id,
            memory: this.memory,
            memoryKey: `${guildId}:${message.channelId}:${message.authorId}`,
            cooldowns: this.cooldowns,
            guildId,
            userId: message.authorId,
            now,
            timeoutMs: this.ai.timeoutMs,
            maxTokens: this.ai.maxTokens,
            contextLimit: this.ai.contextMessages,
            userPerMinute: this.ai.userPerMinute,
            guildPerMinute: this.ai.guildPerMinute,
            log: this.log,
        });
        return result.text;
    }

    planSocialAction(input: {
        action: SocialActionId;
        guildId: string;
        actorId: string;
        targetId: string;
        targetInGuild: boolean;
        targetIsBot: boolean;
        botId: string;
        now?: number;
    }): SocialPlan {
        const settings = this.getGuild(input.guildId);
        const mood = this.moodFor(input.guildId, settings, input.now);
        return planSocial({
            ...input,
            now: input.now ?? Date.now(),
            settings,
            targetPrefs: this.getUser(input.guildId, input.targetId),
            cooldowns: this.cooldowns,
            selector: this.selector,
            mood: mood.id,
            rng: this.rng,
        });
    }

    planMemberWelcome(input: {
        guildId: string;
        userId: string;
        userIsBot: boolean;
        alreadyGreeted: boolean;
        now?: number;
    }): WelcomePlan | null {
        const settings = this.getGuild(input.guildId);
        const mood = this.moodFor(input.guildId, settings, input.now);
        return planWelcome({
            settings,
            userId: input.userId,
            userIsBot: input.userIsBot,
            alreadyGreeted: input.alreadyGreeted,
            guildId: input.guildId,
            mood: mood.id,
            selector: this.selector,
            rng: this.rng,
        });
    }
}

export async function createPersonalityRuntime(options: {
    dataDir: string;
    env?: NodeJS.ProcessEnv;
    logger: Log;
    rng?: Rng;
}): Promise<PersonalityRuntime> {
    const env = options.env ?? process.env;
    const ai = createAiRuntime(env);
    if (ai.unavailableReason) options.logger.warn(ai.unavailableReason);
    else if (ai.provider) options.logger.info(`Optional AI adapter ready (${ai.provider.id}).`);

    let store: SettingsRepository;
    try {
        store = await openSettingsStore(options.dataDir, options.logger);
    } catch (error) {
        options.logger.error('Settings could not be saved to disk. Using memory only for this run.', error);
        store = new MemorySettingsStore();
    }

    return new PersonalityRuntime(
        store,
        new CooldownService(),
        new SeenIds(),
        new ResponseSelector(),
        ai,
        new MemoryContext(),
        readIntentFlags(env),
        options.rng ?? Math.random,
        options.logger,
    );
}

export function blankGuildSettings(): GuildPersonalitySettings {
    return normalizeGuildSettings({});
}
