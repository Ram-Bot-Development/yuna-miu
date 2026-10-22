import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { socialCommands } from '../src/commands/social.js';
import { yuna } from '../src/commands/yuna.js';
import { describeGuildSettings } from '../src/config/guild-settings.js';
import { silentLog } from '../src/log.js';
import { createPersonalityRuntime } from '../src/services/runtime.js';
import { openSettingsStore, SETTINGS_VERSION } from '../src/store/file-store.js';
import { MOCK_BOT_ID, MOCK_CHANNEL_ID, MOCK_GUILD_ID, MOCK_USER_ID, mockMessage } from '../src/testing/mock-events.js';

const GUILD = MOCK_GUILD_ID;
const USER = MOCK_USER_ID;

describe('settings persistence', () => {
    it('migrates older files, clamps bad values, and reloads them', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'yuna-settings-'));
        await writeFile(
            path.join(dir, 'settings.json'),
            JSON.stringify({
                guilds: {
                    [GUILD]: {
                        aiEnabled: true,
                        responseCooldownSeconds: -4,
                        contextualResponseChance: 9,
                        allowedChannelIds: ['nope', MOCK_CHANNEL_ID],
                    },
                    'not-an-id': { aiEnabled: true },
                },
                users: {
                    [`${GUILD}:${USER}`]: { allowAffection: false },
                },
            }),
        );

        const store = await openSettingsStore(dir, silentLog);
        const settings = store.getGuild(GUILD);
        assert.equal(settings.aiEnabled, true);
        assert.equal(settings.personalityEnabled, true);
        assert.equal(settings.contextualResponsesEnabled, false);
        assert.equal(settings.responseCooldownSeconds, 5);
        assert.equal(settings.contextualResponseChance, 1);
        assert.deepEqual(settings.allowedChannelIds, [MOCK_CHANNEL_ID]);
        assert.equal(store.getUser(GUILD, USER).allowAffection, false);
        assert.match(describeGuildSettings(settings, { messageContent: false, guildMembers: false }), /nowhere, not every channel/);

        await store.updateUser(GUILD, USER, { allowAi: false });
        assert.equal(await store.markGreeted(GUILD, USER, Date.now()), true);
        assert.equal(await store.markGreeted(GUILD, USER, Date.now()), false);

        const saved = JSON.parse(await readFile(path.join(dir, 'settings.json'), 'utf8')) as {
            version: number;
            messages?: unknown;
            users: Record<string, { allowAi?: boolean }>;
        };
        assert.equal(saved.version, SETTINGS_VERSION);
        assert.equal(saved.messages, undefined);
        assert.equal(saved.users[`${GUILD}:${USER}`]?.allowAi, false);

        const reloaded = await openSettingsStore(dir, silentLog);
        assert.equal(reloaded.getGuild(GUILD).aiEnabled, true);
        assert.equal(reloaded.getUser(GUILD, USER).allowAi, false);
        assert.equal(await reloaded.markGreeted(GUILD, USER, Date.now()), false);
    });

    it('moves a broken settings file aside instead of crashing', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'yuna-settings-'));
        await writeFile(path.join(dir, 'settings.json'), '{{');
        const store = await openSettingsStore(dir, silentLog);
        assert.equal(store.getGuild(GUILD).personalityEnabled, true);
        const names = await readdir(dir);
        assert.ok(names.some((name) => name.startsWith('settings.invalid-')));
    });

    it('answers a mention from saved settings without writing the message', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'yuna-runtime-'));
        const runtime = await createPersonalityRuntime({ dataDir: dir, env: {}, logger: silentLog, rng: () => 0 });
        const message = mockMessage({ content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true });
        assert.equal(runtime.planMessage(message, MOCK_BOT_ID, false), null);
        await runtime.updateGuild(GUILD, { allowedChannelIds: [MOCK_CHANNEL_ID] });
        const plan = runtime.planMessage(
            mockMessage({ id: '100000000000000222', content: `<@${MOCK_BOT_ID}> hi`, mentionedBot: true }),
            MOCK_BOT_ID,
            false,
        );
        assert.equal(plan?.kind, 'mention');
        const text = plan ? await runtime.composeAutoReply(message, plan) : '';
        assert.match(text, /<@/);
        assert.equal(text.includes('AI model'), false);
        const saved = await readFile(path.join(dir, 'settings.json'), 'utf8');
        assert.equal(saved.includes('what are you doing'), false);
        assert.equal(saved.includes(message.content), false);
    });
});

describe('command registration', () => {
    it('keeps the yuna command small enough to register', () => {
        const names = [yuna.data.name, ...socialCommands.map((command) => command.data.name)];
        for (const name of ['yuna', 'hug', 'pat', 'highfive', 'cheer', 'wave', 'boop']) {
            assert.ok(names.includes(name), name);
        }
        assert.ok(JSON.stringify(yuna.data.toJSON()).length < 8000);
    });
});
