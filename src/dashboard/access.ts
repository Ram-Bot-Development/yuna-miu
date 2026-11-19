const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

/** True when the Discord permission integer includes Manage Server. */
export function hasManageGuild(permissions: string): boolean {
    return permissionBit(permissions, MANAGE_GUILD);
}

/**
 * Server owners and administrators can use `/yuna settings` as well.
 * The guild list from Discord does not expand the administrator bit into Manage Server.
 */
export function canManageDashboardGuild(input: { permissions: string; owner: boolean }): boolean {
    if (input.owner) return true;
    return hasManageGuild(input.permissions) || permissionBit(input.permissions, ADMINISTRATOR);
}

function permissionBit(permissions: string, bit: bigint): boolean {
    if (!/^\d+$/.test(permissions)) return false;
    try {
        return (BigInt(permissions) & bit) === bit;
    } catch {
        return false;
    }
}
