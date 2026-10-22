import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { findImage } from '../images/sources.js';
import { isRamImageKind, RAM_IMAGE_KINDS, type RamImageKind } from '../images/resolve-image.js';
import type { Command } from './types.js';
import { quiet } from './reply.js';
import { deliverImage } from './show-image.js';

const CAPTIONS: Record<RamImageKind, string> = {
    hug: 'Hug gif, from the Ram API.',
    kiss: 'A little kiss gif. Nothing serious.',
    cuddle: 'Cuddle gif.',
    slap: 'Playful slap gif. Nobody is actually in trouble.',
    laugh: 'Hehe.',
    cry: 'Okay, this one is a little emotional.',
    tired: 'Same, honestly.',
    sick: 'Rest up.',
    meme: 'Meme time.',
    ram: 'This one is Ram, from the same bot friend group. I am still me.',
    nekopara: 'Nekopara picture. Different cats, still cute.',
    miku: 'Miku!',
    goodMorning: 'Good morning.',
    goodNight: 'Good night.',
    animal: 'A little animal.',
};

const choices = RAM_IMAGE_KINDS.map((kind) => ({
    name: kind === 'goodMorning' ? 'Good morning' : kind === 'goodNight' ? 'Good night' : kind,
    value: kind,
}));

async function sendKind(interaction: Parameters<Command['execute']>[0], kind: RamImageKind | 'neko', caption: string): Promise<void> {
    const runtime = interaction.client.personality;
    const guild = interaction.guild;
    if (!runtime || !guild) {
        await quiet(interaction, 'I am not ready for that yet.');
        return;
    }
    const reserved = runtime.reservePublic(guild.id, interaction.user.id, 'image', runtime.getGuild(guild.id).responseCooldownSeconds);
    if (!reserved.ok) {
        await quiet(interaction, reserved.message);
        return;
    }
    await interaction.deferReply();
    const found = await findImage(kind);
    if (!found) {
        await interaction.editReply({ content: "I couldn't find an image just now. Try again in a bit." });
        return;
    }
    const line = found.fellBack ? "Ram API didn't have one, so here's a neko instead." : caption;
    await deliverImage(interaction, line, found);
}

export const image = {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Ask Yuna for a picture from the Ram API.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) => option.setName('kind').setDescription('Which picture?').setRequired(true).addChoices(...choices)),
    async execute(interaction) {
        const kind = interaction.options.getString('kind', true);
        if (!isRamImageKind(kind)) {
            await quiet(interaction, 'I do not have that picture.');
            return;
        }
        await sendKind(interaction, kind, CAPTIONS[kind]);
    },
} satisfies Command;

export const neko = {
    data: new SlashCommandBuilder()
        .setName('neko')
        .setDescription('A neko picture. Ram API does not have a general neko list.')
        .setContexts(InteractionContextType.Guild),
    async execute(interaction) {
        await sendKind(interaction, 'neko', 'Neko!');
    },
} satisfies Command;
