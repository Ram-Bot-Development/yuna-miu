export const SOCIAL_ACTIONS = [
    { id: 'hug', affection: true, commandDescription: 'Give someone a friendly hug.' },
    { id: 'pat', affection: true, commandDescription: 'Give someone a friendly pat.' },
    { id: 'highfive', affection: false, commandDescription: 'High-five someone.' },
    { id: 'cheer', affection: false, commandDescription: 'Cheer someone on.' },
    { id: 'wave', affection: false, commandDescription: 'Wave at someone.' },
    { id: 'boop', affection: true, commandDescription: 'Boop someone. Gently.' },
] as const;

export type SocialActionId = (typeof SOCIAL_ACTIONS)[number]['id'];

const ACTION_IDS = new Set<string>(SOCIAL_ACTIONS.map((action) => action.id));

export function isSocialActionId(value: string): value is SocialActionId {
    return ACTION_IDS.has(value);
}

export function socialAction(id: SocialActionId): (typeof SOCIAL_ACTIONS)[number] {
    const action = SOCIAL_ACTIONS.find((item) => item.id === id);
    if (!action) return SOCIAL_ACTIONS[0];
    return action;
}

export const DEFAULT_SOCIAL_ACTIONS: readonly SocialActionId[] = SOCIAL_ACTIONS.map((action) => action.id);
