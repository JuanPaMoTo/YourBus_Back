module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.js', '!src/seed.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'cobertura', 'lcov'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './test-results', outputName: 'results.xml' }],
  ],
};
