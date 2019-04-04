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

/**
 * Ramiro Portas : #ff
 * (1) cada 60000ms = 1m ejecuto asyncResolveMtContent
 */
 setinterval(asyncResolveProcessMtContent(null, (err, rs) => {
 	var response = {};			
 	if (!err){

 	}
 	else{

 	}
 }), 60000);
//#ff

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
		
		//persisto request en redis
		try{
			var k, v;
			k = "apifox-mt-content-" + data.body.content_id;
			v = JSON.stringify(data.body)
			redis.set(k, v);
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