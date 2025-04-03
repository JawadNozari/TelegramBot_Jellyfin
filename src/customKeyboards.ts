import { InlineKeyboard } from "grammy";
export const InlineKeyboardMarkup = () => {
	return new InlineKeyboard()
		.text("🎬 Movie", "Movies")
		.text("📺 Show", "Shows")
		.row()
		.text("✅ Confirm", "Confirm");
};
