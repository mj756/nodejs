#!/usr/bin/env node
//const socket = require('../helper/socket');
const http = require('http');
const app = require('../server/app');
const dataManager = require('../Repository/DataManager');
const dbClient = require('../Repository/connection');
app.set('port', process.env.PORT || 3000);
const server = http.createServer(app).listen(process.env.PORT || 3000);
//new socket(server);
dataManager.setSocket(server);
dbClient.connect()





