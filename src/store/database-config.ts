export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export type DatabaseConfigResult =
    | { status: 'off' }
    | { status: 'invalid'; reason: string }
    | { status: 'ready'; config: DatabaseConfig };

/** MariaDB is used when DB_HOST is set. An empty host keeps the settings file. */
export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfigResult {
    const host = env.DB_HOST?.trim() ?? '';
    if (!host) return { status: 'off' };
    const password = env.DB_PASSWORD ?? '';
    if (!password.trim()) {
        return { status: 'invalid', reason: 'DB_PASSWORD is required when DB_HOST is set.' };
    }
    const parsed = Number(env.DB_PORT?.trim() || '3306');
    const port = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 3306;
    return {
        status: 'ready',
        config: {
            host,
            port,
            user: env.DB_USER?.trim() || 'yuna',
            password,
            database: env.DB_NAME?.trim() || 'yuna',
        },
    };
}
