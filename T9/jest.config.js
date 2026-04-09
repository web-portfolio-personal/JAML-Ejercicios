export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    'src/index.js',
    'src/config/prisma.js',
    'src/middleware/error.middleware.js'
  ],
  verbose: true
};
