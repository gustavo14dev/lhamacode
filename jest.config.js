module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['main.js', 'agent.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
