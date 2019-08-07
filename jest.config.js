module.exports = {
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.(js|jsx|ts|tsx)'],
  globals: {
    'ts-jest': {
      babel: true,
      tsConfig: 'tsconfig.json',
    },
  },
};
