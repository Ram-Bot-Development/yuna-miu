import type { Client } from 'discord.js';
import { logger } from '../logger.js';
import type { Command } from './types.js';
import { about } from './about.js';
import { help } from './help.js';
import { invite } from './invite.js';

export const commands: Command[] = [about, help, invite];

export function loadCommands(client: Client): void {
    for (const command of commands) client.commands.set(command.data.name, command);
    logger.info(`Loaded ${commands.length} commands`);
}

export function commandData() {
    return commands.map((command) => command.data.toJSON());
}