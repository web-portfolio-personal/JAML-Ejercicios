import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Carga el .env si existe y aún no se han cargado las variables.
 * Usa import.meta.dirname para encontrar el .env relativo al proyecto,
 * independientemente del CWD con el que el IDE arranque el proceso.
 */
const loadEnv = () => {
    if (process.env.DB_URI) return; // Ya cargado (ej: via --env-file o --import)

    // db.js está en src/config/, el .env está dos niveles arriba en la raíz del proyecto
    const envPath = resolve(import.meta.dirname, '../../.env');
    if (existsSync(envPath)) {
        process.loadEnvFile(envPath);
    }
};

/**
 * Conecta a MongoDB usando la URI de .env
 */
const dbConnect = async () => {
    // Cargar .env si no está cargado aún (cuando el IDE lanza node sin --env-file)
    loadEnv();

    const DB_URI = process.env.DB_URI;

    if (!DB_URI) {
        console.error('❌ DB_URI no está definida en .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(DB_URI);
        console.log('✅ Conectado a MongoDB');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        process.exit(1);
    }
};

// Eventos de conexión
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Desconectado de MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error en MongoDB:', err.message);
});

// Cerrar conexión al terminar
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada');
    process.exit(0);
});

export default dbConnect;
