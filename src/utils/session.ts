import type { Context } from "grammy";
import { session, type SessionFlavor } from "grammy";

// Define session data
interface SessionData {
	downloadLink?: string[];
	filename?: string;
	title?: string;
	category?: { Movie: boolean; Show: boolean };
	year?: number;
	season?: number;
	messagesToDelete: number[];
}

export type BotContext = Context & SessionFlavor<SessionData>;

function initial(): SessionData {
	return {
		downloadLink: [],
		title: "",
		category: { Movie: false, Show: false },
		year: 0,
		season: 0,
		messagesToDelete: [],
	};
}

export const sessionMiddleware = session({ initial });
