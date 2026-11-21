import { MongoClient, type Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/civicresolve";
const DB_NAME = process.env.MONGODB_DB_NAME || "civicresolve";

let cachedClient: MongoClient | null = null;
let isConnected = false;
let connectionAttempted = false;

export async function getMongoDb(): Promise<Db | null> {
  if (isConnected && cachedClient) {
    return cachedClient.db(DB_NAME);
  }

  // If already tried and failed, don't stall each request with reconnect timeouts
  if (connectionAttempted && !isConnected) {
    return null;
  }

  try {
    connectionAttempted = true;
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
    }

    await cachedClient.connect();
    isConnected = true;
    const db = cachedClient.db(DB_NAME);

    // Ensure collections and indexes exist
    await Promise.allSettled([
      db.collection("citizen_reports").createIndex({ idempotencyKey: 1 }, { unique: true }),
      db.collection("citizen_reports").createIndex({ reportId: 1 }, { unique: true }),
      db.collection("transactional_outbox").createIndex({ eventId: 1 }, { unique: true }),
      db.collection("transactional_outbox").createIndex({ status: 1, nextRetryAt: 1 }),
      db.collection("master_incidents").createIndex({ incidentId: 1 }, { unique: true }),
    ]);

    return db;
  } catch {
    isConnected = false;
    return null;
  }
}

export function isMongoDbConnected(): boolean {
  return isConnected;
}

export function getMongoDbUriInfo(): { configured: boolean; connected: boolean; uri: string } {
  return {
    configured: Boolean(process.env.MONGODB_URI),
    connected: isConnected,
    uri: process.env.MONGODB_URI ? "Configured in Environment" : "mongodb://127.0.0.1:27017/civicresolve (Default)",
  };
}
