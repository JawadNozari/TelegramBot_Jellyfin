import dotenv from "dotenv";
dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const Telegram_ID = process.env.Telegram_ID;
export const TMDB_API_KEY = process.env.TMDB_API_KEY;
export const SAVE_DIRECTORY = "/Volumes/SSD/Jellyfin/";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing.");
if (!Telegram_ID) throw new Error("Telegram_ID is missing.");
