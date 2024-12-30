const esModules = ['@lit', 'lit', 'lit-element', 'lit-html'].join('|');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // Use Babel for JS and JSX files
    '^.+\\.tsx?$': 'ts-jest',    // Use TS Jest for TS and TSX files
  },
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`]
};