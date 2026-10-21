import { MessageFlags, type Interaction } from "discord.js";
import { logger } from "../logger.js";

export async function handleInteraction(int: Interaction): Promise<void> {
    if(!int.isChatInputCommand()) return;

    const command = int.client.commands.get(int.commandName);

    if (!command) {
        await int.reply({
            content: "I don't have that command.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    try {
        await command.execute(int);
    
    } catch (error) {
        logger.error(`/${int.commandName} failed`, error);

        try {
            const content = `Something went wrong running that.`;
            if (int.replied || int.deferred) {
                await int.followUp( {content, flags: MessageFlags.Ephemeral});
            } else {
                await int.reply({content, flags: MessageFlags.Ephemeral});
            }
        } catch (err) {
            logger.error(`Could not send the wrror reply`, err);
        }
    }
}