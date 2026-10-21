import 'dotenv/config';

import { logger } from './logger.js';
import { registerCommands } from './register-commands.js';

try {
    await registerCommands();
} catch (error) {
    logger.fatal(`Could not register slash commands`, error);
}