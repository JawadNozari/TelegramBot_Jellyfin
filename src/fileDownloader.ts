import fetch, { type Response } from "node-fetch";
import progress from "progress";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prepareStorage } from "./utils/storageUtils";

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

	// Terminal progress bar
	const progressBar = new progress("Downloading [:bar] :percent :etas", {
		complete: "=",
		incomplete: " ",
		width: 20,
		total: totalBytes,
	});

	let bytesReceived = 0;
	const updateInterval = 3000; // Update progress every 3 seconds
	let lastUpdate = Date.now();

	const writer = createWriteStream(destination);
	try {
		await pipeline(
			response.body,
			new Transform({
				async transform(chunk, _encoding, callback) {
					bytesReceived += chunk.length;
					const now = Date.now();

					const progressPercent = Math.floor(
						(bytesReceived / totalBytes) * 100,
					);
					if (now - lastUpdate >= updateInterval) {
						await progressCallback(progressPercent);
						progressBar.tick(bytesReceived - progressBar.curr);
						lastUpdate = now;
					}

					callback(null, chunk);
				},
			}),
			writer,
		);

		// Final progress update
		await progressCallback(100);
		progressBar.update(1);
	} catch (error) {
		await fs.unlink(destination).catch(() => {}); // Clean up failed file
		throw new Error(
			`Error during download: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		await writer.close();
	}
}
