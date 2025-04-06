import pLimit from "p-limit";
import * as path from "node:path";
import { bot } from "../telegramBot";
import { SAVE_DIRECTORY } from "../config";
import { Downloader } from "../fileDownloader";
import type { BotContext } from "../utils/session";
import { extractMediaInfo } from "../utils/movieAPI";
import { deleteSessionMessages } from "./deleteMessage";
import { getFileSize, checkFileExistence } from "../utils/storageUtils";

const limit = pLimit(3);

export async function handleCallback(ctx: BotContext) {
	if (!ctx.chat || !ctx.session.downloadLink) {
		return ctx.answerCallbackQuery("Missing download link or chat ID.");
	}

	const links = ctx.session.downloadLink.map((l) => l.trim()).filter(Boolean);

	await ctx
		.reply(`Found ${links.length} link(s), starting download queue...`)
		.then((msg) => {
			if (!ctx.session.messagesToDelete.includes(msg.message_id)) {
				ctx.session.messagesToDelete.push(msg.message_id);
			}
		});

	const downloadTasks = links.map((link) =>
		limit(async () => {
			const urlParts = new URL(link);
			const filename = decodeURIComponent(path.basename(urlParts.pathname));
			// const fileExt = path.extname(filename);
			const { show, movie } = await extractMediaInfo(filename);

			const category = { Movie: false, Show: false };
			let title: string | undefined;
			let season: number | undefined;

			if (movie) {
				category.Movie = true;
				title = movie.title;
			} else if (show) {
				category.Show = true;
				title = show.title;
				season = show.season;
			} else {
				await ctx.reply(`Unknown media type for file: ${filename}`);
				return;
			}

			const fetchedCategory = category.Movie ? "Movies" : "Shows";
			let savePath = path.join(
				SAVE_DIRECTORY,
				fetchedCategory,
				title || filename,
			);
			if (category.Show && season) {
				savePath = path.join(
					savePath,
					`S${season.toString().padStart(2, "0")}`,
				);
			}

			const remoteSize = await getFileSize(link);
			if (!remoteSize) {
				await ctx.reply(`⚠️ Could not determine size for ${filename}`);
				return;
			}
			const messageToUser = await ctx.reply(
				`📦 ${filename} - ${(remoteSize / 1024 ** 3).toFixed(2)} GB`,
			);

			const check = await checkFileExistence(
				path.join(savePath, filename),
				remoteSize,
				savePath,
			);
			if (!ctx.chat) {
				return;
			}
			await bot.api.editMessageText(
				ctx.chat.id,
				messageToUser.message_id,
				`${check.message}`,
			);

			if (!check.proceed) return;
			await bot.api.editMessageText(
				ctx.chat.id,
				messageToUser.message_id,
				`Downloading ${title}...`,
			);
			await Downloader(link, savePath, remoteSize, async (percent) => {
				if (!ctx.chat) {
					return;
				}
				try {
					const bar = formatProgressBar(percent);
					await bot.api.editMessageText(
						ctx.chat.id,
						messageToUser.message_id,
						`Downloading ${category.Movie ? "Movie" : "Show"}: ${title} ${season ? `S${season.toString().padStart(2, "0")} E${show?.episode.toString().padStart(2, "0")}` : `${movie?.year}`} \n\nProgress: ${bar}`,
					);
				} catch {}
			});

			await bot.api.editMessageText(
				ctx.chat.id,
				messageToUser.message_id,
				`✅ Finished downloading ${category.Movie ? "Movie" : "Show"}: ${title} ${season ? `S${season.toString().padStart(2, "0")} E${show?.episode}` : `${movie?.year}`}`,
			);
		}),
	);

	await Promise.all(downloadTasks);
	await deleteSessionMessages(ctx);
	await ctx.reply("🎉 All downloads complete!");
}
function formatProgressBar(percent: number, barLength = 10): string {
	// Ensure that percent is within the valid range
	const validPercent = Math.max(0, Math.min(100, percent));
	const filledLength = Math.round((validPercent / 100) * barLength);
	const emptyLength = barLength - filledLength;
	const bar = `[${"█".repeat(filledLength)}${"░".repeat(emptyLength)}]`;
	return `${bar} ${validPercent}%`;
}
