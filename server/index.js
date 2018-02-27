const {startServer: startApiServer} = require('./api-server');
const {startServer: startAppServer} = require('./app-server');

const apiServerPort = 8888;
startAppServer(apiServerPort);
startApiServer(apiServerPort);
