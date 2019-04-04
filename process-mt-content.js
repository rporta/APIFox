var async = require('async');
var redis = require('../libs/redis');
var config = require('./config/config');
var winston = require('winston');
var utils = require('../libs/utils');
var debug = config.debug;

var redisLogger = new (winston.Logger)({
	transports: [
        // new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_redis_access.log', json: false })
        ]
    });

redis.setConfig(config);
redis.setLogger(redisLogger);
redis.init();

var logger;

if(debug){
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


/**
 * Ramiro Portas : Funcion que implementa async.waterfall
 * @param  {[Regular Obj]}		data	[description] objeto regular que contiene parametros de tipo path y body del request
 * @param  {[Function]}			cb		[description] funcion anonima que recibe 2 parametros : err, rs
 * @return {[void]}						[description] quien resuelve es el callback
 */
 var asyncResolveProcessMtContent = (data, cb) => {

	//vector de funciones
	var ini = [
	(cb) => {
		debug
		? logger.debug('asyncResolveProcessMtContent(): Execute process... 1 [CONSULO EN REDIS]') 
		: null;
		
		//consulto en redis
		try{
			var rs;
			cb(null, data);
		}
		catch(e){
			cb(data, null);
		}
	},
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveProcessMtContent(): Execute process... 2') 
	// 	: null;

	// 	cb(null, data);
	// },
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveProcessMtContent(): Execute process... 3') 
	// 	: null;

	// 	cb(null, data);
	// },
	];

	//funcion final
	var final = (err, rs) => {
		debug
		? logger.debug('asyncResolveProcessMtContent(): Execute final... ')
		: null;

		err
		? (() => {
			logger.debug('asyncResolveProcessMtContent(): Error final... ');
			console.log(err);
			cb(err, rs);
		})()
		: cb(err, rs);
	};

	//registro vector funciones, funcion final
	async.waterfall(ini, final);	
}

/**
 * Ramiro Portas : #ff
 * (1) cada 60000 ms = 1m ejecuto asyncResolveProcessMtContent
 */
 setInterval(() => {
 	asyncResolveProcessMtContent(null, (err, rs) => {
 		var response = {};			
 		if (!err){
 			logger.debug('asyncRcesolveProcessMtContent(): Execute cb rs... ');
 		}
 		else{
 			logger.debug('asyncResolveProcessMtContent(): Execute cb err... ');
 		}
 	});
 }, 60000);
//#ff