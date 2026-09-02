module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'cobertura', 'lcov'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './test-results', outputName: 'results.xml' }],
  ],
};
