import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.__MONGO_SERVER_URI__ = mongoServer.getUri();
  // Guardar referencia para teardown
  global.__MONGO_SERVER__ = mongoServer;
}
