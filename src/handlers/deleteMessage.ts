import type { BotContext } from "../utils/session";

export async function deleteSessionMessages(ctx: BotContext) {
	const chatId = ctx.chat?.id;
	if (!chatId || !ctx.session.messagesToDelete) return;

	for (const msgId of ctx.session.messagesToDelete) {
		// setTimeout to avoid rate limits
		await new Promise((resolve) => setTimeout(resolve, 450));
		try {
			await ctx.api.deleteMessage(chatId, msgId);
		} catch {
			// maybe message already deleted or expired
		}
	}

	ctx.session.messagesToDelete = []; // Clear after deletion
}
