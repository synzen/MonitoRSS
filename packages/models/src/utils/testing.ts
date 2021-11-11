import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;
let client: MongoClient;

export async function setupTests() {
  mongod = await MongoMemoryServer.create();
  const uri = await mongod.getUri();

  client = await MongoClient.connect(uri);
  
  return client.db();
}

export async function teardownTests() {
  await client.close();
  await mongod?.stop();
}
