import "server-only";
import { MongoClient, type Db } from "mongodb";

export class DatabaseError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

type ConnectionState = {
  uri: string;
  promise: Promise<MongoClient>;
  indexes: Map<string, Promise<void>>;
};
const globals = globalThis as typeof globalThis & { workspacezeroMongo?: ConnectionState };

/** One pool per server process, including during development hot reloads. */
export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri.includes("<db_password>")) {
    throw new DatabaseError("CONFIG_MISSING", "Set a valid MONGODB_URI in server environment configuration.");
  }
  if (globals.workspacezeroMongo && globals.workspacezeroMongo.uri !== uri) {
    throw new DatabaseError("CONFIG_CHANGED", "Restart the server after changing database configuration.");
  }
  if (!globals.workspacezeroMongo) {
    let client: MongoClient;
    try {
      client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 15000,
        waitQueueTimeoutMS: 10000,
      });
    } catch {
      throw new DatabaseError("CONFIG_INVALID", "The database connection configuration is invalid.");
    }
    const state: ConnectionState = {
      uri,
      indexes: new Map(),
      promise: client.connect().catch(async (error: unknown) => {
        await client.close().catch(() => undefined);
        if (globals.workspacezeroMongo === state) globals.workspacezeroMongo = undefined;
        const detail = error instanceof Error ? error.message : "";
        if (/authentication|bad auth|auth failed/i.test(detail)) {
          throw new DatabaseError("AUTH_FAILED", "Database credentials were rejected.");
        }
        if (/querySrv|queryTxt|ENOTFOUND|ECONNREFUSED/i.test(detail)) {
          throw new DatabaseError("DNS_FAILED", "Database hostname resolution failed.");
        }
        if (/certificate|SSL|TLS/i.test(detail)) {
          throw new DatabaseError("TLS_FAILED", "Database TLS connection failed.");
        }
        throw new DatabaseError("CONNECTION_FAILED", "Database connection failed. Check Atlas network access and cluster availability.");
      }),
    };
    globals.workspacezeroMongo = state;
  }
  return globals.workspacezeroMongo.promise;
}

export async function getDatabase(): Promise<Db> {
  const name = process.env.MONGODB_DB?.trim();
  if (!name || /[\/\\. "$*<>:|?\u0000]/.test(name)) {
    throw new DatabaseError("CONFIG_INVALID", "Set a valid MONGODB_DB in server environment configuration.");
  }
  const db = (await getMongoClient()).db(name);
  const state = globals.workspacezeroMongo!;
  if (!state.indexes.has(name)) {
    const indexes = Promise.all([
      db.collection("widgets").createIndex({ workspaceId: 1, createdAt: 1, _id: 1 }),
      db.collection("tasks").createIndex({ workspaceId: 1, createdAt: 1, _id: 1 }),
      db.collection("widgetData").createIndex({ workspaceId: 1, widgetId: 1, key: 1 }, { unique: true }),
    ]).then(() => undefined).catch(() => {
      state.indexes.delete(name);
      throw new DatabaseError("INDEX_FAILED", "Database indexes could not be initialized. Check database-user permissions.");
    });
    state.indexes.set(name, indexes);
  }
  await state.indexes.get(name);
  return db;
}

/** Used by command-line verification, not after each HTTP request. */
export async function closeDatabase(): Promise<void> {
  const state = globals.workspacezeroMongo;
  globals.workspacezeroMongo = undefined;
  if (state) {
    const client = await state.promise.catch(() => null);
    await client?.close();
  }
}
