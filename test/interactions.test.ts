import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeGuildSettings } from '../src/config/guild-settings.js';
import { normalizeUserPreferences } from '../src/config/user-preferences.js';
import { classifyContextual, classifyMention } from '../src/interactions/classify.js';
import { CooldownService } from '../src/interactions/cooldowns.js';
import { mentionSkipReason, planAutoReply } from '../src/interactions/plan-auto-reply.js';
import { planSocial } from '../src/interactions/plan-social.js';
import { planWelcome } from '../src/interactions/plan-welcome.js';
import { isDirectMention, textForModel } from '../src/interactions/message-text.js';
import { SeenIds } from '../src/interactions/seen.js';
import { ResponseSelector } from '../src/personality/response-selector.js';
import { MOCK_BOT_ID, MOCK_CHANNEL_ID, MOCK_GUILD_ID, MOCK_USER_ID, mockMessage } from '../src/testing/mock-events.js';

const OTHER = '100000000000000077';
const THREAD = '100000000000000088';

function guild(patch: Parameters<typeof normalizeGuildSettings>[0] = {}) {
    return normalizeGuildSettings(patch);
}

function autoInput(overrides: Partial<Parameters<typeof planAutoReply>[0]> = {}) {
    return {
        message: mockMessage(),
        settings: guild(),
        prefs: normalizeUserPreferences({}),
        seen: new SeenIds(),
        cooldowns: new CooldownService(),
        botId: MOCK_BOT_ID,
        messageContent: false,
        now: 10_000,
        rng: () => 0,
        ...overrides,
    };
}

describe('mentions', () => {
    it('ignores bots, webhooks, system messages, quotes, code, and other people', () => {
        const mentioned = mockMessage({ content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true });
        assert.equal(isDirectMention(mentioned, MOCK_BOT_ID), true);
        assert.equal(isDirectMention(mockMessage({ content: `\`<@${MOCK_BOT_ID}>\` hello` }), MOCK_BOT_ID), false);
        assert.equal(
            isDirectMention(mockMessage({ content: '```\n<@' + MOCK_BOT_ID + '> hi\n```\nstill here' }), MOCK_BOT_ID),
            false,
        );
        assert.equal(isDirectMention(mockMessage({ content: `> <@${MOCK_BOT_ID}> hi\nhello` }), MOCK_BOT_ID), false);
        assert.equal(planAutoReply(autoInput({ message: mockMessage({ authorIsBot: true, content: `<@${MOCK_BOT_ID}>` }) })), null);
        assert.equal(planAutoReply(autoInput({ message: mockMessage({ webhookId: '1', content: `<@${MOCK_BOT_ID}>` }) })), null);
        assert.equal(planAutoReply(autoInput({ message: mockMessage({ system: true }) })), null);
        assert.equal(planAutoReply(autoInput({ message: mockMessage({ guildId: null }) })), null);
    });

    it('replies only in listed channels and only once', () => {
        const settings = guild({ allowedChannelIds: [MOCK_CHANNEL_ID] });
        const seen = new SeenIds();
        const cooldowns = new CooldownService();
        const message = mockMessage({ content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true });
        const first = planAutoReply(autoInput({ message, settings, seen, cooldowns }));
        assert.equal(first?.kind, 'mention');
        assert.equal(first?.pool, 'mentionGreeting');
        assert.equal(planAutoReply(autoInput({ message, settings, seen, cooldowns })), null);

        const blocked = planAutoReply(
            autoInput({
                message: mockMessage({ id: '100000000000000111', content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true }),
                settings: guild(),
            }),
        );
        assert.equal(blocked, null);
        assert.equal(mentionSkipReason(autoInput({ message: mockMessage({ id: '100000000000000116', content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true }) })), 'this channel is not on the mention list');

        const thread = planAutoReply(
            autoInput({
                message: mockMessage({
                    id: '100000000000000112',
                    channelId: THREAD,
                    parentChannelId: MOCK_CHANNEL_ID,
                    content: `<@${MOCK_BOT_ID}> hello`,
                    mentionedBot: true,
                }),
                settings,
            }),
        );
        assert.equal(thread?.kind, 'mention');
    });

    it('respects opt-out, cooldowns, announcements, and a disabled personality', () => {
        const settings = guild({ allowedChannelIds: [MOCK_CHANNEL_ID] });
        const message = mockMessage({ id: '100000000000000113', content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true });
        assert.equal(planAutoReply(autoInput({ message, settings, prefs: normalizeUserPreferences({ allowMentionReplies: false }) })), null);
        assert.equal(planAutoReply(autoInput({ message, settings: guild({ personalityEnabled: false, allowedChannelIds: [MOCK_CHANNEL_ID] }) })), null);
        assert.equal(
            planAutoReply(autoInput({ message: mockMessage({ ...message, mentionsEveryone: true, id: '100000000000000114' }), settings })),
            null,
        );

        const cooldowns = new CooldownService();
        assert.ok(planAutoReply(autoInput({ message, settings, cooldowns })));
        const second = planAutoReply(
            autoInput({
                message: mockMessage({ id: '100000000000000115', content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true }),
                settings,
                cooldowns,
            }),
        );
        assert.equal(second, null);
    });

    it('does not treat a keyword list as a full reading of a hard moment', () => {
        assert.equal(classifyMention('I want to die'), 'sensitive');
        assert.equal(classifyMention('today was exhausting'), 'caring');
        assert.equal(classifyContextual('I want to die'), null);
        assert.equal(classifyContextual('I am exhausted'), null);
        assert.equal(classifyContextual('I passed my exam'), 'celebration');
        const crisis = planAutoReply(
            autoInput({
                message: mockMessage({ content: `<@${MOCK_BOT_ID}> I want to die`, mentionedBot: true }),
                settings: guild({ allowedChannelIds: [MOCK_CHANNEL_ID], aiEnabled: true }),
            }),
        );
        assert.equal(crisis?.sensitive, true);
        assert.equal(crisis?.userText, '');
    });
});

describe('contextual replies', () => {
    it('stays off until a server opts in, then stays rare and rate-limited', () => {
        const exciting = mockMessage({ content: 'I passed my exam!' });
        assert.equal(planAutoReply(autoInput({ message: exciting, messageContent: true })), null);
        assert.equal(
            planAutoReply(
                autoInput({
                    message: exciting,
                    messageContent: true,
                    rng: () => 0.9,
                    settings: guild({ contextualResponsesEnabled: true, contextualChannelIds: [MOCK_CHANNEL_ID] }),
                }),
            ),
            null,
        );

        const settings = guild({
            contextualResponsesEnabled: true,
            contextualChannelIds: [MOCK_CHANNEL_ID],
            contextualResponseChance: 1,
        });
        const cooldowns = new CooldownService();
        const first = planAutoReply(autoInput({ message: exciting, settings, messageContent: true, cooldowns, rng: () => 0 }));
        assert.equal(first?.kind, 'contextual');
        const second = planAutoReply(
            autoInput({
                message: mockMessage({ id: '100000000000000116', content: 'I passed my exam!' }),
                settings,
                messageContent: true,
                cooldowns,
                rng: () => 0,
            }),
        );
        assert.equal(second, null);
        assert.equal(
            planAutoReply(
                autoInput({
                    message: mockMessage({ id: '100000000000000117', content: 'I passed my exam!' }),
                    settings,
                    messageContent: false,
                    rng: () => 0,
                }),
            ),
            null,
        );
    });
});

describe('social actions', () => {
    const base = {
        action: 'hug' as const,
        guildId: MOCK_GUILD_ID,
        actorId: MOCK_USER_ID,
        targetId: OTHER,
        targetInGuild: true,
        targetIsBot: false,
        botId: MOCK_BOT_ID,
        settings: guild(),
        targetPrefs: normalizeUserPreferences({}),
        selector: new ResponseSelector(),
        mood: 'happy' as const,
        now: 5_000,
        rng: () => 0,
    };

    it('blocks opt-outs, other bots, and missing members without a public ping', () => {
        const cooldowns = new CooldownService();
        const optedOut = planSocial({
            ...base,
            cooldowns,
            targetPrefs: normalizeUserPreferences({ allowSocialActions: false }),
        });
        assert.equal(optedOut.ok, false);
        const affection = planSocial({
            ...base,
            cooldowns: new CooldownService(),
            targetPrefs: normalizeUserPreferences({ allowAffection: false }),
        });
        assert.equal(affection.ok, false);
        const wave = planSocial({
            ...base,
            action: 'wave',
            cooldowns: new CooldownService(),
            targetPrefs: normalizeUserPreferences({ allowAffection: false }),
        });
        assert.equal(wave.ok, true);
        assert.equal(planSocial({ ...base, cooldowns: new CooldownService(), targetIsBot: true, targetId: OTHER }).ok, false);
        assert.equal(planSocial({ ...base, cooldowns: new CooldownService(), targetInGuild: false }).ok, false);
        assert.equal(planSocial({ ...base, cooldowns: new CooldownService(), settings: guild({ socialInteractionsEnabled: false }) }).ok, false);
        assert.equal(
            planSocial({ ...base, cooldowns: new CooldownService(), settings: guild({ enabledSocialActions: ['wave'] }) }).ok,
            false,
        );
    });

    it('allows self and Yuna, limits pings, and paces repeats', () => {
        const self = planSocial({ ...base, cooldowns: new CooldownService(), targetId: MOCK_USER_ID });
        assert.equal(self.ok, true);
        if (self.ok) {
            assert.deepEqual(self.allowedUserIds, [MOCK_USER_ID]);
            assert.equal(self.content.includes('@everyone'), false);
        }
        const yuna = planSocial({ ...base, cooldowns: new CooldownService(), targetId: MOCK_BOT_ID, targetIsBot: true });
        assert.equal(yuna.ok, true);
        if (yuna.ok) assert.deepEqual(yuna.allowedUserIds, [MOCK_USER_ID]);

        const cooldowns = new CooldownService();
        assert.equal(planSocial({ ...base, cooldowns }).ok, true);
        assert.equal(planSocial({ ...base, cooldowns, now: 6_000 }).ok, false);
    });
});

describe('welcomes and message text', () => {
    it('does not greet twice, bots, or a server that did not opt in', () => {
        const selector = new ResponseSelector();
        const input = {
            settings: guild({ welcomeMessagesEnabled: true, welcomeChannelId: MOCK_CHANNEL_ID }),
            userId: MOCK_USER_ID,
            userIsBot: false,
            alreadyGreeted: false,
            guildId: MOCK_GUILD_ID,
            mood: 'cozy' as const,
            selector,
            rng: () => 0,
        };
        const plan = planWelcome(input);
        assert.ok(plan);
        assert.equal(plan.channelId, MOCK_CHANNEL_ID);
        assert.equal(plan.dm, false);
        assert.deepEqual(plan.allowedUserIds, [MOCK_USER_ID]);
        assert.equal(planWelcome({ ...input, alreadyGreeted: true }), null);
        assert.equal(planWelcome({ ...input, userIsBot: true }), null);
        assert.equal(planWelcome({ ...input, settings: guild() }), null);
        assert.equal(planWelcome({ ...input, settings: guild({ welcomeMessagesEnabled: true }) }), null);
        const dm = planWelcome({
            ...input,
            settings: guild({ welcomeMessagesEnabled: true, welcomeDmEnabled: true }),
        });
        assert.equal(dm?.dm, true);
        assert.equal(dm?.channelId, null);
    });

    it('strips other people out of text that could be sent to a model', () => {
        const text = textForModel(`<@${MOCK_BOT_ID}> hi <@${OTHER}> @everyone ${'a'.repeat(2000)}`, MOCK_BOT_ID);
        assert.match(text, /Yuna/);
        assert.match(text, /someone/);
        assert.equal(text.includes(OTHER), false);
        assert.equal(text.includes('@everyone'), false);
        assert.ok(text.length <= 1000);
    });
});
