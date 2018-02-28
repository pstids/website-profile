const {setupRoutes} = require('route-map');
const chalk = require('chalk');

const JSON_DIR_PATH = '../app/scripts/local';

const routes = {
  '/api/v1/users/plan': {
    get(req, res) {
      const data = require(`${JSON_DIR_PATH}/users_plan.json`);
      data.training_plan = require(`${JSON_DIR_PATH}/plan.json`).plan;
      res.json(data);
    },
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/api/v1/users/:id(\\d+)': {
    put: `${JSON_DIR_PATH}/users_id.json`
  },
  '/api/v1/training': `${JSON_DIR_PATH}/training.json`,
  '/api/v1/training/plan/:id': `${JSON_DIR_PATH}/training_plan_id.json`,
  '/api/v1/training/zone': {
    put: `${JSON_DIR_PATH}/training.json`,
  },
  '/api/v1/activities/weekly-stat': `${JSON_DIR_PATH}/activities_weekly-stat.json`,
  '/api/v1/activities/calendar': `${JSON_DIR_PATH}/activities_calendar.json`,
  '/api/v1/activities/:id(\\d+)': {
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/api/v1/activities/:id/fit': {
    post: `${JSON_DIR_PATH}/activities_id_fit.json`,
  },
  '/api/v1/activities/:id/recalculate': {
    post: `${JSON_DIR_PATH}/activities_id_recalculate.json`,
  },
  '/activities/:id(\\d+)': {
    get(req, res) {
      const id = req.params.id;
      const activities = require(`${JSON_DIR_PATH}/activities_calendar.json`).activities;
      const activity = activities.find(a => !Number.isNaN(a.id) && Number(a.id) === Number(id));
      if (!activity) {
        console.log('activity not found by id:', id);
      }
      res.json(activity || {});
    }
  },
  '/api/v1/users/powerduration': `${JSON_DIR_PATH}/powerduration.json`,
  '/api/v1/users/runnertrend': `${JSON_DIR_PATH}/runnertrend.json`,
  '/api/v1/users/runnerprofile': `${JSON_DIR_PATH}/runnerprofile.json`,
  '/platform/auth/suunto/check': {
    post: `${JSON_DIR_PATH}/ok.json`,
  },
  '/platform/oauth/:platform': {
    get: `${JSON_DIR_PATH}/oauth_id.json`,
    delete: `${JSON_DIR_PATH}/ok.json`,
  },
  '/internal/fetch/suunto': {
    post: `${JSON_DIR_PATH}/ok.json`,
  },
  '/internal/platforms': `${JSON_DIR_PATH}/platforms.json`,
  '/internal/leaderboard/:id(\\d+)': `${JSON_DIR_PATH}/leaderboard-rss.json`,
  '/internal/leaderboard/cp': `${JSON_DIR_PATH}/leaderboard-cp.json`,
  '/internal/plan/zoneproportion': `${JSON_DIR_PATH}/zoneproportion.json`,
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
