import { ActivityType, type Client } from "discord.js";
import { loadConfig } from "../config.js";
import { logger } from "../logger.js";
import { registerCommands } from "../register-commands.js";

let registered = false;

export async function handleReady(client: Client): Promise<void> {
    if(!client.user) return;

    const config = loadConfig();
    client.user.setActivity('/help', {type: ActivityType.Listening});
    logger.info(`Logged in as ${client.user.tag}`);

    const applicationId = client.application?.id;
    if (applicationId && applicationId !== config.clientId) {
        logger.warn(`DISCORD_CLIENT_ID does not match this bot (${applicationId})`);
    }

    if(config.deplyCommands || registered) return;
    registered = true;

    try {
        await registerCommands();

    } catch (error) {
        logger.error(`Could not register slash commands`, error);
    }
    
}