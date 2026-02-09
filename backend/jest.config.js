module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts', '**/?(*.)+(spec|test).ts'],
    testPathIgnorePatterns: ['/node_modules/', 'testHelpers\\.ts$'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/server.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    verbose: true,
    testTimeout: 10000,
    maxWorkers: 1, // Run tests serially to prevent database conflicts
};
