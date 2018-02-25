const {startServer} = require('polyserve');
const projectConfig = require('./polymer.json');

const serverOptions = {
  compile: projectConfig.compile,
  entryPoint: projectConfig.entryPoint,
  proxy: {
    path: 'b',
    target: 'http://localhost:8888'
  },
  root: 'app',
};

const basePath = projectConfig.basePath.replace(/(^\/|\/$)/g, '');
const urlSearchRegex = new RegExp(`^/(${basePath}|${serverOptions.root})`);

(async () => {
  const server = await startServer(serverOptions, (app, options) => {
    // XXX: Temporarily pop polyserve's wildcard route off stack,
    // so we can insert our middleware.
    const route = app._router.stack.pop();

    app.use((req, res, next) => {
      // Rewrite URL to remove the base/root path
      req.url = req.url.replace(urlSearchRegex, '');
      return next();
    });

    app._router.stack.push(route);
    return app;
  });

  const serverAddress = server._connectionKey.replace(/^\d+:/, 'http://');
  console.log(`listening on ${serverAddress}`);
})();