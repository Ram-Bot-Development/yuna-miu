import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeGuildSettings } from '../config/guild-settings.js';
import { normalizeUserPreferences } from '../config/user-preferences.js';
import type { Log } from '../log.js';
import { isSnowflake } from '../personality/safety.js';
import { MemorySettingsStore } from './memory-store.js';
import type { SettingsRepository } from './repository.js';

export const SETTINGS_VERSION = 1;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface StoreFile {
    version: number;
    guilds: Record<string, unknown>;
    users: Record<string, unknown>;
    greeted: Record<string, number>;
}

export function migrateStore(raw: unknown): StoreFile {
    const empty: StoreFile = { version: SETTINGS_VERSION, guilds: {}, users: {}, greeted: {} };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
    const input = raw as Record<string, unknown>;
    const version = typeof input.version === 'number' ? input.version : 0;
    const guilds = isRecord(input.guilds) ? input.guilds : {};
    const users = isRecord(input.users) ? input.users : {};
    const greeted = isGreetedMap(input.greeted) ? input.greeted : {};
    if (version > SETTINGS_VERSION) return { version: SETTINGS_VERSION, guilds, users, greeted };
    return { version: SETTINGS_VERSION, guilds, users, greeted };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGreetedMap(value: unknown): value is Record<string, number> {
    if (!isRecord(value)) return false;
    return Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
}

export class FileSettingsStore extends MemorySettingsStore implements SettingsRepository {
    private chain: Promise<void> = Promise.resolve();
    private snapshot: StoreFile = { version: SETTINGS_VERSION, guilds: {}, users: {}, greeted: {} };

    constructor(
        private readonly directory: string,
        private readonly log: Log,
    ) {
        super();
    }

    private get filePath(): string {
        return path.join(this.directory, 'settings.json');
    }

    async load(): Promise<void> {
        await mkdir(this.directory, { recursive: true });
        let raw: string;
        try {
            raw = await readFile(this.filePath, 'utf8');
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code === 'ENOENT') return;
            throw error;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw) as unknown;
        } catch {
            const aside = path.join(this.directory, `settings.invalid-${Date.now()}.json`);
            await rename(this.filePath, aside);
            this.log.warn('Settings file could not be parsed and was moved aside.');
            return;
        }
        const migrated = migrateStore(parsed);
        this.snapshot = { version: SETTINGS_VERSION, guilds: {}, users: {}, greeted: {} };
        for (const [guildId, value] of Object.entries(migrated.guilds)) {
            if (!isSnowflake(guildId)) continue;
            this.snapshot.guilds[guildId] = await super.updateGuild(guildId, normalizeGuildSettings(value));
        }
        for (const [key, value] of Object.entries(migrated.users)) {
            const [guildId, userId] = key.split(':');
            if (!guildId || !userId || !isSnowflake(guildId) || !isSnowflake(userId)) continue;
            this.snapshot.users[key] = await super.updateUser(guildId, userId, normalizeUserPreferences(value));
        }
        const now = Date.now();
        for (const [key, at] of Object.entries(migrated.greeted)) {
            const [guildId, userId] = key.split(':');
            if (!guildId || !userId || !isSnowflake(guildId) || !isSnowflake(userId) || now - at > WEEK_MS) continue;
            if (await super.markGreeted(guildId, userId, at)) this.snapshot.greeted[key] = at;
        }
        await this.persist();
    }

    override async updateGuild(guildId: string, patch: Parameters<MemorySettingsStore['updateGuild']>[1]) {
        return this.enqueue(async () => {
            const next = await super.updateGuild(guildId, patch);
            this.snapshot.guilds[guildId] = next;
            await this.persist();
            return next;
        });
    }

    override async updateUser(guildId: string, userId: string, patch: Parameters<MemorySettingsStore['updateUser']>[2]) {
        return this.enqueue(async () => {
            const next = await super.updateUser(guildId, userId, patch);
            this.snapshot.users[`${guildId}:${userId}`] = next;
            await this.persist();
            return next;
        });
    }

    override async markGreeted(guildId: string, userId: string, now: number): Promise<boolean> {
        return this.enqueue(async () => {
            const added = await super.markGreeted(guildId, userId, now);
            if (!added) return false;
            this.snapshot.greeted[`${guildId}:${userId}`] = now;
            this.pruneGreeted(now);
            await this.persist();
            return true;
        });
    }

    private pruneGreeted(now: number): void {
        for (const [key, at] of Object.entries(this.snapshot.greeted)) {
            if (now - at > WEEK_MS) delete this.snapshot.greeted[key];
        }
        const entries = Object.entries(this.snapshot.greeted);
        if (entries.length <= 2000) return;
        entries.sort((a, b) => a[1] - b[1]);
        this.snapshot.greeted = Object.fromEntries(entries.slice(entries.length - 2000));
    }

    private async persist(): Promise<void> {
        await mkdir(this.directory, { recursive: true });
        const temp = path.join(this.directory, `settings.${process.pid}.${Date.now()}.tmp`);
        const body = JSON.stringify({ ...this.snapshot, version: SETTINGS_VERSION }, null, 2);
        await writeFile(temp, body, 'utf8');
        try {
            await rename(temp, this.filePath);
        } catch {
            await writeFile(this.filePath, body, 'utf8');
            await unlink(temp).catch(() => undefined);
        }
    }

    private enqueue<T>(work: () => Promise<T>): Promise<T> {
        const run = this.chain.then(work, work);
        this.chain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }
}

export async function openSettingsStore(directory: string, log: Log): Promise<FileSettingsStore> {
    const store = new FileSettingsStore(directory, log);
    await store.load();
    return store;
}
