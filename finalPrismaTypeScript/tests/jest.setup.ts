// Se ejecuta antes de que cualquier modulo sea importado en los tests
process.env.NODE_ENV               = 'test';
process.env.PORT                   = '3000';
process.env.PUBLIC_URL             = 'http://localhost:3000';
process.env.DATABASE_URL           = 'file:./prisma/test.db';
process.env.JWT_SECRET             = 'test-secret-32-characters-long-ok!';
process.env.JWT_REFRESH_SECRET     = 'test-refresh-secret-32-chars-long!!';
process.env.JWT_EXPIRES_IN         = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
