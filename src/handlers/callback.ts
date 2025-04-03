import * as path from "node:path";
import { getFileSize, checkFileExistence } from "../utils/storageUtils";
import { Downloader } from "../fileDownloader";
import type { BotContext } from "../utils/session";
import { SAVE_DIRECTORY } from "../config";
import { bot } from "../telegramBot";

export async function handleCallback(ctx: BotContext) {
	const category = ctx.session.category;
	const link = ctx.session.downloadLink;
	const filename = ctx.session.filename;

	if (!ctx.chat) return ctx.answerCallbackQuery("Error: No chat ID found.");
	if (!link) return ctx.answerCallbackQuery("No download link found!");
	if (!filename) return ctx.answerCallbackQuery("No filename detected!");
	if (!category) return ctx.answerCallbackQuery("No category detected!");

	const fetchedCategory = ctx.session.category?.Movie ? "Movies" : "Shows";
	const name = ctx.session.title || path.parse(filename).name;
	let savePath = path.join(SAVE_DIRECTORY, fetchedCategory, name);

	if (category.Show) {
		savePath = path.join(
			SAVE_DIRECTORY,
			fetchedCategory,
			name,
			`S${ctx.session.season?.toString().slice(-2)}`,
		);
	}

	const remoteSize = await getFileSize(link);
	if (!remoteSize) await ctx.reply("⚠️ Unable to determine file size.");
	else
		await ctx.reply(`📦 File Size: ${(remoteSize / 1024 ** 3).toFixed(2)} GB`);

	const possibleFilePath = path.join(savePath, filename);
	const checkFileExist = await checkFileExistence(
		possibleFilePath,
		remoteSize,
		savePath,
	);
	await ctx.reply(checkFileExist.message);

	if (!checkFileExist.proceed) return;

	await ctx.answerCallbackQuery(
		`Downloading as ${fetchedCategory.toUpperCase()}...`,
	);
	await ctx.editMessageText(`Downloading file...\nSaving to ${savePath}`);
	// Send progress updates to the user via progressCallback
	const progressMessage = await bot.api.sendMessage(
		ctx.chat.id,
		"Downloading... 0%",
	);

	const progressCallback = async (progress: number) => {
		if (!ctx.chat) {
			// If ctx.chat is undefined, we simply return and don't attempt to send the update
			console.warn("No chat context found.");
			return;
		}
		try {
			await bot.api.editMessageText(
				ctx.chat.id,
				progressMessage.message_id,
				`Downloading... ${progress}%`,
			);
		} catch {
			// Ignore errors if the message is deleted
		}
	};

	// Start the download process
	setImmediate(() => {
		void Downloader(link, savePath, remoteSize, progressCallback)
			.then(() => ctx.reply(`✅ Download complete! Saved as ${filename}.`))
			.catch((err) => ctx.reply(`❌ Download failed: ${err.message}`));
	});
}
