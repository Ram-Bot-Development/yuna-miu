import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { silentLog } from '../src/log.js';
import { readDatabaseConfig } from '../src/store/database-config.js';
import { importLegacySettings, MariaDbSettingsStore, type SqlExecutor } from '../src/store/mariadb-store.js';
import { MOCK_CHANNEL_ID, MOCK_GUILD_ID, MOCK_USER_ID } from '../src/testing/mock-events.js';

const GUILD = MOCK_GUILD_ID;
const USER = MOCK_USER_ID;

class FakeSql implements SqlExecutor {
    readonly guilds = new Map<string, string>();
    readonly users = new Map<string, string>();
    readonly greeted = new Map<string, number>();

    async query<T>(sql: string): Promise<T[]> {
        if (sql.includes('FROM guild_settings')) {
            return [...this.guilds].map(([guild_id, settings]) => ({ guild_id, settings: JSON.parse(settings) })) as T[];
        }
        if (sql.includes('FROM user_preferences')) {
            return [...this.users].map(([key, preferences]) => {
                const [guild_id, user_id] = key.split(':');
                return { guild_id, user_id, preferences: JSON.parse(preferences) };
            }) as T[];
        }
        if (sql.includes('FROM greeted')) {
            return [...this.greeted].map(([key, greeted_at]) => {
                const [guild_id, user_id] = key.split(':');
                return { guild_id, user_id, greeted_at };
            }) as T[];
        }
        return [];
    }

    async execute(sql: string, params: readonly unknown[] = []): Promise<{ affectedRows: number }> {
        if (sql.includes('CREATE')) return { affectedRows: 0 };
        if (sql.includes('DELETE')) {
            if (sql.includes('greeted_at <')) {
                const cutoff = Number(params[0]);
                for (const [key, at] of this.greeted) {
                    if (at < cutoff) this.greeted.delete(key);
                }
            }
            return { affectedRows: 0 };
        }
        if (sql.includes('guild_settings')) {
            this.guilds.set(String(params[0]), String(params[1]));
            return { affectedRows: 1 };
        }
        if (sql.includes('user_preferences')) {
            this.users.set(`${params[0]}:${params[1]}`, String(params[2]));
            return { affectedRows: 1 };
        }
        if (sql.includes('greeted')) {
            const key = `${params[0]}:${params[1]}`;
            if (this.greeted.has(key)) return { affectedRows: 0 };
            this.greeted.set(key, Number(params[2]));
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }
}

function store(sql = new FakeSql()): { sql: FakeSql; store: MariaDbSettingsStore } {
    return { sql, store: new MariaDbSettingsStore(sql) };
}

describe('MariaDB settings', () => {
    it('stays on the settings file until a host and password are set', () => {
        assert.equal(readDatabaseConfig({}).status, 'off');
        const missing = readDatabaseConfig({ DB_HOST: 'db' });
        assert.equal(missing.status, 'invalid');
        if (missing.status === 'invalid') assert.match(missing.reason, /DB_PASSWORD/);
        const ready = readDatabaseConfig({ DB_HOST: 'db', DB_PASSWORD: 'local-test', DB_PORT: '3306' });
        assert.equal(ready.status, 'ready');
        if (ready.status === 'ready') {
            assert.equal(ready.config.host, 'db');
            assert.equal(ready.config.user, 'yuna');
            assert.equal(ready.config.database, 'yuna');
            assert.equal(ready.config.password, 'local-test');
        }
    });

    it('saves guild and member rows, then loads them again', async () => {
        const first = store();
        await first.store.prepare();
        await first.store.updateGuild(GUILD, { welcomeMessagesEnabled: true, responseCooldownSeconds: -4, allowedChannelIds: ['nope', MOCK_CHANNEL_ID] });
        await first.store.updateUser(GUILD, USER, { allowAffection: false });
        assert.equal(await first.store.markGreeted(GUILD, USER, Date.now()), true);
        assert.equal(await first.store.markGreeted(GUILD, USER, Date.now()), false);

        const saved = first.sql.guilds.get(GUILD) ?? '';
        assert.equal(saved.includes('hello from chat'), false);
        const second = store(first.sql);
        await second.store.prepare();
        assert.equal(second.store.getGuild(GUILD).welcomeMessagesEnabled, true);
        assert.equal(second.store.getGuild(GUILD).responseCooldownSeconds, 5);
        assert.deepEqual(second.store.getGuild(GUILD).allowedChannelIds, [MOCK_CHANNEL_ID]);
        assert.equal(second.store.getUser(GUILD, USER).allowAffection, false);
        assert.equal(await second.store.markGreeted(GUILD, USER, Date.now()), false);
    });

    it('copies an old settings file once and does not keep message text', async () => {
        const dir = await mkdtemp(path.join(tmpdir(), 'yuna-db-'));
        const phrase = 'private message text should not be stored';
        await writeFile(
            path.join(dir, 'settings.json'),
            JSON.stringify({
                messages: phrase,
                guilds: { [GUILD]: { welcomeMessagesEnabled: true, note: phrase } },
                users: { [`${GUILD}:${USER}`]: { allowMentionReplies: false } },
                greeted: { [`${GUILD}:${USER}`]: Date.now() },
            }),
        );
        const { sql, store: db } = store();
        assert.equal(await importLegacySettings(dir, db, silentLog), true);
        assert.equal(db.getGuild(GUILD).welcomeMessagesEnabled, true);
        assert.equal(db.getUser(GUILD, USER).allowMentionReplies, false);
        assert.equal(sql.guilds.get(GUILD)?.includes(phrase), false);
        assert.equal(sql.users.get(`${GUILD}:${USER}`)?.includes(phrase), false);
        const names = await readdir(dir);
        assert.equal(names.includes('settings.json'), false);
        assert.ok(names.some((name) => name.startsWith('settings.imported-')));
        const imported = await readFile(path.join(dir, names.find((name) => name.startsWith('settings.imported-')) ?? ''), 'utf8');
        assert.equal(imported.includes(phrase), true);

        const broken = await mkdtemp(path.join(tmpdir(), 'yuna-db-bad-'));
        await writeFile(path.join(broken, 'settings.json'), '{{');
        assert.equal(await importLegacySettings(broken, db, silentLog), false);
        const brokenNames = await readdir(broken);
        assert.ok(brokenNames.some((name) => name.startsWith('settings.invalid-')));
    });
});
