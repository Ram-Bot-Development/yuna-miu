import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'yuna_session';
export const OAUTH_COOKIE = 'yuna_oauth';

const SEALED = /^[A-Za-z0-9_-]{16,128}\.[A-Za-z0-9_-]{20,128}$/;

export interface DashboardSession {
    userId: string;
    username: string;
    accessToken: string;
    csrf: string;
    expiresAt: number;
}

export function randomId(): string {
    return randomBytes(18).toString('base64url');
}

export function seal(value: string, secret: string): string {
    const mac = createHmac('sha256', secret).update(value).digest('base64url');
    return `${value}.${mac}`;
}

export function openSeal(sealed: string, secret: string): string | null {
    if (!SEALED.test(sealed)) return null;
    const dot = sealed.lastIndexOf('.');
    const value = sealed.slice(0, dot);
    const mac = sealed.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(value).digest('base64url');
    const left = Buffer.from(mac);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    return value;
}

export function sameValue(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

export function readCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() !== name) continue;
        const value = part.slice(eq + 1).trim();
        try {
            return decodeURIComponent(value);
        } catch {
            return null;
        }
    }
    return null;
}

export function cookieHeader(name: string, value: string, options: { maxAge: number; secure: boolean }): string {
    const parts = [`${name}=${value}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${options.maxAge}`];
    if (options.secure) parts.push('Secure');
    return parts.join('; ');
}

export class SessionStore {
    private readonly sessions = new Map<string, DashboardSession>();

    create(input: Omit<DashboardSession, 'csrf'>): { id: string; session: DashboardSession } {
        const id = randomId();
        const session: DashboardSession = { ...input, csrf: randomId() };
        this.sessions.set(id, session);
        while (this.sessions.size > 500) {
            const oldest = this.sessions.keys().next().value;
            if (oldest === undefined) break;
            this.sessions.delete(oldest);
        }
        return { id, session };
    }

    get(id: string, now: number): DashboardSession | null {
        const session = this.sessions.get(id);
        if (!session) return null;
        if (session.expiresAt <= now) {
            this.sessions.delete(id);
            return null;
        }
        return session;
    }

    delete(id: string): void {
        this.sessions.delete(id);
    }

    clear(): void {
        this.sessions.clear();
    }
}
