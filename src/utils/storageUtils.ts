import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { stat, mkdir, access } from "node:fs/promises";

const execPromise = promisify(exec);

/**
 * Get file size from a URL using a HEAD request.
 * @param url The file download URL.
 * @returns File size in bytes or null if unavailable.
 */
export async function getFileSize(url: string): Promise<number> {
	try {
		const response = await fetch(url, { method: "HEAD" });

		// Get content-length header
		const fileSize = response.headers.get("content-length");

		if (fileSize) {
			return Number.parseInt(fileSize, 10);
		}
		console.warn("⚠️ Content-Length header missing!");
		return 0;
	} catch (error) {
		if (
			url.startsWith("https://") &&
			error instanceof Error &&
			error.message.includes("certificate has expired")
		) {
			const fallbackLink = url.replace("https://", "http://");
			return getFileSize(fallbackLink); // retry with HTTP
		}
	}
	return 0;
}
/**
 * Check if a file already exists and compare its size with the remote file.
 * @param filePath The full path where the file will be saved.
 * @param remoteSize The size of the remote file (bytes).
 * @returns Comparison result message and a boolean flag to proceed.
 */
export async function checkFileExistence(
	filePath: string,
	remoteSize: number,
	savePath: string,
): Promise<{ message: string; proceed: boolean }> {
	try {
		const stats = await fs.stat(filePath);
		// get file name from path
		const fileName = filePath.split("/").pop();
		if (stats.isDirectory()) {
			return {
				message: `⚠️ The path points to a directory instead of a file: ${filePath}.`,
				proceed: false,
			};
		}
		if (stats.isFile()) {
			const localSize = stats.size;

			if (localSize === remoteSize) {
				return {
					message: `✅ File already exists: ${fileName}\nRemote: ${(remoteSize / 1024 / 1024).toFixed(2)} MB\nLocal: ${(localSize / 1024 / 1024).toFixed(2)} MB\nSkipping download!`,
					proceed: false,
				};
			}
			return {
				message: `⚠️ File exists but size differs! Local: ${(
					localSize / 1024 / 1024
				).toFixed(2)} MB, Remote: ${(remoteSize / 1024 / 1024).toFixed(2)} MB.`,
				proceed: true,
			};
		}
	} catch (error) {
		// If the file does not exist, proceed with download
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			// Check if the directory exists
			const directoryExists = await fs
				.stat(savePath)
				.then(() => true)
				.catch(() => false); // If it throws, the directory doesn't exist

			if (!directoryExists) {
				// Create the directory if it doesn't exist
				await fs.mkdir(savePath, { recursive: true });
				return {
					message:
						"📂 Directory does not exist. Creating directory and proceeding with download.",
					proceed: true,
				};
			}
			// If directory exists, proceed to download
			return {
				message: "📂 Directory exists. Proceeding with download.",
				proceed: true,
			};
		}

		// Handle other errors (such as unexpected failures)
		console.error("❌ Error checking file existence:", error);
	}

	// Default return for any other issue
	return {
		message: "⚠️ Unknown error occurred while checking file.",
		proceed: false,
	};
}

/**
 * Ensures a directory exists and checks available storage.
 * @param dirPath The directory path where the file will be saved.
 * @param fileSize Size of the file in bytes.
 * @returns Object with status and message.
 */
export async function prepareStorage(
	dirPath: string,
	fileSize: number,
): Promise<{ success: boolean; message: string }> {
	try {
		let isDirectory = false;
		try {
			const stats = await stat(dirPath);
			isDirectory = stats.isDirectory();
		} catch {
			// Directory doesn't exist, create it
			await mkdir(dirPath, { recursive: true })
				.then(() => {
					console.log("Directory created:", dirPath);
					isDirectory = true; // We just created a directory, so it's valid
				})
				.catch((error) => {
					console.error("Error creating directory:", error);
					isDirectory = false; // We just created a directory, so it's valid
					return {
						success: false,
						message: "❌ Error creating directory.",
					};
				});
		}
		// If it's not a directory, return an error
		if (!isDirectory) {
			return {
				success: false,
				message: "⚠️ The specified path is not a directory!",
			};
		}

		// Check available storage
		const { stdout } = await execPromise(`df -k "${dirPath}"`);

		const lines = stdout.split("\n");
		const columns = lines[1]?.split(/\s+/); // Get second line (ignore headers)

		if (!columns || columns.length < 4) {
			throw new Error("Could not parse storage information.");
		}

		const availableSpaceKB = Number.parseInt(columns[3], 10);
		const availableSpaceBytes = availableSpaceKB * 1024;

		if (availableSpaceBytes < fileSize) {
			return { success: false, message: "⚠️ Not enough storage available!" };
		}

		return {
			success: true,
			message: "✅ Folder ready & enough storage available.",
		};
	} catch (error) {
		console.error("Error preparing storage:", error);
		return { success: false, message: "❌ Error preparing storage." };
	}
}

export async function getDiskUsage() {
	return new Promise<string>((resolve, reject) => {
		exec('diskutil info "/Volumes/SSD"', (error, stdout) => {
			if (error) {
				console.error("Error running diskutil:", error.message);
				return reject(error);
			}
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
