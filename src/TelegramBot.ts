import { Bot } from "grammy";
import { BOT_TOKEN, Telegram_ID } from "./config";
import { getDiskUsage } from "./utils/storageUtils";
import { handleDownload } from "./handlers/download";
import { handleCallback } from "./handlers/callback";
import { deleteSessionMessages } from "./handlers/deleteMessage";
import { sessionMiddleware, type BotContext } from "./utils/session";
import { addChat, getChats, storeMessageDetails } from "./chatStorage"; // Import storage functions
/* Initialize the bot */
if (!BOT_TOKEN) {
	throw new Error("BOT_TOKEN is not defined in the configuration.");
}
const bot = new Bot<BotContext>(BOT_TOKEN);
bot.use(sessionMiddleware);
// Function to check and store user info
const checkAndStoreChat = (
	chatId: number,
	userId: number,
	username: string,
	firstName: string,
	lastName: string,
	label: string,
) => {
	// Store chat if it doesn't exist
	const chats = getChats();
	const existingChat = chats.find((chat) => chat.chatId === chatId.toString());

	if (!existingChat) {
		addChat(chatId.toString(), userId, username, firstName, lastName, label);
		// console.log(`Chat with ID ${chatId} added to database.`);
	}
};
/* Middleware for authentication */
bot.use(async (ctx, next) => {
	if (ctx.chat && ctx.from) {
		// Ensure chat is added to the database with user info
		checkAndStoreChat(
			ctx.chat.id,
			ctx.from.id,
			ctx.from.username || "",
			ctx.from.first_name || "",
			ctx.from.last_name || "",
			"Message Sent",
		);
		// Store the message details (message content, date, etc.)
		storeMessageDetails(
			ctx.chat.id,
			ctx.from.id,
			ctx.message?.message_id ?? 0,
			ctx.message?.text ?? "No text",
			new Date(),
		);
	}
	if (ctx.from?.id !== Number(Telegram_ID)) {
		console.log(`Unauthorized access by ${ctx.from?.id}`);
		await ctx.reply("Unauthorized access.");
		return;
	}
	await next();
});

/* Command Handlers */
bot.command("d", async (ctx) => {
	if (!ctx.message) return;
	if (!ctx.session.messagesToDelete.includes(ctx.message.message_id)) {
		ctx.session.messagesToDelete.push(ctx.message.message_id);
	}
	// Add or ensure chat is in database
	if (ctx.chat && ctx.from) {
		// Add or ensure chat is in the database with user info
		checkAndStoreChat(
			ctx.chat.id,
			ctx.from.id,
			ctx.from.username || "",
			ctx.from.first_name || "",
			ctx.from.last_name || "",
			"Download Started",
		);
	}

	await handleDownload(ctx);
});
bot.command(["storage", "s", "S"], async (ctx) => {
	if (!ctx.message) return;
	if (!ctx.session.messagesToDelete.includes(ctx.message.message_id)) {
		ctx.session.messagesToDelete.push(ctx.message.message_id);
	}
	setTimeout(
		() => {
			deleteSessionMessages(ctx);
		},
		1000 * 60 * 5,
	); // Remove the message after 5 minutes

	try {
		const storageInfo = await getDiskUsage();
		await ctx.reply(storageInfo, { parse_mode: "Markdown" }).then((msg) => {
			if (!ctx.session.messagesToDelete.includes(msg.message_id)) {
				ctx.session.messagesToDelete.push(msg.message_id);
			}
		});
	} catch (error) {
		console.error("Error retrieving SSD storage info:", error);
		await ctx.reply("Error retrieving SSD storage info.");
	}
});
// Your other bot code and message handlers
bot.on("message", async (ctx) => {
	if (ctx.chat && ctx.from) {
		// Every message, we check and store the chat
		checkAndStoreChat(
			ctx.chat.id,
			ctx.from.id,
			ctx.from.username || "",
			ctx.from.first_name || "",
			ctx.from.last_name || "",
			"Message Sent",
		);
		// Store the message details (message content, date, etc.)
		storeMessageDetails(
			ctx.chat.id,
			ctx.from.id,
			ctx.message?.message_id ?? 0,
			ctx.message?.text ?? "No text",
			new Date(),
		);
	}
});
bot.on("callback_query:data", handleCallback);

// Start the bot
bot.start();
bot.catch((err) => {
	console.error("Error in bot:", err);
});
export { bot };
