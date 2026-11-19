import { mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { normalizeGuildSettings, type GuildSettingsPatch } from '../config/guild-settings.js';
import { normalizeUserPreferences, type UserPreferencesPatch } from '../config/user-preferences.js';
import type { Log } from '../log.js';
import { isSnowflake } from '../personality/safety.js';
import type { DatabaseConfig } from './database-config.js';
import { migrateStore } from './file-store.js';
import { MemorySettingsStore } from './memory-store.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GREET_LIMIT = 2000;

const SELECT_GUILDS = 'SELECT guild_id, settings FROM guild_settings';
const SELECT_USERS = 'SELECT guild_id, user_id, preferences FROM user_preferences';
const SELECT_GREETED = 'SELECT guild_id, user_id, greeted_at FROM greeted';
const UPSERT_GUILD = `INSERT INTO guild_settings (guild_id, settings) VALUES (?, ?)
ON DUPLICATE KEY UPDATE settings = VALUES(settings)`;
const UPSERT_USER = `INSERT INTO user_preferences (guild_id, user_id, preferences) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)`;
const INSERT_GREET = 'INSERT IGNORE INTO greeted (guild_id, user_id, greeted_at) VALUES (?, ?, ?)';
const DELETE_OLD_GREETS = 'DELETE FROM greeted WHERE greeted_at < ?';
const DELETE_EXTRA_GREETS = `DELETE FROM greeted
WHERE (guild_id, user_id) NOT IN (
  SELECT guild_id, user_id FROM (
    SELECT guild_id, user_id FROM greeted ORDER BY greeted_at DESC LIMIT ${GREET_LIMIT}
  ) AS newest
)`;

export interface SqlExecutor {
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
    execute(sql: string, params?: readonly unknown[]): Promise<{ affectedRows: number }>;
}

/**
 * Guild settings, member preferences, and welcome ids in MariaDB.
 * Reads stay in memory after load. Writes go to the database and then memory.
 */
export class MariaDbSettingsStore extends MemorySettingsStore {
    constructor(
        private readonly sql: SqlExecutor,
        private readonly closePool: () => Promise<void> = async () => undefined,
    ) {
        super();
    }

    async prepare(): Promise<void> {
        await this.sql.execute(`CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id VARCHAR(20) NOT NULL,
  settings JSON NOT NULL,
  PRIMARY KEY (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        await this.sql.execute(`CREATE TABLE IF NOT EXISTS user_preferences (
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  preferences JSON NOT NULL,
  PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        await this.sql.execute(`CREATE TABLE IF NOT EXISTS greeted (
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  greeted_at BIGINT NOT NULL,
  PRIMARY KEY (guild_id, user_id),
  KEY greeted_at (greeted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        await this.pruneGreeted(Date.now());
        await this.hydrate();
    }

    override async updateGuild(guildId: string, patch: GuildSettingsPatch) {
        const next = normalizeGuildSettings({ ...this.getGuild(guildId), ...defined(patch) });
        await this.sql.execute(UPSERT_GUILD, [guildId, JSON.stringify(next)]);
        return super.updateGuild(guildId, next);
    }

    override async updateUser(guildId: string, userId: string, patch: UserPreferencesPatch) {
        const next = normalizeUserPreferences({ ...this.getUser(guildId, userId), ...defined(patch) });
        await this.sql.execute(UPSERT_USER, [guildId, userId, JSON.stringify(next)]);
        return super.updateUser(guildId, userId, next);
    }

    override async markGreeted(guildId: string, userId: string, now: number): Promise<boolean> {
        if (!isSnowflake(guildId) || !isSnowflake(userId)) return false;
        const result = await this.sql.execute(INSERT_GREET, [guildId, userId, now]);
        if (result.affectedRows === 0) {
            await super.markGreeted(guildId, userId, now);
            return false;
        }
        await super.markGreeted(guildId, userId, now);
        await this.pruneGreeted(now);
        return true;
    }

    async close(): Promise<void> {
        await this.closePool();
    }

    private async hydrate(): Promise<void> {
        const guilds = await this.sql.query<{ guild_id: string; settings: unknown }>(SELECT_GUILDS);
        for (const row of guilds) {
            if (!isSnowflake(row.guild_id)) continue;
            await super.updateGuild(row.guild_id, normalizeGuildSettings(parseJson(row.settings)));
        }
        const users = await this.sql.query<{ guild_id: string; user_id: string; preferences: unknown }>(SELECT_USERS);
        for (const row of users) {
            if (!isSnowflake(row.guild_id) || !isSnowflake(row.user_id)) continue;
            await super.updateUser(row.guild_id, row.user_id, normalizeUserPreferences(parseJson(row.preferences)));
        }
        const now = Date.now();
        const greeted = await this.sql.query<{ guild_id: string; user_id: string; greeted_at: number | string }>(SELECT_GREETED);
        for (const row of greeted) {
            const at = Number(row.greeted_at);
            if (!isSnowflake(row.guild_id) || !isSnowflake(row.user_id) || !Number.isFinite(at) || now - at > WEEK_MS) continue;
            await super.markGreeted(row.guild_id, row.user_id, at);
        }
    }

    private async pruneGreeted(now: number): Promise<void> {
        await this.sql.execute(DELETE_OLD_GREETS, [now - WEEK_MS]);
        await this.sql.execute(DELETE_EXTRA_GREETS);
    }
}

export async function openMariaDbStore(config: DatabaseConfig, directory: string, log: Log): Promise<MariaDbSettingsStore> {
    const pool = createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 8,
        charset: 'utf8mb4',
        timezone: 'Z',
    });
    const store = new MariaDbSettingsStore(new MysqlExecutor(pool), () => pool.end());
    let last: unknown;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            await pool.query('SELECT 1');
            last = undefined;
            break;
        } catch (error) {
            last = error;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    if (last) {
        await pool.end().catch(() => undefined);
        throw last instanceof Error ? last : new Error('MariaDB did not become ready');
    }
    await mkdir(directory, { recursive: true });
    await store.prepare();
    const imported = await importLegacySettings(directory, store, log);
    log.info(imported ? 'Imported settings.json into MariaDB.' : 'MariaDB settings store ready.');
    return store;
}

/** One-time copy of the old settings file. The file is renamed so a later save is not overwritten. */
export async function importLegacySettings(directory: string, store: MariaDbSettingsStore, log: Log): Promise<boolean> {
    const filePath = path.join(directory, 'settings.json');
    let raw: string;
    try {
        raw = await readFile(filePath, 'utf8');
    } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        if (code === 'ENOENT') return false;
        throw error;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        await rename(filePath, path.join(directory, `settings.invalid-${Date.now()}.json`));
        log.warn('Settings file could not be parsed and was moved aside.');
        return false;
    }
    const migrated = migrateStore(parsed);
    for (const [guildId, value] of Object.entries(migrated.guilds)) {
        if (!isSnowflake(guildId)) continue;
        await store.updateGuild(guildId, normalizeGuildSettings(value));
    }
    for (const [key, value] of Object.entries(migrated.users)) {
        const [guildId, userId] = key.split(':');
        if (!guildId || !userId || !isSnowflake(guildId) || !isSnowflake(userId)) continue;
        await store.updateUser(guildId, userId, normalizeUserPreferences(value));
    }
    const now = Date.now();
    for (const [key, at] of Object.entries(migrated.greeted)) {
        const [guildId, userId] = key.split(':');
        if (!guildId || !userId || !isSnowflake(guildId) || !isSnowflake(userId) || now - at > WEEK_MS) continue;
        await store.markGreeted(guildId, userId, at);
    }
    await rename(filePath, path.join(directory, `settings.imported-${Date.now()}.json`));
    return true;
}

class MysqlExecutor implements SqlExecutor {
    constructor(private readonly pool: Pool) {}

    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(sql, params as never);
        return rows as T[];
    }

    async execute(sql: string, params: readonly unknown[] = []): Promise<{ affectedRows: number }> {
        const [result] = await this.pool.query(sql, params as never);
        if (Array.isArray(result)) return { affectedRows: 0 };
        return { affectedRows: (result as ResultSetHeader).affectedRows ?? 0 };
    }
}

function parseJson(value: unknown): unknown {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return value ?? {};
}

function defined<T extends object>(patch: T): Partial<T> {
    return Object.fromEntries(Object.entries(patch).filter((entry) => entry[1] !== undefined)) as Partial<T>;
}
