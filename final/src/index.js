import { httpServer } from './app.js';
import { dbConnect, env } from './config/index.js';
import mongoose from 'mongoose';

const start = async () => {
  // Arrancar servidor primero — health check responde desde el primer momento
  const server = httpServer.listen(env.PORT, () => {
    console.log(`🚀 BildyApp API en http://localhost:${env.PORT}`);
    console.log(`📚 Docs en http://localhost:${env.PORT}/api-docs`);
    console.log(`   Entorno: ${env.NODE_ENV}`);
  });

  // Conectar a MongoDB (lazy — no bloquea el arranque)
  try {
    await dbConnect();
  } catch (err) {
    console.error('⚠️  BD no disponible al arrancar:', err.message);
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} recibido. Cerrando servidor...`);

    server.close(async () => {
      console.log('🔌 Servidor HTTP cerrado');
      try {
        await mongoose.connection.close();
        console.log('🗄️  MongoDB desconectado');
      } catch (err) {
        console.error('Error cerrando MongoDB:', err.message);
      }
      process.exit(0);
    });

    // Forzar cierre tras 10 segundos
    setTimeout(() => {
      console.error('⚠️  Forzando cierre tras timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
