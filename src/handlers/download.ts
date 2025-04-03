import * as path from "node:path";
import { extractMediaInfo } from "../utils/movieAPI";
import type { BotContext } from "../utils/session";
import { InlineKeyboardMarkup } from "../customKeyboards";

export async function handleDownload(ctx: BotContext) {
	const parts = ctx.message?.text?.split(" ") || [];
	if (parts.length < 2) return ctx.reply("Usage: /d <link>");

	const link = parts[1];
	const urlParts = new URL(link);
	const filename = decodeURIComponent(path.basename(urlParts.pathname));

	ctx.session.filename = filename;
	ctx.session.downloadLink = link;
	ctx.session.fileExtension = path.extname(filename);

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
		await ctx.reply(
			`Is this a Movie or a Show?\n\nFile: ${ctx.session.filename}`,
			{ reply_markup: InlineKeyboardMarkup() },
		);
	}

	await ctx.reply(
		`Detected: ${(ctx.session.category?.Movie ?? false) ? "Movie" : "Show"}\n\nConfirm download?`,
		{ reply_markup: InlineKeyboardMarkup() },
	);
}
