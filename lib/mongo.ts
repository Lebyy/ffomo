import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let pending: Promise<MongoClient> | null = null;

export function mongoUri() {
  return process.env.MONGODB_URI?.trim() || "";
}

export async function db(): Promise<Db | null> {
  const uri = mongoUri();
  if (!uri) return null;
  if (!client) {
    pending ??= MongoClient.connect(uri);
    client = await pending;
  }
  return client.db("ffomo");
}
