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
        const code = discordErrorCode(error);
        if (code === 10062 || code === 40060) {
            logger.warn(`/${int.commandName} was already closed by Discord (${code}). Another logged-in copy of this bot may have answered it.`);
            return;
        }
        logger.error(`/${int.commandName} failed`, error);

        try {
            const content = 'Something went wrong running that.';
            if (int.replied || int.deferred) {
                await int.followUp({ content, flags: MessageFlags.Ephemeral });
            } else {
                await int.reply({ content, flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            if (discordErrorCode(err) === 10062 || discordErrorCode(err) === 40060) return;
            logger.error('Could not send the error reply', err);
        }
    }
}

function discordErrorCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    return typeof error.code === 'number' ? error.code : undefined;
}