var async = require('async');
var redis = require('./libs/redis');
var opradb = require('./libs/opradb');
var config = require('./config/config');
var winston = require('winston');
var utils = require('../libs/utils');
var mssql = require('../libs/mssql');
var request = require('request');
var moment = require('./libs/moment-timezone');
var debug = config.debug;
var productMap = config.productMap;
var countryInfo = config.countryInfo;
var authorization = config.authorization;
var processMtContent = config.processMtContent;

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

var mssqlLogger = new (winston.Logger)({
	transports: [
	new (winston.transports.File)({ timestamp: function() { return utils.now(); }, filename: 'logs/server_mssql_access.log', json: false })
	]
});

mssql.setConfig(config.mssql);
mssql.setLogger(mssqlLogger);
mssql.init();

opradb.setOperator(config);
opradb.setDB(mssql);
opradb.setLogger(mssqlLogger);

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
		//step 1 consulto keys en redis
		(function ini(step, code, cantError){
			data = data ? data : {}; 
			data.step = step || 1;
			data.code = code || 99;
			data.cantError = cantError || 0;
		})(null, null, 1);

		debug
		? logger.debug('step' + data.step + ' : Consulto keys en redis y armo vector key') 
		: null;
		
		//key necesaria para step 4, 5
		data.rsIsActive = new Array();

		//consulto en redis
		try{
			redis.keys('apifox-*', (err, rs) => {
				!err
				? (() => {
					data.keys = rs;
					cb(false, data);
				})()
				: (() => {
					(function error(error){
						data.code --;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error redis : al consultar keys (apifox-mt-content-*)");
					cb(true, data);
				})();
			});
		}
		catch(e){
			(function error(error){
				data.code --;
				mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
				data.error = error || mensajeDefaut;
			})("Error try (redis): al consultar keys");

			cb(true, data);
		}
	},
	(data, cb) => {
		//step 2 recorro vector key, consulto key en redis, armo vector request
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(1);

		debug
		? logger.debug('step' + data.step + ' : Recorro vector keys, armo vector request')
		: null;

		data.redisGetRequest = new Array();
		data.keys.forEach(function (key, i) {
			redis.get(key, function(dataRs){
				dataRs = JSON.parse(dataRs);
				dataRs === false
				? (() => {
					(function error(error){
						data.code --;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error (redis): al consultar key");
					cb(true, data);
				}())
				: (() => {
					data.redisGetRequest.push(dataRs);

					(data.keys.length -1 == i)
					? cb(false, data)
					: null;
				}());
			});
		});
	},
	(data, cb) => {
		//step 3 recorro keys y las elimino de redis
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(1);

		debug
		? logger.debug('step' + data.step + ' : recorro keys y las elimino de redis')
		: null;

		for(var h in data.keys){
			var currentKey = data.keys[h];

			//borro key
			try{
				redis.del(currentKey);

				(data.keys.length -1 == h)
				? cb(false, data)
				: null;
			}
			catch(e){
				(function error(error){
					data.code --;
					mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
					data.error = error || mensajeDefaut;
				})("Error (redis): al borra key");
				cb(true, data);
			}
		}
	},
	(data, cb) => {
		//step 4 recorro request, armo vector con params opradb.isActive
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(0);

		debug
		? logger.debug('step' + data.step + ' : Recorro vector redisGetRequest, armo vector con params para opradb.isActive')
		: null;

		data.paramIsActive = new Array();

		async.eachSeries(data.redisGetRequest, function(currentRequest, next){
			// logger.debug('Item: ' + JSON.stringify(currentRequest));
			if(currentRequest.body.data_option_1){
				//un mensaje a muchos user_ids
				for(var f in currentRequest.body.data_option_1.user_ids){
					
					var user_id = currentRequest.body.data_option_1.user_ids[f];
					var text = currentRequest.body.data_option_1.text;

					//preaparo params para la query 'opradb.isActive'
					var pia = {};
					pia.paqueteid = productMap[currentRequest.path.product_name].paqueteid;
					pia.suscripcionid = user_id;
					pia.text = text;
					data.paramIsActive.push(pia);
				}
				return next();
			}
			else if(currentRequest.body.data_option_2){
				//un vector de objetos (user_id, text)
				for(var j in currentRequest.body.data_option_2){
					var obj = currentRequest.body.data_option_2[j];
					var user_id = obj.user_id;
					var text = obj.text;

					//preaparo params para la query 'opradb.isActive'
					var pia = {};
					pia.paqueteid = productMap[currentRequest.path.product_name].paqueteid;
					pia.suscripcionid = user_id;
					pia.text = text;
					data.paramIsActive.push(pia);
				}
				return next();
			}
			else if(currentRequest.body.carrier_id.constructor.name === 'Number'){
				//(bulk-mt) : ejecuto la query 'opradb.billingStatus', preaparo params para la query 'opradb.isActive'
				var tz = countryInfo[currentRequest.body.carrier_id].tz;
				var paramsBillingStatus = {};
				paramsBillingStatus.sponsorid = countryInfo[currentRequest.body.carrier_id].sponsorId;
				paramsBillingStatus.paqueteid = productMap[currentRequest.path.product_name].paqueteid; 
				paramsBillingStatus.interval = countryInfo[currentRequest.body.carrier_id].interval;
				paramsBillingStatus.top = processMtContent.top;// page_size --aca va 10.000 by Benja, se cambia a 100 poner en config
				// logger.debug('postRequest: ' + JSON.stringify(paramsBillingStatus));
				opradb.billingStatus(paramsBillingStatus, (err, rs) => {

					rs.subscription !== false
					? (() => {
						// logger.debug('billingStatusRs RS  :  \n\n' + JSON.stringify(rs) + '\n\n')
						for (var jj in rs.subscription){
							// logger.debug('current : ' + JSON.stringify(rs.subscription[jj]));
							var newRs = {};
							newRs.paqueteid = rs.paqueteid;
							newRs.suscripcionid = rs.subscription[jj].SuscripcionId;
							newRs.text = currentRequest.body.message;
							// newRs.schedule_date = currentRequest.body.schedule_date;
							newRs.moment_date = moment(currentRequest.body.schedule_date).tz(tz);
							newRs.subscription = rs.subscription[jj];

							//preparo para step 5 (Recorro vector rsIsActive, preparo parametros para MT)
							data.rsIsActive.push(newRs);
						}
						return next();
					})()
					: (() => {
						//no llegaron los parametros, envio los datos a funcion final con error
						(function error(error){
							data.code --;
							mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
							data.error = error || mensajeDefaut;
						})("Error db : problema al ejecutar opradb.billingStatus");
						return next();
					})();
				});
			}	
		},
		() => {
			cb(false, data)
		});
	},	
	(data, cb) => {
		//step 5 Recorro vector paramIsActive, ejecuto query opradb.isActive, armo vector de rs
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(1);

		debug
		? logger.debug('step' + data.step + ' : Recorro vector paramIsActive, ejecuto query opradb.isActive, armo vector con parametros para query MT')
		: null;

		//ejecuto la query 'opradb.isActive'
		async.eachSeries(data.paramIsActive,function(currentParamIsActive, next){
			opradb.isActive(currentParamIsActive, (err, rs) => {
				!err
				? (() => {
					rs.subscription
					? (() => {
						// logger.debug('currentParamIsActive : ' + JSON.stringify(currentParamIsActive) + '\n');
						rs.text = currentParamIsActive.text;
						//preparo vector rsIsActive
						data.rsIsActive.push(rs);
					})()
					: null;
					return next();
				})()
				: (() => {
					(function error(error){
						data.code --;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error db : problema al ejecutar opradb.isActive");
					cb(true, data);
				})();
			});
		},
		() => {
			cb(false, data)
		});
	},
	(data, cb) => {
		//step 6 Recorro vector rsIsActive, preparo parametros para MT
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(0);

		debug
		? logger.debug('step' + data.step + ' : Recorro vector rsIsActive, preparo vector parametros para MT')
		: null;

		if (data.rsIsActive.length === 0) {
			//hay error
			(function error(error){
				data.code --;
				mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
				data.error = error || mensajeDefaut;
			})("Error parametrosMT : data.rsIsActive.length === 0 ");
			cb(true, data);
		}
		else{
			data.paramInsertMT = new Array();
			for(var l in data.rsIsActive){
				var currentRsIsActive = data.rsIsActive[l];
				// logger.debug('rsIsActive : ' + JSON.stringify(currentRsIsActive) + '\n');
				var paramMT = {};
				//paramMT.entradaid = null;
				paramMT.shortcode = currentRsIsActive.subscription.Destino;
				paramMT.msisdn = currentRsIsActive.subscription.Origen;
				paramMT.aplicacionid = currentRsIsActive.subscription.AplicacionId;
				paramMT.medioid = currentRsIsActive.subscription.MedioId;
				paramMT.contenido = currentRsIsActive.text;
				// paramMT.nocharge = 0;
				// paramMT.estadoesid = 3;
				paramMT.suscripcionid = currentRsIsActive.subscription.SuscripcionId;
				// paramMT.mds = 0;
				// paramMT.prioridad = 5;
				paramMT.sponsorid = currentRsIsActive.subscription.SponsorId;
				// paramMT.rebotado = 0;
				paramMT.FechaProceso = currentRsIsActive.moment_date || null;

				data.paramInsertMT.push(paramMT);
				logger.debug('paramMT : ' + JSON.stringify(paramMT) + '\n');

				(data.rsIsActive.length -1 == l)
				? cb(false, data)
				: null;
			}
		}
	},
	(data, cb) => {
		//step 7 Recorro vector con parametros para query MT y ejecuto query
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(1);

		debug
		? logger.debug('step' + data.step + ' : Recorro vector con parametros para query MT, ejecuto query MT')
		: null;

		async.eachSeries(data.paramInsertMT, function(currentParamInsertMT, next){
			// logger.debug('currentParamInsertMT : ' + JSON.stringify(currentParamInsertMT) + '\n');
			opradb.insertMT(currentParamInsertMT, (err, rs) => {
				!err
				? (() => {
					//no hay error
					return next();
				})()
				: (() => {
					//hay error
					(function error(error){
						data.code --;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error db : problema al ejecutar opradb.insertMT");
					cb(true, data);
				})();
			});
		},
		() => {
			cb(false, data)
		});
	},
	];

	//funcion final
	var final = (err, data) => {
		debug 
		? logger.debug('Final')
		: null;

		err
		? (() => {
			logger.debug('Error final step(' + data.step + '): ' + data.error);
			cb(true, data);
		})()
		: cb(false, data);
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
 			logger.debug('callback rs : ' + JSON.stringify(rs));
 		}
 		else{
 			logger.debug('callback err');
 		}
 	});
 	setInterval(() => {
 		asyncResolveProcessMtContent(null, (err, rs) => {
 			var response = {};			
 			if (!err){
 				logger.debug('callback rs : ' + JSON.stringify(rs));
 			}
 			else{
 				logger.debug('callback err');
 			}
 		});
 	}, processMtContent.interval);
 })(null);
//#ff 