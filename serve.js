const {startServer} = require('polyserve');
const projectConfig = require('./polymer.json');

const apiServerPort = 8888;
const serverOptions = {
  compile: projectConfig.compile,
  entryPoint: projectConfig.entryPoint,
  proxy: {
    path: 'b',
    target: `http://localhost:${apiServerPort}`
  },
  root: 'app',
};

const basePath = projectConfig.basePath.replace(/(^\/|\/$)/g, '');
const urlSearchRegex = new RegExp(`^/(${basePath}|${serverOptions.root})`);

function setupUrlRewriter(app) {
  app.use((req, res, next) => {
    req.url = req.url.replace(urlSearchRegex, '');
    return next();
  });
}

function setupApiProxy(app) {
  app.get('/api/v1/activities/weekly-stat', (req, res, next) => {
    res.json(require('./app/scripts/local/activities_weekly-stat.json'));
  });
  app.get('/api/v1/users/plan', (req, res, next) => {
    res.json(require('./app/scripts/local/users_plan.json'));
  });
  app.delete('/api/v1/users/plan', (req, res, next) => {
    res.json(require('./app/scripts/local/ok.json'));
  });
  app.get('/api/v1/activities/calendar', (req, res, next) => {
    res.json(require('./app/scripts/local/activities_calendar.json'));
  });
  app.put('/api/v1/users/:id', (req, res, next) => {
    res.json(require('./app/scripts/local/users_id.json'));
  });
  app.get('/api/v1/training', (req, res, next) => {
    res.json(require('./app/scripts/local/training.json'));
  });
  app.get('/api/v1/training/plan/:id', (req, res, next) => {
    res.json(require('./app/scripts/local/training_plan_id.json'));
  });
  app.put('/api/v1/training/zone', (req, res, next) => {
    res.json(require('./app/scripts/local/training.json'));
  });
  app.get('/api/v1/activities/calendar', (req, res, next) => {
    res.json(require('./app/scripts/local/activities_calendar.json'));
  });
  app.post('/api/v1/activities/:id/fit', (req, res, next) => {
    res.json(require('./app/scripts/local/activities_id_fit.json'));
  });
  app.post('/api/v1/activities/:id/recalculate', (req, res, next) => {
    res.json(require('./app/scripts/local/activities_id_recalculate.json'));
  });
  app.delete('/api/v1/activities/:id', (req, res, next) => {
    res.json(require('./app/scripts/local/ok.json'));
  });
  app.get('/api/v1/users/powerduration', (req, res, next) => {
    res.json(require('./app/scripts/local/powerduration.json'));
  });
  app.get('/api/v1/users/runnertrend', (req, res, next) => {
    res.json(require('./app/scripts/local/runnertrend.json'));
  });
  app.get('/api/v1/users/runnerprofile', (req, res, next) => {
    res.json(require('./app/scripts/local/runnerprofile.json'));
  });
  app.post('/platform/auth/suunto/check', (req, res, next) => {
    res.json(require('./app/scripts/local/ok.json'));
  });
  app.delete('/platform/oauth/:platform', (req, res, next) => {
    res.json(require('./app/scripts/local/ok.json'));
  });
  app.get('/platform/oauth/:platform', (req, res, next) => {
    res.json(require('./app/scripts/local/oauth_id.json'));
  });
  app.post('/internal/fetch/suunto', (req, res, next) => {
    res.json(require('./app/scripts/local/ok.json'));
  });
  app.get('/internal/platforms', (req, res, next) => {
    res.json(require('./app/scripts/local/platforms.json'));
  });
  app.get('/internal/leaderboard/:id(\\d+)', (req, res, next) => {
    res.json(require('./app/scripts/local/leaderboard-rss.json'));
  });
  app.get('/internal/leaderboard/cp', (req, res, next) => {
    res.json(require('./app/scripts/local/leaderboard-cp.json'));
  });
  app.get('/internal/plan/zoneproportion', (req, res, next) => {
    res.json(require('./app/scripts/local/zoneproportion.json'));
  });
}

function startApiServer() {
  const express = require('express');
  const app = express();
  setupApiProxy(app);
  app.all('*', (req, res, next) => {
    console.log(`API: ${req.method} ${req.url}`);
    next();
  });
  app.listen(apiServerPort, () => console.log(`API listening on port ${apiServerPort}`));
}

startApiServer();

(async () => {
  const server = await startServer(serverOptions, (app, options) => {
    // XXX: Temporarily pop polyserve's wildcard route off stack,
    // so we can insert our middleware.
    const route = app._router.stack.pop();

    setupUrlRewriter(app);

    app._router.stack.push(route);
    return app;
  });

  const serverAddress = server._connectionKey.replace(/^\d+:/, 'http://');
  console.log(`app listening on ${serverAddress}`);
})();