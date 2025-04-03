import { exec } from "node:child_process";
import { Bot } from "grammy";
import dotenv from "dotenv";

dotenv.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const Telegram_ID = process.env.Telegram_ID;

if (!BOT_TOKEN) {
	throw new Error("BOT_TOKEN is not defined in the environment variables.");
}
const bot = new Bot(BOT_TOKEN);

async function getDiskUsage() {
	return new Promise<string>((resolve, reject) => {
		exec('diskutil info "/Volumes/SSD"', (error, stdout) => {
			if (error) {
				console.error("Error running diskutil:", error.message);
				return reject(error);
			}

			console.log("DISKUTIL OUTPUT:\n", stdout); // Debugging

			const totalMatch = stdout.match(/Volume Total Space:\s+([\d,.]+) GB/);
			const usedMatch = stdout.match(/Volume Used Space:\s+([\d,.]+) GB/);
			const freeMatch = stdout.match(/Volume Free Space:\s+([\d,.]+) GB/);

			if (!totalMatch || !usedMatch || !freeMatch) {
				console.error("Could not parse diskutil output:", stdout);
				return reject(new Error("Could not parse disk usage info."));
			}

			const total = `${totalMatch[1]} GB`;
			const used = `${usedMatch[1]} GB`;
			const free = `${freeMatch[1]} GB`;

			resolve(
				`💾 *SSD Storage Info:*\n📦 Total: ${total}\n🔴 Used: ${used}\n🟢 Free: ${free}`,
			);
		});
	});
}

bot.use(async (ctx, next) => {
	if (ctx.from?.id !== Telegram_ID) {
		console.log(`Unauthorized access attempt by ${ctx.from?.id}`);
		console.log("userName: ", ctx.from?.username);
		console.log("userFirstName: ", ctx.from?.first_name);
		console.log("userLastName: ", ctx.from?.last_name);
		await ctx.reply("Unauthorized access attempt.");
		return; // Ignore unauthorized users
	}
	await next(); // Allow only you to proceed
});
bot.command("storage", async (ctx) => {
	try {
		const storageInfo = await getDiskUsage();
		await ctx.reply(storageInfo, { parse_mode: "Markdown" });
	} catch (error) {
		console.error("Error retrieving SSD storage info:", error);
		await ctx.reply("Error retrieving SSD storage info.");
	}
});
// Start the bot
bot.start();
