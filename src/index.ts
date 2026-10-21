import 'dotenv/config';

import { Events } from 'discord.js';
import { YunaBot } from './client.js';
import { loadCommands } from './commands/index.js';
import { loadConfig } from './config.js';
import { handleReady } from './events/ready.js';
import { handleInteraction } from './events/interactionCreate.js';
import { logger } from './logger.js';
import * as ramapi from 'ram-api.js';
import { ramapiversion } from './version.js';


YunaBot.on(Events.ClientReady, () => {
    void handleReady(YunaBot);
    ramapi.Events.emit("start-update-check");
    new ramapi.Utils().VersionCheck(ramapiversion, 60000, 6);
    //new ramapi.Utils().pingAsync().then(data => { logger.info(`Ram Api's Ping. ${data.ping}`) }).catch(err => {logger.error(`Error Checking ping for Ram API`, err)})
    new ramapi.DemoEndpoints(60000, 5).pingAsync().then(data => { logger.info(`Ram Api's Ping. ${data.ping}`) }).catch(err => {logger.error(`Error Checking ping for Ram API`, err)});

});

YunaBot.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
})

YunaBot.on(Events.Error, (error) => {
    logger.error(`Gateway error`, error);
});

ramapi.Events.on('package-update', (data) => {
    logger.warn(data);
    
    ramapi.Events.emit("stop-update-check");
    
});

let stopping = false;

function shutdown(signal: string): void {
    if (stopping) return;
    stopping = true;
    logger.info(`Shutting down (${signal})`);
    YunaBot.destroy();
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
    loadCommands(YunaBot);
    await YunaBot.login(loadConfig().token);
} catch (error) {
    logger.fatal(`Could not start`, error);
}