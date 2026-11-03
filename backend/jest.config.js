module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { statements: 60, branches: 60, functions: 60, lines: 60 },
  },
};
