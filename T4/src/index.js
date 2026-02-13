// src/index.js
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Todo API ejecutándose en http://localhost:${PORT}`);
    console.log(`📝 Entorno: ${process.env.NODE_ENV || 'development'}`);
});
