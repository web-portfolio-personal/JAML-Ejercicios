import { httpServer } from './app';
import { connectDb, env } from './config/index';
import prisma from './lib/prisma';

const start = async (): Promise<void> => {
  // Arrancar servidor primero — health check responde desde el primer momento
  const server = httpServer.listen(env.PORT, () => {
    console.log(`BildyApp API en http://localhost:${env.PORT}`);
    console.log(`Docs en http://localhost:${env.PORT}/api-docs`);
    console.log(`Entorno: ${env.NODE_ENV}`);
  });

  // Conectar a la BD (lazy — no bloquea el arranque)
  try {
    await connectDb();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('BD no disponible al arrancar:', message);
  }

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} recibido. Cerrando servidor...`);

    server.close(async () => {
      console.log('Servidor HTTP cerrado');
      try {
        await prisma.$disconnect();
        console.log('Prisma desconectado');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Error cerrando Prisma:', message);
      }
      process.exit(0);
    });

    // Forzar cierre tras 10 segundos
    setTimeout(() => {
      console.error('Forzando cierre tras timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
