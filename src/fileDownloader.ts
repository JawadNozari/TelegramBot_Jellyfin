import fetch, { type Response } from "node-fetch";
import progress from "progress";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises"; // Use the promise-based version
import type { BotContext } from "./telegramBot";
import type { Bot } from "grammy";
import { prepareStorage } from "./storageUtils";
export async function Downloader(
	url: string,
	filePath: string,
	remoteSize: number,
	chatId: number,
	botInstance: Bot<BotContext>,
): Promise<void> {
	const prepareStorageResult = await prepareStorage(filePath, remoteSize);
	const filenameURI = decodeURIComponent(path.basename(url));
	if (!prepareStorageResult) {
		console.warn("Skipping download as storage preparation failed.");
		return;
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 60000); // 1-minute timeout
	try {
		let response: Response;
		try {
			response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeout);
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
		} catch (error) {
			await botInstance.api.sendMessage(
				chatId,
				`Error: Failed to fetch URL. ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}

		if (!response.ok) {
			const errorMessage = `Error: HTTP error! status: ${response.status}, text: ${await response.text()}`;
			await botInstance.api.sendMessage(chatId, errorMessage);
			console.debug(errorMessage);
			return;
		}

		const totalBytes = Number.parseInt(
			response.headers.get("content-length") || "0",
			10,
		);

		if (totalBytes <= 0 || Number.isNaN(totalBytes)) {
			await botInstance.api.sendMessage(
				chatId,
				"Error: Invalid file size detected.",
			);
			console.debug("Invalid file size");
			return;
		}
		const progressMessage = await botInstance.api.sendMessage(
			chatId,
			"Downloading... 0%",
		);
		// Initialize progress bar
		const progressBar = new progress("Downloading [:bar] :percent :etas", {
			complete: "=",
			incomplete: " ",
			width: 20,
			total: totalBytes,
		});

		let bytesReceived = 0;
		const updateInterval = 3000; // Update progress every 5 seconds for telegram
		const updateintervalProgressBar = 1000; // Update progress every 1 second for progress bar (Terminal)
		let lastUpdate = Date.now();
		// biome-ignore lint: <explanation>
		let lastUpdateTerminal = Date.now();
		if (!response.body) {
			await botInstance.api.sendMessage(
				chatId,
				"Error: Response body is null.",
			);
			console.debug("Response body is null");
			return;
		}
		const DownloadPath = path.join(filePath, filenameURI);
		const writer = createWriteStream(DownloadPath);
		try {
			// Stream the response body directly into the file
			await pipeline(
				response.body,
				new Transform({
					transform(chunk, _encoding, callback) {
						bytesReceived += chunk.length;
						const now = Date.now();
						const progressPercent = Math.floor(
							(bytesReceived / totalBytes) * 100,
						);
						if (now - lastUpdate >= updateintervalProgressBar) {
							progressBar.tick(bytesReceived - progressBar.curr);
							lastUpdateTerminal = now;
						}
						if (now - lastUpdate >= updateInterval) {
							botInstance.api
								.editMessageText(
									chatId,
									progressMessage.message_id,
									`Downloading... ${progressPercent}%`,
								)
								.catch(() => {}); // Ignore errors if the message cannot be updated

							lastUpdate = now;
						}
						callback(null, chunk);
					},
				}),
				writer,
			);
			// Final update to 100%
			await botInstance.api.editMessageText(
				chatId,
				progressMessage.message_id,
				"Download complete!",
			);
			progressBar.update(1);
		} catch (error) {
			await botInstance.api.sendMessage(
				chatId,
				`Error during download: ${error instanceof Error ? error.message : String(error)}`,
			);
			await fs.unlink(DownloadPath); // Delete incomplete file
			throw error;
		} finally {
			await writer.close();
		}

		console.log("Download complete:", DownloadPath);
	} catch (error) {
		console.error("Download failed:", error);
		await botInstance.api.sendMessage(
			chatId,
			`${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		clearTimeout(timeout);
	}
}
