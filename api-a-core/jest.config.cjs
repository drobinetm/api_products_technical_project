module.exports = {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/src/jest.setup.js'],
  testTimeout: 30000,
  preset: '@shelf/jest-mongodb'
};
