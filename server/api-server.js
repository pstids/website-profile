const {setupRoutes} = require('route-map');
const {routes} = require('./routes');
const chalk = require('chalk');

/**
 * Starts a mock API server for dev
 */
function startServer(port) {
  const express = require('express');
  const app = express();

  // logger middleware
  app.use((req, res, next) => {
    console.debug(chalk.gray(`API ${req.method} ${req.url}`));
    next();
  });

  setupRoutes(app, routes);

  // detect unhandled routes (missing a route in our config?)
  app.all('*', (req, res, next) => {
    console.error(chalk.red(`API: unknown route: ${req.method} ${req.url}`));
    next();
  });

  app.listen(port, () => console.log(`API listening on ::${port}`));
  return app;
}

module.exports = {
  startServer
};
