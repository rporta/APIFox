var async = require('async');
var redis = require('./libs/redis');
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
		? logger.debug('asyncResolveProcessMtContent(): Execute process... 1 [CONSULO KEYS EN REDIS]') 
		: null;
		
		//consulto en redis
		try{
			redis.keys('apifox-mt-content-*', (err, rs) => {
				!err
				? cb(null, rs)
				: cb(err, null);
			});
		}
		catch(e){
			cb(data, null);
		}
	},
	(keys, cb) => {
		debug
		? logger.debug('asyncResolveProcessMtContent(): Execute process... 2 [RECORRO KEYS Y CONSULTO KEY EN REDIS]') 
		: null;

		keys.forEach(function (key, i) {
			redis.get(key, function(data){
				data === false
				? cb(data, null)
				: (() => {
					// debug
					// ? logger.debug('key : ' + key + ', data : ' + data + ', content_id : ' + JSON.parse(data).content_id ) 
					// : null;
					
					data = JSON.parse(data);

					if(data.data_option_1){
						//un mensaje a muchos user_ids
						debug
						? logger.debug('un mensaje a muchos user_ids : ' + JSON.stringify(data.data_option_1)) 
						: null;

						for(var j in data.data_option_1.user_ids){
							var user_id = data.data_option_1.user_ids[j];
							var text = data.data_option_1.text;

							//resolver 1
						}
					}
					else if(data.data_option_2){		
						//un vector de objetos (user_id, text)
						debug
						? logger.debug('un vector de objetos (user_id, text) : ' + JSON.stringify(data.data_option_2)) 
						: null;

						for(var j in data.data_option_2){
							var obj = data.data_option_2[j];
							var user_id = obj.user_id;
							var text = obj.text;

							//resolver 2
						}
					}

					(keys.length -1 == i)
					? cb(null, null)
					: null;
				}());
			});
		});
	},
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveProcessMtContent(): Execute process... 3') 
	// 	: null;

	// 	cb(null, data);
	// },	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveProcessMtContent(): Execute process... 4') 
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
 * (1) Ejecuto asyncResolveProcessMtContent
 * (2) cada 60000 ms = 1m ejecuto asyncResolveProcessMtContent
 */
 (() => {
 	asyncResolveProcessMtContent(null, (err, rs) => {
 		var response = {};			
 		if (!err){
 			logger.debug('asyncRcesolveProcessMtContent(): Execute cb rs... ' + rs);
 		}
 		else{
 			logger.debug('asyncResolveProcessMtContent(): Execute cb err... ');
 		}
 	});
 	setInterval(() => {
 		asyncResolveProcessMtContent(null, (err, rs) => {
 			var response = {};			
 			if (!err){
 				logger.debug('asyncRcesolveProcessMtContent(): Execute cb rs... ' + rs);
 			}
 			else{
 				logger.debug('asyncResolveProcessMtContent(): Execute cb err... ');
 			}
 		});
 	}, 1000);
 })(null);
//#ff