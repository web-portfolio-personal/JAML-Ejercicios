// src/middleware/logging.middleware.js

export const loggingMiddleware = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const start = Date.now();

    // Log de entrada
    console.log(`📥 [${timestamp}] ${req.method} ${req.originalUrl}`);

    if (Object.keys(req.query).length > 0) {
        console.log(`   📋 Query params:`, req.query);
    }

    // Capturar el fin de la respuesta
    res.on('finish', () => {
        const duration = Date.now() - start;
        const endTimestamp = new Date().toISOString();
        const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';

        console.log(`📤 [${endTimestamp}] ${statusEmoji} ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });

    next();
};

