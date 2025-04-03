import dotenv from "dotenv";
import * as path from "node:path";
import { extractMediaInfo } from "./movieAPI";
import { Downloader } from "./fileDownloader";
import { InlineKeyboardMarkup } from "./Keyboards";
import { Bot, session, type SessionFlavor, type Context } from "grammy";
import {
	getFileSize,
	checkFileExistence,
	prepareStorage,
} from "./storageUtils";

/* CONFIG */
dotenv.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const Telegram_ID = process.env.Telegram_ID;
const SAVE_DIRECTORY = "/Volumes/SSD/Jellyfin/"; // Default save directory on the server

/* MAKE SURE BOT_TOKEN IS DEFINED */
if (!BOT_TOKEN) {
	throw new Error("BOT_TOKEN is not defined in the environment variables.");
}
if (!Telegram_ID) {
	throw new Error("Telegram_ID is not defined in the environment variables.");
}
/* Session Data Type */
interface SessionData {
	downloadLink?: string;
	filename?: string;
	title?: string;
	category?: { Movie: boolean; Show: boolean };
	year?: number;
	season?: number;
	episode?: number;
	fileExtension?: string;
}
// Flavor the context type to include sessions.
export type BotContext = Context & SessionFlavor<SessionData>;

/* Initialize the bot */
const bot = new Bot<BotContext>(BOT_TOKEN);

// Install session middleware, and define the initial session value.
function initial(): SessionData {
	return {
		downloadLink: "",
		filename: "",
		title: "",
		category: { Movie: false, Show: false },
		year: 0,
		season: 0,
		episode: 0,
		fileExtension: "",
	};
}
bot.use(session({ initial }));
bot.use(async (ctx, next) => {
	if (ctx.from?.id !== Number(Telegram_ID)) {
		console.log(`Unauthorized access attempt by ${ctx.from?.id}`);
		console.log("userName: ", ctx.from?.username);
		console.log("userFirstName: ", ctx.from?.first_name);
		console.log("userLastName: ", ctx.from?.last_name);
		await ctx.reply("Unauthorized access attempt.");
		return; // Ignore unauthorized users
	}
	await next(); // Allow only you to proceed
});
// Command handler for /download
bot.command("d", async (ctx) => {
	const parts = ctx.message?.text?.split(" ") || [];
	if (parts.length < 2) {
		return ctx.reply("Usage: /download <link>");
	}
	const link = parts[1];
	const urlParts = new URL(link);
	const filename = decodeURIComponent(path.basename(urlParts.pathname));
	ctx.session.filename = filename; // Store filename in session
	ctx.session.downloadLink = link.toString();
	ctx.session.fileExtension = path.extname(filename);
	// Automatically determine if it's a Movie or a Show
	const { show, movie } = await extractMediaInfo(filename);
	if (movie) {
		ctx.session.category = { Movie: true, Show: false };
		ctx.session.title = movie.title;
		ctx.session.year = movie.year;
	} else if (show) {
		ctx.session.category = { Movie: false, Show: true };
		ctx.session.title = show.title;
		ctx.session.season = show.season;
		ctx.session.episode = show.episode;
	} else {
		console.warn("Could not determine media type from filename.");
		await ctx.reply(
			`Unable to determine media type from filename.\nIs this a Movie or a Show?\n\nFile: ${ctx.session.filename}`,
			{
				reply_markup: InlineKeyboardMarkup(),
			},
		);
	}

	await ctx.reply(
		`Detected: ${ctx.session.category?.Movie ? "Movie" : "Show"}\n\nConfirm download?\n\nFile: ${ctx.session.filename}`,
		{
			reply_markup: InlineKeyboardMarkup(),
		},
	);
});

bot.on("callback_query:data", async (ctx) => {
	const category = ctx.session.category; // movie or show
	const link = ctx.session.downloadLink;
	const filename = ctx.session.filename;
	if (!ctx.chat) {
		return ctx.answerCallbackQuery("Error: Unable to determine chat ID.");
	}
	if (!link)
		return ctx.answerCallbackQuery({ text: "No download link found!" });

	if (!filename) {
		return ctx.answerCallbackQuery("Unable to determine file name.");
	}
	if (!category) {
		return ctx.answerCallbackQuery("Unable to determine category.");
	}
	const fetchedCategory = ctx.session.category?.Movie ? "Movies" : "Shows";
	const name = ctx.session.title || path.parse(filename).name;
	let savePath = path.join(SAVE_DIRECTORY, fetchedCategory, name);

	if (category.Show === true) {
		savePath = path.join(
			SAVE_DIRECTORY,
			fetchedCategory,
			name,
			`S${ctx.session.season?.toString().slice(-2)}`,
		);
	}
	// Get file size
	const remoteSize = await getFileSize(link);

	if (!remoteSize) {
		await ctx.reply("⚠️ Unable to determine file size! Proceed with caution.");
	} else {
		await ctx.reply(`📦 File Size: ${(remoteSize / 1024 ** 3).toFixed(2)} GB`);
	}

	// 📂 Check if file exists and compare size
	const possibleFilePath = path.join(savePath, filename);
	const checkFileExist = await checkFileExistence(
		possibleFilePath,
		remoteSize,
		savePath,
	);
	await ctx.reply(checkFileExist.message);

	if (!checkFileExist.proceed) {
		console.warn("Skipping download as file already exists.");
		return;
	}

	// Notify user
	await ctx.answerCallbackQuery(
		`Downloading as ${fetchedCategory.toUpperCase()}...`,
	);
	await ctx.editMessageText(
		`Downloading file from ${link}...\nSaving to ${savePath}`,
	);

	setImmediate(() => {
		if (ctx.chat) {
			void Downloader(link, savePath, remoteSize, ctx.chat.id, bot)
				.then(() => ctx.reply(`Download complete! Saved as ${filename}.`))
				.catch((err) => ctx.reply(`Download failed: ${err.message}`));
		} else {
			console.error("Chat context is undefined.");
			void ctx.reply("Error: Unable to determine chat context.");
		}
	});
});

// Start the bot
bot.start();
bot.catch((err) => {
	console.error("Error in bot:", err);
});
