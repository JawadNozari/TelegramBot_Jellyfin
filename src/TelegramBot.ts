import dotenv from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Downloader } from "./fileDownloader";
import { InlineKeyboardMarkup } from "./inlineKeyboard";
import { Bot, session, type SessionFlavor, type Context } from "grammy";
import { extractMediaInfo } from "./movieAPI";
/* CONFIG */
dotenv.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const SAVE_DIRECTORY = "/Volumes/SSD/Jellyfin/"; // Default save directory on the server

/* MAKE SURE BOT_TOKEN IS DEFINED */
if (!BOT_TOKEN) {
	throw new Error("BOT_TOKEN is not defined in the environment variables.");
}
/* Session Data Type */
interface SessionData {
	downloadLink?: string;
	filename?: string;
}
// Flavor the context type to include sessions.
export type BotContext = Context & SessionFlavor<SessionData>;

/* Initialize the bot */
const bot = new Bot<BotContext>(BOT_TOKEN);

// Install session middleware, and define the initial session value.
function initial(): SessionData {
	return { downloadLink: "", filename: "" };
}
bot.use(session({ initial }));

// Command handler for /download
bot.command("download", async (ctx) => {
	const parts = ctx.message?.text?.split(" ") || [];
	if (parts.length < 2) {
		return ctx.reply("Usage: /download <link>");
	}
	const link = parts[1];
	const urlParts = new URL(link);

	ctx.session.filename = await decodeURIComponent(
		path.basename(urlParts.pathname),
	);
	ctx.session.downloadLink = await link.toString(); // Store link in session

	// Ask the user to choose
	await ctx.reply(
		`Is this a Movie or a Show?\n\nFile: ${ctx.session.filename}`,
		{
			reply_markup: InlineKeyboardMarkup(),
		},
	);

	// Handle button clicks
});

bot.on("callback_query:data", async (ctx) => {
	const category = ctx.callbackQuery.data; // movie or show
	const link = ctx.session.downloadLink;
	const filename = ctx.session.filename;
	console.log(await ctx.session);
	if (!ctx.chat) {
		return ctx.answerCallbackQuery("Error: Unable to determine chat ID.");
	}
	if (!link)
		return ctx.answerCallbackQuery({ text: "No download link found!" });

	if (!filename) {
		return ctx.answerCallbackQuery("Unable to determine file name.");
	}

	const { name } = path.parse(filename);
	const savePath = path.join(SAVE_DIRECTORY, category, name);
	await ctx.answerCallbackQuery({ text: `Downloading as:\n\n ${category}` });
	// Ensure directory exists
	const mkdirResult = await fs
		.mkdir(savePath, { recursive: true })
		.catch((error) => {
			console.error("Error creating folder:", error);
			return null;
		});
	if (!mkdirResult) {
		return ctx.answerCallbackQuery("Error creating folder.");
	}
	console.debug(`Folder created (or already exists): ${savePath}`);
	// Set final file path
	const filePath = path.join(savePath, filename);

	// Notify user
	await ctx.answerCallbackQuery(`Downloading as ${category.toUpperCase()}...`);
	await ctx.editMessageText(
		`Downloading file from ${link}...\nSaving to ${filePath}`,
	);

	try {
		await Downloader(link, filePath, ctx.chat.id, bot);
		await ctx.reply(`Download complete! Saved as ${filename} on the server.`);
	} catch (error: unknown) {
		// downloadFile already sends error message.
		console.error("Download failed:", error);
		await ctx.reply("Download failed!");
	}
});
// Start the bot
bot.start();
bot.catch((err) => {
	console.error("Error in bot:", err);
});
