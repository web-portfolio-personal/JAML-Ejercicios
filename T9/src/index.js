import app from './app.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Conectado a Supabase (Prisma)');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${PORT}`);
      console.log(`📚 Docs en http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
}

main();
