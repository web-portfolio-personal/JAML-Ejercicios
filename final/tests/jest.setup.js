// Se ejecuta antes de que cualquier módulo sea importado en los tests
process.env.NODE_ENV            = 'test';
process.env.PORT                = '3000';
process.env.PUBLIC_URL          = 'http://localhost:3000';
process.env.JWT_SECRET          = 'test-secret-32-characters-long-ok!';
process.env.JWT_REFRESH_SECRET  = 'test-refresh-secret-32-chars-long!!';
process.env.JWT_EXPIRES_IN      = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
// MONGODB_URI se sobreescribirá por connectTestDb() en cada test
process.env.MONGODB_URI         = 'mongodb://localhost:27017/bildyapp_test';
