const {setupRoutes} = require('route-map');
const chalk = require('chalk');
const path = require('path');

const JSON_DIR_PATH = path.join(__dirname, '../app/scripts/local');
const JSON_DIR_PATH_2 = path.join(__dirname, './data');

const routes = {
  '/api/v1/users/plan': {
    get: `${JSON_DIR_PATH_2}/api/v1/users/plan.json`,
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/api/v1/users/:id(\\d+)': {
    put: `${JSON_DIR_PATH}/users_id.json`
  },
  '/api/v1/training': `${JSON_DIR_PATH_2}/api/v1/training.json`,
  '/api/v1/training/plan/:id': `${JSON_DIR_PATH}/training_plan_id.json`,
  '/api/v1/training/zone': {
    put: `${JSON_DIR_PATH}/training.json`,
  },
  '/api/v1/activities/weekly-stat': `${JSON_DIR_PATH_2}/api/v1/activities/weekly-stat.json`,
  '/api/v1/activities/calendar': `${JSON_DIR_PATH_2}/api/v1/activities/calendar.json`,
  '/api/v1/activities/:id(\\d+)': {
    get: `${JSON_DIR_PATH_2}/api/v1/activities/:id.json`,
    put: `${JSON_DIR_PATH}/ok.json`,
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/api/v1/activities/:id/calendar': `${JSON_DIR_PATH_2}/api/v1/activities/:id/calendar.json`,
  '/api/v1/activities/:id/fit': {
    post: `${JSON_DIR_PATH}/activities_id_fit.json`,
  },
  '/api/v1/activities/:id/recalculate': {
    post: `${JSON_DIR_PATH}/activities_id_recalculate.json`,
  },
  '/activities/:id(\\d+)': {
    get(req, res) {
      const id = req.params.id;
      if (id === '5727582954717184') {
        res.json(require(`${JSON_DIR_PATH_2}/api/v1/activities/${id}.json`));
        return;
      }
      const activities = require(`${JSON_DIR_PATH}/activities_calendar.json`).activities;
      const activity = activities.find(a => !Number.isNaN(a.id) && Number(a.id) === Number(id));
      if (!activity) {
        console.error(chalk.red('activity not found by id:', id));
      }
      res.json(activity || {});
    }
  },
  '/api/v1/users/powerduration': `${JSON_DIR_PATH_2}/api/v1/users/powerduration.json`,
  '/api/v1/users/runnertrend': `${JSON_DIR_PATH_2}/api/v1/users/runnertrend.json`,
  '/api/v1/users/runnerprofile': `${JSON_DIR_PATH_2}/api/v1/users/runnerprofile.json`,
  '/platform/auth/suunto/check': {
    post: `${JSON_DIR_PATH}/ok.json`,
  },
  '/platform/oauth/:platform': {
    get: `${JSON_DIR_PATH}/oauth_id.json`,
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/internal/fetch/suunto': {
    post: `${JSON_DIR_PATH_2}/internal/fetch/suunto.json`,
  },
  '/internal/platforms': `${JSON_DIR_PATH_2}/internal/platforms.json`,
  '/internal/leaderboard/1': `${JSON_DIR_PATH_2}/internal/leaderboard/1.json`,
  '/internal/leaderboard/7': `${JSON_DIR_PATH_2}/internal/leaderboard/7.json`,
  '/internal/leaderboard/cp': `${JSON_DIR_PATH}/leaderboard-cp.json`,
  '/internal/plan/zoneproportion': `${JSON_DIR_PATH_2}/internal/plan/zoneproportion.json`,
};

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
