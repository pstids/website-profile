const {setupRoutes} = require('route-map');
const {routes} = require('./routes');
const chalk = require('chalk');
const morgan = require('morgan');

/**
 * Starts a mock API server for dev
 */
function startServer(port) {
  const express = require('express');
  const app = express();

  app.use(morgan('dev'));
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
