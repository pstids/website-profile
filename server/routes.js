const chalk = require('chalk');
const path = require('path');
const {json} = require('route-map');

const JSON_DIR_PATH = path.join(__dirname, '../app/scripts/local');
const JSON_DIR_PATH_2 = path.join(__dirname, './data');

const OK_RESP = json`{"message": "ok", "url": ":{originalUrl}"}`;

const routes = {
  '/api/v1/users/plan': {
    get: `${JSON_DIR_PATH_2}/api/v1/users/plan.json`,
    delete: OK_RESP,
  },
  '/api/v1/users/:id': {
    get: `${JSON_DIR_PATH_2}/api/v1/users/:id.json`,
    put: OK_RESP,
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
    put: OK_RESP,
    delete: OK_RESP,
  },
  '/api/v1/activities/:id/calendar': `${JSON_DIR_PATH_2}/api/v1/activities/:id/calendar.json`,
  '/api/v1/activities/:id/fit': {
    post: `${JSON_DIR_PATH_2}/api/v1/activities/:id/fit.json`,
  },
  '/api/v1/activities/:id/recalculate': {
    post: `${JSON_DIR_PATH}/activities_id_recalculate.json`,
  },
  '/activities/:id(\\d+)': `${JSON_DIR_PATH_2}/api/v1/activities/:id.json`,
  '/api/v1/users/powerduration': `${JSON_DIR_PATH_2}/api/v1/users/powerduration.json`,
  '/api/v1/users/runnertrend': `${JSON_DIR_PATH_2}/api/v1/users/runnertrend.json`,
  '/api/v1/users/runnerprofile': `${JSON_DIR_PATH_2}/api/v1/users/runnerprofile.json`,
  '/platform/auth/suunto/check': {
    post: OK_RESP,
  },
  '/platform/oauth/:platform': {
    get: `${JSON_DIR_PATH}/oauth_id.json`,
    delete: OK_RESP,
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

module.exports = {
  routes
};
