import type { Log } from '../log.js';
import { readDatabaseConfig } from './database-config.js';
import { openSettingsStore } from './file-store.js';
import { openMariaDbStore } from './mariadb-store.js';
import type { SettingsRepository } from './repository.js';

/** MariaDB when DB_HOST is set. Otherwise the settings file, so local runs still start. */
export async function openPersonalityStore(directory: string, env: NodeJS.ProcessEnv, log: Log): Promise<SettingsRepository> {
    const db = readDatabaseConfig(env);
    if (db.status === 'invalid') log.error(db.reason);
    if (db.status === 'ready') {
        try {
            return await openMariaDbStore(db.config, directory, log);
        } catch (error) {
            log.error('MariaDB is not ready. Using the settings file for this run.', error);
        }
    }
    return openSettingsStore(directory, log);
}
