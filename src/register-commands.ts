import {REST, Routes} from 'discord.js';
import { commandData } from './commands/index.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';

export async function registerCommands(): Promise<void> {
const config = loadConfig();
const rest = new REST().setToken(config.token);
const body = commandData();
const route = config.guildId 
? Routes.applicationGuildCommands(config.clientId, config.guildId) 
: Routes.applicationCommands(config.clientId);
 
await rest.put(route, {body});
logger.info(`Registered ${body.length} commands ${config.guildId ? `in${config.guildId}` : 'globally'}`);
}