import type { BotContext } from "../utils/session";
import { InlineKeyboardMarkup } from "../customKeyboards";
export async function handleDownload(ctx: BotContext) {
	const text = ctx.message?.text || "";
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	// Remove the "/d" from the first line if it contains the command
	const links = lines
		.map((line, i) => (i === 0 ? line.replace(/^\/d\s*/, "") : line))
		.filter((line) => line.startsWith("http"));

	if (links.length === 0) {
		return ctx.reply("❌ No valid download links found.");
	}

	ctx.session.downloadLink = links;
	await ctx
		.reply(`Detected: ${links.length}link(s)\n\n Start download?`, {
			reply_markup: InlineKeyboardMarkup(),
		})
		.then((msg) => {
			if (!ctx.session.messagesToDelete.includes(msg.message_id)) {
				ctx.session.messagesToDelete.push(msg.message_id);
			}
		});
}
