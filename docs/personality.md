# Personality and interactions

Yuna Miu is a fictional catgirl Discord bot. Her moods, jokes, and little bits of mischief are a presentation style. She is not a person, she does not have a private life, and she is not a substitute for real support.

Mention replies, jokes, and welcomes are scripted. A mention is never sent to a model.

Social actions such as `/hug` do not create a friendship, a relationship, or consent beyond that one command.

`/hug` pictures come from the public Ram API demo. If that call fails or the action has no Ram picture, Yuna sends a neko image from nekos.best instead and credits the artist when the API provides a name. `/image` is paced with the same cooldown as other chat commands so the demo API is not hammered.

## Commands

| Command | Who can use it | What it does |
|---|---|---|
| `/yuna hello` | Anyone | A greeting that follows the current fictional mood |
| `/yuna about` | Anyone | Who Yuna is, including that she is a bot |
| `/yuna mood` | Anyone | The current fictional mood |
| `/yuna joke` | Anyone | A short original joke |
| `/yuna compliment` | Anyone | A friendly, non-romantic compliment |
| `/yuna encourage` | Anyone | A calmer bit of encouragement |
| `/yuna interact` | Anyone | Run a social action, or list which ones are on |
| `/hug`, `/pat`, `/boop` | Anyone | Affection. The recipient can turn these off. `/hug` adds a Ram API gif |
| `/highfive`, `/cheer`, `/wave` | Anyone | Social actions that are not physical affection. These add a neko picture |
| `/image` | Anyone | A picture from the public Ram API (hug, meme, miku, and others) |
| `/neko` | Anyone | A neko picture. Ram API has no general neko list, so this uses nekos.best |
| `/yuna settings` | Manage Server | Guild switches, channels, and which actions are on |
| `/yuna preferences` | Anyone | What other people are allowed to aim at you |

`/about` is still the status card (uptime, server count). `/yuna about` is the personality.

Slash replies are paced with the server cooldown (default 30 seconds) so one person cannot spam them. Settings and preferences are not paced.

## What is on by default

| Behavior | Default |
|---|---|
| Slash commands and social actions | On |
| Mention replies | On, but nowhere until a channel is listed |
| Contextual replies (no mention) | Off |
| Welcome messages | Off |
| Welcome direct messages | Off |
| Fictional mood changes | On, and held for about 30 minutes |

An empty channel list means **nowhere**, not every channel. Add a channel with `/yuna settings channel` before Yuna will answer mentions or contextual lines. A thread is allowed when its parent channel is listed.

Contextual replies also need all of this:

- `/yuna settings set contextual:true`
- At least one channel on the contextual list
- The Message Content intent, which the bot requests by default. Set `ENABLE_MESSAGE_CONTENT_INTENT=false` only if that privileged intent is turned off in the Developer Portal. Restart after changing it.
- The default 3% chance, plus the cooldown

They use a short keyword list (a win, "good morning", a game moment). That is not an understanding of how someone feels. Serious or crisis-shaped messages are skipped. Yuna will not jump into those on her own.

If someone mentions her in a hard moment, she uses a fixed scripted reply. She will say she is a bot and point toward a person or local emergency services. She is not a counselor.

## Welcomes

`/yuna settings set welcomes:true welcome-channel:#channel`

Also set `ENABLE_GUILD_MEMBERS_INTENT=true`, enable Server Members Intent in the Developer Portal, and restart. Without that intent Discord never tells the bot that someone joined.

Welcomes are plain text unless `welcome-embed` is on. Direct messages are a separate switch and stay off. Yuna does not greet bots, and she will not greet the same member again after a duplicate join event.

The bot needs permission to view and send messages in the welcome channel. `/invite` asks for View Channel, Send Messages, and Embed Links.

## Preferences

`/yuna preferences set` is per person, per server:

- `social` — waves, cheers, high-fives, and the affection actions
- `affection` — hugs, pats, and boops only
- `mentions` — whether Yuna answers when you mention her

If someone has opted out, the command fails privately. Yuna does not announce the preference in the channel.

## What is stored

MariaDB stores:

- Guild switches, channel ids, and enabled actions
- Per-member preference toggles
- Recent welcome ids, so a duplicate join does not greet twice

It does not store message text, tokens, or API keys. Docker Compose keeps the database in the `yuna-db` volume. Set `DB_PASSWORD` and `DB_ROOT_PASSWORD` in `.env` before starting it.

An existing `DATA_DIR/settings.json` is copied in once and then renamed `settings.imported-<time>.json`. Leave `DB_HOST` empty to keep using that file instead. Welcome ids older than a week are dropped.

## Limits

- Mention replies need the Guild Messages intent, which the bot requests. Message content is a separate privileged intent and is only needed for contextual replies.
- Keyword matches will miss jokes, sarcasm, and anything phrased in an unexpected way.
- Moods are labels for wording. Turning mood variation off keeps the Happy style.
- Yuna will not ping `@everyone`, `@here`, or roles from these replies.
- She ignores other bots, webhooks, and mentions that only appear inside code blocks or quotes.
