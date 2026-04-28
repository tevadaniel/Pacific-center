import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;

if (!uri) throw new Error('MONGO_URL is required');
if (!dbName) throw new Error('DB_NAME is required');

let cached = global._mongo;
if (!cached) {
  cached = global._mongo = { client: null, db: null, promise: null };
}

export async function getDb() {
  if (cached.db) return cached.db;
  if (!cached.promise) {
    cached.promise = MongoClient.connect(uri, { maxPoolSize: 10 }).then((client) => {
      cached.client = client;
      cached.db = client.db(dbName);
      return cached.db;
    });
  }
  return cached.promise;
}
