import type { GuildPersonalitySettings } from '../config/guild-settings.js';
import { socialAction, type SocialActionId } from '../config/social-actions.js';
import type { UserInteractionPreferences } from '../config/user-preferences.js';
import type { MoodId } from '../personality/moods.js';
import type { Rng } from '../personality/mood-selector.js';
import type { PoolId } from '../personality/responses.js';
import { renderPool } from '../personality/responses.js';
import { ResponseSelector } from '../personality/response-selector.js';
import { allowedUserIds, mentionToken } from '../personality/safety.js';
import { CooldownService, paceCopy } from './cooldowns.js';

export type SocialPlan =
    | { ok: true; content: string; allowedUserIds: string[] }
    | { ok: false; ephemeral: string };

export interface PlanSocialInput {
    action: SocialActionId;
    guildId: string;
    actorId: string;
    targetId: string;
    targetInGuild: boolean;
    targetIsBot: boolean;
    botId: string;
    settings: GuildPersonalitySettings;
    targetPrefs: UserInteractionPreferences;
    cooldowns: CooldownService;
    selector: ResponseSelector;
    mood: MoodId;
    now: number;
    rng: Rng;
}

/**
 * Social commands do not grant friendship, consent, or a relationship.
 * Affection actions stay off when the recipient has opted out.
 */
export function planSocial(input: PlanSocialInput): SocialPlan {
    const action = socialAction(input.action);
    if (!input.settings.socialInteractionsEnabled) {
        return { ok: false, ephemeral: 'Social actions are turned off in this server.' };
    }
    if (!input.settings.enabledSocialActions.includes(input.action)) {
        return { ok: false, ephemeral: `/${input.action} is turned off here.` };
    }
    if (!input.targetInGuild && input.targetId !== input.botId) {
        return { ok: false, ephemeral: 'I cannot find them in this server right now.' };
    }
    if (input.targetIsBot && input.targetId !== input.botId) {
        return { ok: false, ephemeral: 'I will stick to people for that one.' };
    }

    const self = input.actorId === input.targetId;
    const yuna = input.targetId === input.botId;
    if (!self && !yuna) {
        if (!input.targetPrefs.allowSocialActions) {
            return { ok: false, ephemeral: 'They have turned social actions off, so I did not ping them.' };
        }
        if (action.affection && !input.targetPrefs.allowAffection) {
            return { ok: false, ephemeral: 'They are not up for hugs, pats, or boops, so I did not do that.' };
        }
    }

    const reserved = input.cooldowns.reserve(
        [`social:${input.guildId}:${input.actorId}`],
        input.settings.responseCooldownSeconds,
        input.now,
    );
    if (!reserved.ok) return { ok: false, ephemeral: paceCopy(reserved.retryAfterMs) };

    const variant = self ? 'Self' : yuna ? 'Yuna' : 'Other';
    const pool = `${input.action}${variant}` as PoolId;
    const content = renderPool(
        pool,
        input.mood,
        {
            actor: mentionToken(input.actorId),
            target: yuna || self ? '' : mentionToken(input.targetId),
            mood: input.mood,
        },
        input.selector,
        `${input.guildId}:${pool}`,
        input.rng,
    );
    const ids = self || yuna ? [input.actorId] : [input.actorId, input.targetId];
    return { ok: true, content, allowedUserIds: allowedUserIds(ids) };
}
