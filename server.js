var express = require('express');
var app = express();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var ipfilter = require('express-ipfilter');
var winston = require('winston');
var utils = require('../libs/utils');
var mssql = require('../libs/mssql');

var config = require('./config/config');

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_access.log', json: false })
    ]
});

var mssqlLogger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_mssql_access.log', json: false })
    ]
});

/*var redisLogger = new (winston.Logger)({
    transports: [
        // new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_redis_access.log', json: false })
    ]
});*/

/*redis.setConfig(config);
redis.setLogger(redisLogger);
redis.init();*/


mssql.setConfig(config.mssql);
mssql.setLogger(mssqlLogger);
mssql.init();

/*var heartbeats = require('../libs/heartbeats');
heartbeats.setLogger(mssqlLogger);
heartbeats.setDB(mssql);
heartbeats.init(operator.server.serviceName);*/

app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended: true}));

//IPs permititas!
app.use(ipfilter(config.server.whitelist, { mode: 'allow' }));
http.listen(config.server.port, function(){logger.info('Web Service started on port ' + config.server.port);});

app.locals.logger = logger;
app.locals.mssql = mssql;

var login = require('./routes/login');
app.use('/v1/subscriber/login', login);

/*var unsubscribe = require('./routes/unsubscribe');
app.use('/v1/subscriber/unsubscribe', unsubscribe);

var pinRecover = require('./routes/pinRecover');
app.use('/v1/subscriber/pin-recover', pinRecover);

var mtContent = require('./routes/mtContent');
app.use('/v1/subscriber/mtContent', mtContent);

var bulkMtContent = require('./routes/bulkMtContent');
app.use('/v1/subscriber/bulk-mt-content', bulkMtContent);*/

var billingStatus = require('./routes/billing_status');
app.use('/v1/subscriber/billing_status', billingStatus);


app.use(function(req, res, next){
    res.status(404).send('404: Page not Found');
});