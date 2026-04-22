import app from './app.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 3000;

async function main() {
  // Arrancar servidor primero — health check responde desde el primer momento
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`📚 Docs en http://localhost:${PORT}/api-docs`);
  });

  // Intentar conexión a BD (lazy — no bloquea el arranque)
  try {
    await prisma.$connect();
    console.log('✅ Conectado a la base de datos (Prisma)');
  } catch (err) {
    console.error('⚠️  BD no disponible al arrancar:', err.message);
    // El servidor sigue corriendo — el health check mostrará database: disconnected
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} recibido. Cerrando servidor...`);

    server.close(async () => {
      console.log('🔌 Servidor HTTP cerrado');
      await prisma.$disconnect();
      console.log('🗄️  Prisma desconectado');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️  Forzando cierre tras timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
