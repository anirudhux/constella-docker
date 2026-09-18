// Cucumber config. TS step files are transpiled on the fly by tsx
// (NODE_OPTIONS='--import tsx', set in the package.json test scripts).
export default {
  import: ['tests/support/**/*.ts', 'tests/steps/**/*.ts'],
  paths: ['tests/features/**/*.feature'],
  format: [
    'summary',
    'progress-bar',
    ['html', 'tests/_report/cucumber.html'],
    ['json', 'tests/_report/cucumber-report.json'],
  ],
  formatOptions: { snippetInterface: 'async-await' },
};
