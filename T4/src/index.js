// src/index.js
import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`🚀 Todo API ejecutándose en http://localhost:${PORT}`);
    console.log(`📝 Entorno: ${env.NODE_ENV}`);
});
