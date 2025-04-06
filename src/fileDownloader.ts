import * as path from "node:path";
import logUpdate from "log-update";
import * as fs from "node:fs/promises";
import { Transform } from "node:stream";
import { createWriteStream } from "node:fs";
import progressStream from "progress-stream";
import { pipeline } from "node:stream/promises";
import fetch, { type Response } from "node-fetch";
import { prepareStorage } from "./utils/storageUtils";
const activeDownloads: Record<string, string> = {};
/**
 * Downloads a file and saves it to the specified path.
 * @param {string} url - The file URL to download.
 * @param {string} filePath - The local directory where the file should be saved.
 * @param {number} remoteSize - The expected file size in bytes.
 * @param {(progress: number) => Promise<void>} progressCallback - Function to report progress.
 * @returns {Promise<string>} - Returns the full path of the downloaded file on success.
 * @throws {Error} - Throws an error if the download fails.
 */
export async function Downloader(
	url: string,
	filePath: string,
	remoteSize: number,
	progressCallback: (progress: number) => Promise<void>,
): Promise<string> {
	// Prepare storage
	const storageReady = await prepareStorage(filePath, remoteSize);
	if (!storageReady) {
		throw new Error("Storage preparation failed. Not enough space?");
	}

	// Fetch the file
	const response = await fetchFile(url);

	// Determine full file path
	const filename = decodeURIComponent(path.basename(url));
	const fullFilePath = path.join(filePath, filename);

	// Stream file to disk with progress updates
	await streamToFile(response, fullFilePath, progressCallback);

	console.log("✅ Download complete:", fullFilePath);
	return fullFilePath;
}

/**
 * Fetches a file from a given URL.
 * @param {string} url - The file URL.
 * @returns {Promise<Response>} - The response object containing the file stream.
 * @throws {Error} - Throws an error if the request fails.
 */
async function fetchFile(url: string): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 60000); // 1-minute timeout

	try {
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
		return response;
	} catch (error) {
		if (
			url.startsWith("https://") &&
			error instanceof Error &&
			error.message.includes("certificate has expired")
		) {
			const fallbackLink = url.replace("https://", "http://");
			return fetchFile(fallbackLink); // retry with HTTP
		}
		clearTimeout(timeout);
		throw new Error(
			`Failed to fetch file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Streams the response body to a file and reports progress.
 * @param {Response} response - The response object containing the file stream.
 * @param {string} destination - The full path where the file should be saved.
 * @param {(progress: number) => Promise<void>} progressCallback - Function to report progress.
 * @returns {Promise<void>}
 * @throws {Error} - Throws an error if writing fails.
 */
async function streamToFile(
	response: Response,
	destination: string,
	progressCallback: (progress: number) => Promise<void>,
): Promise<void> {
	if (!response.body) {
		throw new Error("Response body is null.");
	}

	const totalBytes = Number.parseInt(
		response.headers.get("content-length") || "0",
		10,
	);
	if (totalBytes <= 0 || Number.isNaN(totalBytes)) {
		throw new Error("Invalid file size detected.");
	}
	const progress = progressStream({
		length: totalBytes,
		time: 1000, // update every second
	});
	const throttledTelegramUpdate = throttle(progressCallback, 3000);
	const throttledLogUpdate = throttle(() => {
		logUpdate(Object.values(activeDownloads).join("\n"));
	}, 1000);

	// Terminal progress bar
	progress.on("progress", (prog) => {
		const percent = Math.round(prog.percentage);
		activeDownloads[destination] =
			`⬇️ ${path.basename(destination)} [${"█".repeat(percent / 5).padEnd(20)}] ${percent}%`;
		throttledTelegramUpdate(percent); // Send progress update to Telegram
		logUpdate(Object.values(activeDownloads).join("\n"));
		// console.log(
		// 	`[${path.basename(destination)}] Memory usage:`,
		// 	Math.round(process.memoryUsage().rss / 1024 / 1024),
		// 	"MB",
		// );
	});

	const writer = createWriteStream(destination);
	try {
		await pipeline(response.body, progress, writer);
		// Final progress update when done
		await progressCallback(100); // Send final progress update to Telegram (100%)
		activeDownloads[destination] =
			`✅ ${path.basename(destination)} [████████████████████] 100%`;
		throttledLogUpdate(); // Final log update
		delete activeDownloads[destination]; // Clean up
		// Optionally, wait for a moment before clearing terminal updates (for a smooth finish)
		await new Promise((resolve) => setTimeout(resolve, 1000));
		logUpdate.clear();
	} catch (error) {
		await fs.unlink(destination).catch(() => {}); // Clean up failed file
		throw new Error(
			`Error during download: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		await writer.close();
		await progress.end();
		progress.removeAllListeners();
		delete activeDownloads[destination];
		logUpdate(Object.values(activeDownloads).join("\n"));
	}
}
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const throttle = (fn: (...args: any[]) => void, delay: number) => {
	let lastCall = 0;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return (...args: any[]) => {
		const now = Date.now();
		if (now - lastCall >= delay) {
			lastCall = now;
			fn(...args);
		}
	};
};
