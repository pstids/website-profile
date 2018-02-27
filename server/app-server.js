const {startServer: polyserveStartServer} = require('polyserve');
const projectConfig = require('../polymer.json');

/**
 * Starts the front-end server in dev mode
 */
async function startServer(apiServerPort) {
  const serverOptions = {
    compile: projectConfig.compile,
    entryPoint: projectConfig.entryPoint,
    basePath: projectConfig.basePath.replace(/(^\/|\/$)/g, ''),
    proxy: {
      path: 'b',
      target: `http://localhost:${apiServerPort}`
    },
    root: 'app',
  };

  const server = await polyserveStartServer(serverOptions, (app, options) => {
    setupUrlRewriter(app, serverOptions);

    // XXX: polyserve currently installs a wildcard route that prevents
    // insertion of middleware, so move our newly created route to the
    // stack index right before the wildcard route.
    const indexOfWildcardRoute = app._router.stack.findIndex(r => r.route && r.route.path.match(/^\/?\*/g));
    if (indexOfWildcardRoute > -1) {
      const newRoute = app._router.stack.pop();
      app._router.stack.splice(indexOfWildcardRoute, 0, newRoute);
    }

    return app;
  });

  const serverAddress = server._connectionKey.replace(/^\d+:/, 'http://');
  console.log(`app listening on ${serverAddress}`)
}

function setupUrlRewriter(app, {basePath, root}) {
  const urlSearchRegex = new RegExp(`^/(${basePath}|${root})`);
  app.use((req, res, next) => {
    req.url = req.url.replace(urlSearchRegex, '');
    return next();
  });
}

module.exports = {
  startServer
};
