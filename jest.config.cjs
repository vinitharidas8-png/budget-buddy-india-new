module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
