const {startServer: startApiServer} = require('./api-server');
const {startServer: startAppServer} = require('./app-server');
const fs = require('fs');

const {2: rootPath} = process.argv;
let root;
if (rootPath) {
  process.chdir(rootPath);
  root = fs.readdirSync('.')[0];
}

const appPort = 8081;
const apiServerPort = 8888;
startAppServer({appPort, root, apiServerPort});
startApiServer(apiServerPort);
