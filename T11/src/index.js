import app from './app.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Conectado a Supabase (Prisma)');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${PORT}`);
      console.log(`📚 Docs en http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown — cierra conexiones antes de salir
    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido. Cerrando servidor...`);

      server.close(async () => {
        console.log('🔌 Servidor HTTP cerrado');
        await prisma.$disconnect();
        console.log('🗄️  Prisma desconectado');
        process.exit(0);
      });

      // Forzar cierre si tarda más de 10 s
      setTimeout(() => {
        console.error('⚠️  Forzando cierre tras timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
}

main();
