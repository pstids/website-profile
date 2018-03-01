const {startServer: startApiServer} = require('./api-server');
const {startServer: startAppServer} = require('./app-server');

const {2: rootPath} = process.argv;
if (rootPath) {
  process.chdir(rootPath);
}

const appPort = 8081;
const apiServerPort = 8888;
startAppServer({appPort, apiServerPort});
startApiServer(apiServerPort);
