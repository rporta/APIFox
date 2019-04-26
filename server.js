var express = require('express');
var app = express();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var ipfilter = require('express-ipfilter');
var winston = require('winston');
var utils = require('../libs/utils');
var mssql = require('../libs/mssql');
var redis = require('../libs/redis');
var opradb = require('./libs/opradb');

var config = require('./config/config');
var logger;

//esto queda para despues #f5 : definir operador puesto que es una dependencia de opradb, luego de definirlo se debe ejecutar el script actual pasandole como parametro el operador.

// var args = process.argv.slice(2);
// var operatorName = (typeof args[0] != 'undefined') ? args[0] : false;
// if (!operatorName){
//     console.log('Debe especificar operador');
//     process.exit();
// }

// if (typeof config.operator[operatorName] == 'undefined'){
//     console.log('Operador invalido');
//     process.exit();
// }else{
//     var operator = require(__dirname + '/config/' + config.operator[operatorName]);
// }

//#f5
if(config.debug){
    logger = new (winston.Logger)({
        transports: [
        new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_access.log', json: false })
        ]
    });
}
else{
    logger = new (winston.Logger)({
        transports: [
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_access.log', json: false })
        ]
    });  
}

var mssqlLogger = new (winston.Logger)({
    transports: [
    new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_mssql_access.log', json: false })
    ]
});

var redisLogger = new (winston.Logger)({
    transports: [
        // new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_redis_access.log', json: false })
        ]
    });

redis.setConfig(config);
redis.setLogger(redisLogger);
redis.init();

mssql.setConfig(config.mssql);
mssql.setLogger(mssqlLogger);
mssql.init();

opradb.setOperator(config);
opradb.setDB(mssql);
opradb.setLogger(mssqlLogger);

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
app.locals.debug = config.debug;
app.locals.redis = redis;
app.locals.mw = config.mw;
app.locals.productMap = config.productMap;
app.locals.countryInfo = config.countryInfo;
app.locals.authorization = config.authorization;
app.locals.opradb = opradb;
app.locals.getSessionId = utils.getSessionId();

/**
 * Ramiro Portas: #jj
 * las rutas se configuran en el siguiente recurso /config/config.json, key (route: Array de obj)
 * (1) Autoload route
 */
 ((route) => {
    var resolvePath = "./routes/"; 
    for(var r in route){
        var dinamic = route[r]['recurso'].replace(/(\-\w)/g, function(m){return m[1].toUpperCase();});
        eval("var " + dinamic + " = require('" + resolvePath + route[r]['recurso'] + "');");
        app.use(route[r]['url'], eval(dinamic));
    }
})(config.route);
//#jj

app.use(function(req, res, next){
    res.status(404).send('404: Page not Found');
});
