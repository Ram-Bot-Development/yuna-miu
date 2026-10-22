const SNOWFLAKE = /^\d{17,20}$/;

export function isSnowflake(value: string): boolean {
    return SNOWFLAKE.test(value);
}

/** Breaks mass pings even if a caller forgets allowed-mentions. */
export function sanitizeOutgoing(text: string): string {
    const stripped = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    return stripped.replace(/@(everyone|here)/gi, '＠$1').replace(/<@&\d+>/g, '@role');
}

export function clampText(text: string, max = 1500): string {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

export function mentionToken(userId: string): string {
    return isSnowflake(userId) ? `<@${userId}>` : 'someone';
}

export function allowedUserIds(ids: readonly string[]): string[] {
    return [...new Set(ids.filter(isSnowflake))];
}

export function fillTemplate(template: string, vars: Readonly<Record<string, string>>): string {
    return template.replace(/\{(actor|target|user|mood)\}/g, (_match, key: string) => vars[key] ?? '');
}
