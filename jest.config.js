/** @type {import('ts-jest').JestConfigWithTsJest} */
const esModules = ['@lit', 'lit', 'lit-element', 'lit-html'].join('|');
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`]
};