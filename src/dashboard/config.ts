import { isSnowflake } from '../personality/safety.js';

export interface DashboardConfig {
    clientId: string;
    clientSecret: string;
    sessionSecret: string;
    /** Origin only, with no trailing slash. */
    publicUrl: string;
    port: number;
    secureCookie: boolean;
}

export type DashboardConfigResult =
    | { enabled: false; reason: string }
    | { enabled: true; config: DashboardConfig };

const OFF = 'Dashboard is off. Set DISCORD_CLIENT_SECRET, DASHBOARD_SESSION_SECRET, and DASHBOARD_PUBLIC_URL to turn it on.';

export function readDashboardConfig(env: NodeJS.ProcessEnv = process.env): DashboardConfigResult {
    const clientId = env.DISCORD_CLIENT_ID?.trim() ?? '';
    const clientSecret = env.DISCORD_CLIENT_SECRET?.trim() ?? '';
    const sessionSecret = env.DASHBOARD_SESSION_SECRET?.trim() ?? '';
    const publicRaw = env.DASHBOARD_PUBLIC_URL?.trim() ?? '';
    const missing = [
        clientId ? '' : 'DISCORD_CLIENT_ID',
        clientSecret ? '' : 'DISCORD_CLIENT_SECRET',
        sessionSecret ? '' : 'DASHBOARD_SESSION_SECRET',
        publicRaw ? '' : 'DASHBOARD_PUBLIC_URL',
    ].filter((name) => name.length > 0);
    if (missing.length > 0) {
        const onlySecrets = missing.every((name) => name !== 'DISCORD_CLIENT_ID');
        return { enabled: false, reason: onlySecrets ? OFF : `Dashboard is off. Set ${missing.join(', ')} to turn it on.` };
    }
    if (!isSnowflake(clientId)) {
        return { enabled: false, reason: 'Dashboard is off. DISCORD_CLIENT_ID should be the numeric Discord application id.' };
    }
    if (sessionSecret.length < 16) {
        return { enabled: false, reason: 'Dashboard is off. DASHBOARD_SESSION_SECRET must be at least 16 characters.' };
    }
    const publicUrl = originOnly(publicRaw);
    if (!publicUrl) {
        return {
            enabled: false,
            reason: 'Dashboard is off. DASHBOARD_PUBLIC_URL must be an http or https origin, such as http://127.0.0.1:8787.',
        };
    }
    const port = readPort(env.DASHBOARD_PORT);
    if (port == null) {
        return { enabled: false, reason: 'Dashboard is off. DASHBOARD_PORT must be a whole number from 1 to 65535.' };
    }
    return {
        enabled: true,
        config: {
            clientId,
            clientSecret,
            sessionSecret,
            publicUrl,
            port,
            secureCookie: publicUrl.startsWith('https:'),
        },
    };
}

export function redirectUri(config: DashboardConfig): string {
    return `${config.publicUrl}/auth/callback`;
}

function originOnly(raw: string): string | null {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    if (url.search || url.hash) return null;
    return url.origin;
}

function readPort(raw: string | undefined): number | null {
    const text = raw?.trim() ?? '';
    if (!text) return 8787;
    if (!/^\d+$/.test(text)) return null;
    const port = Number(text);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return port;
}
