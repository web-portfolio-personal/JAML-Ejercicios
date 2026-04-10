import mongoose from 'mongoose';
import httpServer from '../../src/app.js';

export const startServer = () =>
  new Promise((resolve) => {
    const server = httpServer.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://localhost:${port}` });
    });
  });

export const stopServer = async (server) => {
  await new Promise((res) => server.close(res));
  await mongoose.disconnect();
};

export const connectTestDB = async () => {
  const uri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
};
