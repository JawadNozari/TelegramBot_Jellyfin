import { Database } from "bun:sqlite";

// Initialize SQLite database
const db = new Database("./chatStorage.db");

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS chats (
    chatId TEXT PRIMARY KEY,
    username TEXT,
    firstName TEXT,
    lastName TEXT,
    userId INTEGER,
    label TEXT
  )
`);
// Create table if not exists for storing messages
db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT,
      userId INTEGER,
      messageId INTEGER,
      messageContent TEXT,
      timestamp TEXT
    )
  `);
// Function to add or update a chat with user details
export function addChat(
	chatId: string,
	userId: number,
	username: string,
	firstName: string,
	lastName: string,
	label: string,
) {
	// Check if the chat already exists
	const chat = db.prepare("SELECT * FROM chats WHERE chatId = ?").get(chatId);

	if (chat) {
		// Update chat with new info (you can modify the label or any field)
		db.prepare(`
        UPDATE chats 
        SET username = ?, firstName = ?, lastName = ?, userId = ?, label = ?
        WHERE chatId = ?
      `).run(username, firstName, lastName, userId, label, chatId);
	} else {
		// Insert a new chat with user details
		db.prepare(`
        INSERT INTO chats (chatId, username, firstName, lastName, userId, label)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(chatId, username, firstName, lastName, userId, label);
	}
}

// Function to store message details in the database
export function storeMessageDetails(
	chatId: number,
	userId: number,
	messageId: number,
	messageContent: string,
	timestamp: Date,
) {
	// Insert message into the messages table
	db.prepare(`
      INSERT INTO messages (chatId, userId,messageId, messageContent, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(chatId, userId, messageId, messageContent, timestamp.toISOString());

	// console.log(`Message stored for chat ${chatId}: ${messageContent}`);
}

// Remove a chat from the database
export function removeChat(chatId: string): void {
	const stmt = db.prepare("DELETE FROM chats WHERE chatId = ?");
	stmt.run(chatId);
}

// Retrieve all stored chats
export function getChats(): Array<{ chatId: string; label: string }> {
	const result = db.query("SELECT * FROM chats");
	return result.all() as Array<{ chatId: string; label: string }>;
}
