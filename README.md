# Telegram Bot for jellyfin

#### This is a telegram bot for jellyfin that allows you to download files to your jellyfin server from  telegram Bot.


Create Your own telegram ID 

Telegram [Documentation](https://core.telegram.org/bots/api)

Add required environment variables to your `.env` file
```bash
BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ID=your_telegram_id
TMDB_API_KEY=themoviedb_api_key #optional

```


Using [GrammY](https://grammy.dev/) for managing telegram bot


install dependencies:

```bash
bun install
```

### Before running the bot make sure to modify your config file at `src/config.ts` 
To run in dev mode:

```bash
bun run dev
```
