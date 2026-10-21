import type {
    ChatInputCommandInteraction,
    RESTPostAPIApplicationCommandsJSONBody
} from 'discord.js';

export interface Command {
    data: {
        name: string;
        description: string;
        toJSON(): RESTPostAPIApplicationCommandsJSONBody;
    };
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}