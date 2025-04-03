import { session, type SessionFlavor } from "grammy";
import type { Context } from "grammy";

// Define session data
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

export type BotContext = Context & SessionFlavor<SessionData>;

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

export const sessionMiddleware = session({ initial });
