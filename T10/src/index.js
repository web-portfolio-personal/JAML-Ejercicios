import { connectDB } from './config/db.js';
import httpServer from './app.js';

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Servidor en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar MongoDB:', err.message);
    process.exit(1);
  });