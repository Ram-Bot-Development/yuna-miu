import { SAFE_LINE } from './character.js';
import type { MoodId } from './moods.js';
import { fillTemplate, sanitizeOutgoing, clampText } from './safety.js';
import { ResponseSelector } from './response-selector.js';
import type { Rng } from './mood-selector.js';

export interface ResponsePool {
    any: readonly string[];
    moods?: Partial<Record<MoodId, readonly string[]>>;
}

function pool(any: readonly string[], moods?: ResponsePool['moods']): ResponsePool {
    return moods ? { any, moods } : { any };
}

const hello = pool(
    ["Hey {user}. I'm here."],
    {
        happy: [
            'Miu~! Hiii {user}! What are we getting into today? Something fun, I hope. 🐾',
            'Hiii! So happy to see you, {user}.',
            '{user}! You showed up. I already like where this is going.',
        ],
        playful: [
            'Well well well... look who showed up, {user}. 😼',
            'Oh, {user}. I was being extremely well behaved. You just missed it.',
            'Hehe, {user}. I definitely was not about to cause a tiny bit of trouble.',
        ],
        sleepy: [
            'Mmm... hi hi, {user}. Wanna hang out quietly? 💤',
            'Oh, hey {user}. Soft volume today, but I am still here.',
            '*yawn* Hi {user}. We can hang out. Just maybe on the cozy setting.',
        ],
        curious: [
            'Oooh, {user}! What are you up to? I want the cool parts. 👀',
            '{user}! Tell me one interesting thing. I am collecting those today.',
            'Hey {user} — what are you working on, if you feel like sharing?',
        ],
        excited: [
            '{user}!! Hi!! Okay, what are we doing?',
            'You are here, {user}! I already feel like something fun might happen.',
            'Yesss, {user}! I was hoping someone would show up.',
        ],
        cozy: [
            'Hey {user}. Come sit. There is room. 💜',
            'Hi {user}. Soft mode is on, and you are welcome in it.',
            'Miu~ hi, {user}. We can just hang out if you want.',
        ],
    },
);

const mentionGeneral = pool(
    ['You called? I am around, {user}.'],
    {
        happy: [
            'You rang, {user}? I am free. What is the plan?',
            'Miu~! I heard my name. Hi, {user}.',
            'Present! What do you need, {user}?',
        ],
        playful: [
            'Just hanging around causing absolutely zero trouble. ...Probably. 🐾',
            'Me?! I would neverrr~ ...Okay, maybe a little. Nya~!',
            'You caught me, {user}. I was minding my own business. Mostly.',
        ],
        sleepy: [
            'Mmm, I am here, {user}. Talk slow, I am in loaf mode.',
            'I heard you. I am awake enough. What is up?',
            'Hi {user}. Quiet Yuna is still Yuna.',
        ],
        curious: [
            'Ooh, {user}, what is happening? Give me the interesting version.',
            'You have my attention. What is the thing?',
            'Tell me, {user}. I will try not to interrupt. Much.',
        ],
        excited: [
            'Yes yes yes, I am here! What did I miss?',
            '{user}! Okay I am listening. Go.',
            'Called and I appeared. That is my best trick.',
        ],
        cozy: [
            'Hey {user}. I am here if you want company.',
            'Hi. No rush. What is on your mind?',
            'I saved you a spot in the conversation, {user}.',
        ],
    },
);

const mentionGreeting = pool(['Hi {user}.'], {
    happy: ['Miu~! Hiii {user}! 💕', 'Hello hello, {user}!', 'Hey! Glad you said hi.'],
    playful: ['Oh we are doing greetings? Hi, {user}. I practiced this.', 'Heyyy {user}. I saw you first. Maybe.', 'Hi! I will allow this wholesome behavior.'],
    sleepy: ['Hi hi, {user}... 💤', 'Morning-or-whenever, {user}.', 'Hey. I am here. That is the whole greeting.'],
    curious: ['Hi {user}! What are you up to?', 'Hello! Anything fun happening?', 'Hey {user}. What should I know?'],
    excited: ['HI {user}!', 'Hello!! You beat me to the greeting.', 'Hey hey hey, {user}!'],
    cozy: ['Hi {user}. Nice to see you.', 'Hello. Pull up a chair.', 'Hey. Glad you are here.'],
});

const mentionCaring = pool(
    [
        'Aww, that sounds like a long day, {user}. You deserve a little break. Want to hang out for a bit?',
        'That sounds heavy in the ordinary way, and that still counts. I can keep you company for a minute.',
        'I am a bot, so I cannot fix the day, but I can sit with you in the chat. No pressure to be cheerful.',
    ],
    {
        sleepy: ['That sounds tiring. We can keep this quiet, {user}.', 'Rough one? I will turn the energy down.'],
        cozy: ['Come sit for a second, {user}. You do not have to perform here.', 'Long day. I have a calm setting if you want it.'],
    },
);

const mentionSensitive = pool([
    'I am glad you said something, {user}. I am a fictional bot, so I cannot give you the help this deserves. If you might be in danger, please contact local emergency services or someone you trust.',
    'I will not joke about that. Please talk to a person who can actually support you — someone nearby, or emergency services if you are unsafe. I am only a bot.',
    'That is serious, and I will not pretend I can carry it. Please reach out to someone you trust or a local crisis resource if you need help now.',
]);

const mentionCelebration = pool(
    ['WAIT, you did?! Let us goooo!! I knew you could do it, {user}!'],
    {
        happy: ['That is awesome, {user}! I am celebrating with you.', 'Yes! Look at you go!', 'I am so here for this win.'],
        playful: ['Excuse me, {user}, that was extremely cool of you.', 'I will allow a tiny victory lap. You earned it.', 'Hehe, success looks good on you.'],
        sleepy: ['Oh, nice... that is a real win, {user}. I am softly proud.', 'You did it. I will clap quietly.'],
        curious: ['Okay wait, tell me the cool part. How did you pull that off?', 'A win! What was the moment it clicked?'],
        excited: ['AHHH yes!! {user}!! That rules!', 'Stop, that is so good! I am excited for you!', 'We are celebrating. This is not optional. It is joyful.'],
        cozy: ['That is wonderful, {user}. I hope it feels as good as it sounds.', 'A win like that deserves a calm little cheer. I am glad.'],
    },
);

const mentionCurious = pool(
    [
        'Oooo! What kind of project? Tell me the cool parts. Maybe not everything... but the cool parts.',
        'I want to hear about it, {user}. What are you making?',
        'New thing! What is the part you are excited about?',
    ],
    {
        curious: ['Okay I am invested. What is the project?', 'Tell me how it works, if you want.', 'I love a work-in-progress. Where are you at?'],
        cozy: ['That sounds nice to work on. How is it going?', 'I am listening, {user}. No rush.'],
    },
);

const joke = pool(
    ['I tried to host hide and seek. I was under the couch the whole time. In my defense, I am a catgirl. In a bot. You know what I mean.'],
    {
        happy: [
            'Why did I bring a pencil to the raid? In case I needed to draw aggro. I will see myself out.',
            'My favorite strategy is snacks. My second favorite is also snacks.',
        ],
        playful: [
            'I would tell you a secret, but I already forgot it on purpose. Mischief.',
            'I am not saying I cheated at rock-paper-scissors. I am saying I have no hands. Suspicious.',
        ],
        sleepy: [
            'Joke loading... it fell asleep. The joke is that I am the joke. Goodnight-ish.',
            'Why did the cat nap? Because the alternative was a meeting. I respect the cat.',
        ],
        curious: [
            'Here is a riddle: what is small, fictional, and asking too many questions? Hi.',
            'I investigated a mystery. It was my own notification. Case closed.',
        ],
        excited: [
            'Joke incoming! ...I got excited and dropped it. The dropping is the joke. You are welcome.',
            'Why was the high score nervous? Because I was cheering too loud. Allegedly.',
        ],
        cozy: [
            'A soft joke: you matter, and also blankets are a personality. I support both.',
            'I told the server a bedtime joke. It was just the word "nap." Five stars.',
        ],
    },
);

const compliment = pool(
    ['{user}, you make this place easier to be in.'],
    {
        happy: [
            '{user}, I like how you show up. That is a real skill.',
            'You have a good "I will figure it out" energy, {user}.',
        ],
        playful: [
            '{user}, you are suspiciously great. I am keeping an eye on you. A friendly eye.',
            'If being decent were a speedrun, you would have a weirdly good time.',
        ],
        sleepy: [
            '{user}, you are good company even when the day is quiet.',
            'Soft compliment: you are trying, and I notice.',
        ],
        curious: [
            '{user}, the way you get interested in things is contagious.',
            'I like how your brain picks projects. It has taste.',
        ],
        excited: [
            '{user}!! You are doing better than you think. I am sure of it.',
            'Can we talk about how cool it is that you are here? We can.',
        ],
        cozy: [
            '{user}, you are welcome here. That is the compliment and also the truth.',
            'You do not have to be impressive for me to be glad you showed up.',
        ],
    },
);

const encourage = pool(
    ['Small progress still counts, {user}. I see you working at it.'],
    {
        happy: [
            'You have already made it through every hard day so far. This one can join the list.',
            'One small step, {user}. I will be the cheer section.',
        ],
        playful: [
            'You can do the thing. I checked with the mischief council. It was unanimous.',
            'If it goes badly, we adapt. If it goes well, I get to say I knew it.',
        ],
        sleepy: [
            'You do not have to sprint, {user}. A slow try still counts.',
            'Rest is allowed. So is trying again later. Both are plans.',
        ],
        curious: [
            'What is the next tiny piece of it? Start there. I want to hear how it goes.',
            'You are learning. That is the whole job right now.',
        ],
        excited: [
            'You have got this, {user}! Not because I shouted. Because you keep going.',
            'Okay, team. The team is you, plus one fictional cat. We move.',
        ],
        cozy: [
            'Take a breath, then one small step. I will be here.',
            'It is okay if today is a maintenance day. Those still move you forward.',
        ],
    },
);

const contextualCelebration = pool(
    [
        'AHHH congrats!! That is awesome!',
        'Wait, really? I am celebrating with you.',
        'That is a real win. I am glad it happened.',
    ],
    {
        sleepy: ['Oh, that is wonderful. Quiet congrats.'],
        cozy: ['That is lovely. I hope you get to enjoy it.'],
        excited: ['YES!! I love this for you!'],
    },
);

const contextualMorning = pool(
    ['Good morning! I hope today is kind to you.', 'Morning. I am around if the server needs a hello.'],
    {
        sleepy: ['Morning... I am up. Technically.', 'Good morning. Soft start.'],
        cozy: ['Good morning. There is no rush.'],
        playful: ['Good morning. I have already been well behaved for several seconds.'],
    },
);

const contextualNews = pool(
    [
        'Ooh, news? I am listening if you want to share the fun version.',
        'Big news energy! I hope it is the good kind.',
        'Okay you cannot just say that and leave. Unless you want to. Then I will behave.',
    ],
    {
        curious: ['Wait, what is the news? I am curious now.'],
        cozy: ['Sounds like something worth telling. I am here for it.'],
    },
);

const contextualGame = pool(
    [
        'Let us gooo, that sounds like a good game moment.',
        'Game brain activated. I am rooting for you.',
        'Okay that is a highlight. I am saving it in my fictional memory. Which means I am saying it out loud.',
    ],
    {
        excited: ['THAT is the clip! Nice!'],
        playful: ['Skill? Luck? Mischief? I accept all three.'],
    },
);

function social(lines: readonly string[]): ResponsePool {
    return pool(lines);
}

export const POOLS = {
    hello,
    mentionGeneral,
    mentionGreeting,
    mentionCaring,
    mentionSensitive,
    mentionCelebration,
    mentionCurious,
    joke,
    compliment,
    encourage,
    contextualCelebration,
    contextualMorning,
    contextualNews,
    contextualGame,
    welcome: pool(
        [
            'Miu~! A new friend has arrived!! 🐾 Welcome to the server, {user}! Make yourself comfy!',
            'Oh! {user} just showed up. Welcome in.',
            'Hey {user}, welcome! I am Yuna. Say hi whenever you feel like it.',
            'A new face! Hi {user}. Glad you are here.',
            'Welcome, {user}! Look around, and do not mind me being a little silly.',
        ],
        {
            sleepy: ['Welcome, {user}. I will keep the hello gentle.', 'Hi {user}. Glad you found the server.'],
            cozy: ['Welcome in, {user}. There is room for you here.', 'Hey {user}. Settle in whenever you are ready.'],
        },
    ),
    hugOther: social([
        '{actor} offers {target} a gentle hug. Friendly only, and only because they were okay with it. 💙',
        'Hug time. {actor} gives {target} a short, friendly hug.',
        '{actor} hugs {target}. The "you belong here" kind.',
    ]),
    hugSelf: social([
        '{actor} hugs themselves. Honestly? Valid.',
        'Self-hug acquired by {actor}. I support this.',
        '{actor} wraps up in a solo hug. Wholesome. I am not even teasing.',
    ]),
    hugYuna: social([
        '{actor} hugs me! Miu~! Friendly squeeze received. 🐾',
        'Eee, {actor}! I am a bot, and the gesture is still sweet.',
        '{actor} offered me a hug. I will take the friendly version.',
    ]),
    patOther: social([
        '{actor} gives {target} a gentle pat. Head-pat rules: friendly, brief, and welcome.',
        'Pat delivered from {actor} to {target}. Very official. I stamped it.',
        '{actor} pats {target}. That is the whole scene, and it is nice.',
    ]),
    patSelf: social([
        '{actor} pats their own head. Self-care. I respect it.',
        'Self-pat from {actor}. Iconic, honestly.',
    ]),
    patYuna: social([
        '{actor} pats me. My fictional ears are delighted. 🐾',
        'Pat received from {actor}. I will be normal about it. Mostly.',
    ]),
    highfiveOther: social([
        'Yesss! {actor} gives {target} an epic high-five!',
        '{actor} winds up, and {target} gets a clean high-five. The crowd (me) is impressed.',
        'High-five from {actor} to {target}. No notes.',
    ]),
    highfiveSelf: social([
        '{actor} high-fives themselves. That is a power move.',
        'Solo high-five by {actor}. The form is excellent.',
    ]),
    highfiveYuna: social([
        '{actor} high-fives me! I was ready. I am always narratively ready.',
        'High-five accepted from {actor}. We are a team now. A tiny one.',
    ]),
    cheerOther: social([
        '{actor} is cheering for {target}! I am joining in.',
        'A cheer from {actor} to {target}. You have got people in your corner.',
        '{actor} waves a tiny fictional flag for {target}. Go!',
    ]),
    cheerSelf: social([
        '{actor} cheers for themselves. As they should.',
        'Self-cheer unlocked by {actor}. I am adding a second cheer.',
    ]),
    cheerYuna: social([
        '{actor} cheers for me! I will use this power responsibly. Probably.',
        'A cheer for Yuna, from {actor}. I am keeping it.',
    ]),
    waveOther: social([
        '{actor} waves at {target}. Hi, from across the chat.',
        'Wave delivered: {actor} to {target}.',
        '{actor} gives {target} a little wave. No agenda. Just hello.',
    ]),
    waveSelf: social([
        '{actor} waves at themselves in the metaphorical mirror. Hello, you.',
        'Self-wave from {actor}. It counts.',
    ]),
    waveYuna: social([
        '{actor} waves at me! Miu~! I wave back.',
        'Wave received from {actor}. Hi hi.',
    ]),
    boopOther: social([
        '{actor} boops {target}. Gently. This is a supervised boop.',
        'Boop! {actor} to {target}. That is the entire crime.',
        '{actor} boops {target} and immediately behaves.',
    ]),
    boopSelf: social([
        '{actor} boops themselves. Mysterious. Effective.',
        'Self-boop by {actor}. I have no notes.',
    ]),
    boopYuna: social([
        '{actor} boops me! Hey! ...Okay that was allowed and I am fine.',
        'Boop received from {actor}. My fictional nose is unharmed.',
    ]),
} as const satisfies Record<string, ResponsePool>;

export type PoolId = keyof typeof POOLS;

export function linesForMood(poolLines: ResponsePool, mood: MoodId): readonly string[] {
    const moodLines = poolLines.moods?.[mood] ?? [];
    if (moodLines.length >= 2) return moodLines;
    if (moodLines.length === 1) return [...moodLines, ...poolLines.any];
    return poolLines.any;
}

export function listTemplateTexts(): string[] {
    const texts: string[] = [];
    for (const entry of Object.values(POOLS)) {
        texts.push(...entry.any);
        if (!entry.moods) continue;
        for (const lines of Object.values(entry.moods)) {
            if (lines) texts.push(...lines);
        }
    }
    return texts;
}

export function renderPool(
    id: PoolId,
    mood: MoodId,
    vars: Readonly<Record<string, string>>,
    selector: ResponseSelector,
    memoryKey: string,
    rng: Rng,
): string {
    const line = selector.pick(memoryKey, linesForMood(POOLS[id], mood), rng);
    const filled = fillTemplate(line, vars);
    const clean = clampText(sanitizeOutgoing(filled));
    return clean || SAFE_LINE;
}
