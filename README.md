# Quest Completer V1

A Discord.js bot to manage and complete quests automatically.

## Features / Commands

| Command | Description |
|---|---|
| `/link` | Link your account so the bot can track and complete quests for you |
| `/quest` | Complete a single specific quest |
| `/questall` | Complete all available quests at once |
| `/autoquest` | Enable automatic quest completion in the background |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Your bot's token from the Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Your application's client ID |
| `TOKEN_ENCRYPTION_SECRET` | Yes | Secret used to encrypt locally stored linked tokens |
| `BOT_PREFIX` | No | Prefix for text commands (default: `!`) |

Create `.env` by copying `.env.example` into the root directory:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
BOT_PREFIX=!
TOKEN_ENCRYPTION_SECRET=replace_with_a_long_random_secret
```

## Installation

```bash
npm install
```

Then start the bot:

```bash
npm start
```

## Notes

- Make sure your bot has the required Gateway Intents enabled from the Discord Developer Portal.
- Slash commands may take a few minutes to register/update globally.

## Support
Use the project issue tracker or your local logs for troubleshooting.
