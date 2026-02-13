// src/middleware/rateLimiter.js
// BONUS: Rate limiting (máx 100 req/min)

const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 100;

export const rateLimiter = (req, res, next) => {
    // req.ip es la opción preferida en Express
    // req.socket.remoteAddress es el fallback moderno (req.connection está deprecado)
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    // Obtener o crear registro para esta IP
    let record = requestCounts.get(ip);

    if (!record || now - record.windowStart > WINDOW_MS) {
        // Nueva ventana de tiempo
        record = {
            windowStart: now,
            count: 1
        };
        requestCounts.set(ip, record);
    } else {
        // Incrementar contador en ventana existente
        record.count++;

        if (record.count > MAX_REQUESTS) {
            const resetTime = new Date(record.windowStart + WINDOW_MS).toISOString();

            return res.status(429).json({
                error: 'Demasiadas solicitudes',
                mensaje: `Límite de ${MAX_REQUESTS} solicitudes por minuto excedido`,
                resetAt: resetTime,
                retryAfter: Math.ceil((record.windowStart + WINDOW_MS - now) / 1000)
            });
        }
    }

    // Headers informativos
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.windowStart + WINDOW_MS).toISOString());

    next();
};

// Limpiar registros antiguos cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestCounts.entries()) {
        if (now - record.windowStart > WINDOW_MS * 2) {
            requestCounts.delete(ip);
        }
    }
}, 5 * 60 * 1000);
