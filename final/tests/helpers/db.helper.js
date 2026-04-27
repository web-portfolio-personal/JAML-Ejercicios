import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

/**
 * Arranca una instancia de MongoDB en memoria y conecta Mongoose.
 */
export const connectTestDb = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
};

/**
 * Limpia todas las colecciones entre tests.
 */
export const clearDb = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Cierra la conexión y para el servidor de MongoDB en memoria.
 */
export const disconnectTestDb = async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};
