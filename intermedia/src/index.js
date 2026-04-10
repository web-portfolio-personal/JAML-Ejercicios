import app from './app.js';
import { dbConnect, env } from './config/index.js';

const start = async () => {
  await dbConnect();
  app.listen(env.PORT, () => {
    console.log(`🚀 BildyApp API en http://localhost:${env.PORT}`);
    console.log(`   Entorno: ${env.NODE_ENV}`);
  });
};

start();
