const esModules = ['@lit', 'lit', 'lit-element', 'lit-html'].join('|');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // Use Babel for JS and JSX files
    // Use TS Jest for TS and TSX files.
    // ts-jest compiles to CommonJS, so TS would resolve the "require" export condition.
    // home-assistant-js-websocket ships no types for it, so resolve types as ESM, like the bundle does.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { customConditions: ['import'] } }],
  },
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`]
};