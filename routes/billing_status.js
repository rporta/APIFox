var async = require('async');
var express = require('express');
var router = express.Router();

var logger, mssql, debug, opradb, productMap, countryInfo, authorization;

router.get('/:product_name/:carrier_id/:page_size/:page_number', function(req, res, next) {
	logger = req.app.locals.logger;
	mssql = req.app.locals.mssql;
	debug = req.app.locals.debug;
	opradb = req.app.locals.opradb;
	productMap = req.app.locals.productMap;
	countryInfo = req.app.locals.countryInfo;
	authorization = req.app.locals.authorization;
	
	/**
	 * Ramiro Portas : #1
	 * (1) cargo a reqFull, parametros de tipo path y body
	 */
	 var reqFull = {}
	 reqFull.body = req.body
	 reqFull.path = req.params;
	 reqFull.headers = req.headers;
	//#1

	debug
	? logger.info('Request method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(reqFull))
	: logger.info('Request method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(reqFull));
	asyncResolveBillingStatus(reqFull, (err, rs) => {
		var response = {};			
		if (!err){
			//aca preparar json de respuesta caso exitoso
			response['user_id'] = new Array();
			for (var x in rs.billingStatusRs.subscription){
				response['user_id'].push(rs.billingStatusRs.subscription[x].SuscripcionId);
			}

			response['status'] = {};
			response.status['code'] = 1;
			response.status['description'] = "La operacion se puedo realizar/consultar";

			debug
			? logger.info('Response method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(response))
			: logger.info('Response method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(response));

			res.status(200).send(response);
		}else{
			//aca preparar json de respuesta con error
			response['user_id'] = [];
			
			response['status'] = {};
			response.status['code'] = rs.code;
			response.status['description'] = rs.error;

			debug
			? logger.info('Response method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(response))
			: logger.info('Response method ' + '(/v1/subscriber/billing_status)' + ' : ' + JSON.stringify(response));

			res.status(400).send(response);
		}
	});
})

/**
 * Ramiro Portas : Funcion que implementa async.waterfall
 * @param  {[Regular Obj]}		data	[description] objeto regular que contiene parametros de tipo path y body del request
 * @param  {[Function]}			cb		[description] funcion anonima que recibe 2 parametros : err, rs
 * @return {[void]}						[description] quien resuelve es el callback
 */
 var asyncResolveBillingStatus = (data, cb) => {

	//vector de funciones
	var ini = [
	(cb) => {
		//step 1 valido headers authorization
		(function ini(step, code, cantError){
			data.step = step || 1;
			data.code = code || 99;
			data.cantError = cantError || 0;
		})(null, null, 2);

		debug
		? logger.debug('step' + data.step + ' : valido header')
		: null;


		//valido que este headers.authorization
		data.headers.authorization
		? (() => {
			var ha = {};
			ha.value = data.headers.authorization.split(" ");
			ha.type = ha.value[0];
			ha.token = ha.value[1];
			ha.decodeToken = new Buffer(ha.token, 'base64').toString('ascii').split(":");
			ha.user = ha.decodeToken[0];
			ha.pass = ha.decodeToken[1];

			//valido que headers.authorization sea 'Basic' && decodifico el token y valido usuario y contraseña
			ha.type === authorization.type
			&& ha.user == authorization.user
			&& ha.pass == authorization.password
			? cb(false, data)
			: (() => {
				(function error(error){
					data.code --;
					mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
					data.error = error || mensajeDefaut;
				})("Error authorization : alguno de estos datos es incorrecto (type, user, pass)");

				cb(true, data);
			})();

		})()
		: (() => {
			(function error(error){
				data.code --;
				mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
				data.error = error || mensajeDefaut;
			})("Error authorization : No existe el headers.authorization");

			cb(true, data);
		})()
	},
	(data, cb) => {
		//step 2 valido parametros
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(2);

		debug
		? logger.debug('step' + data.step + ' : valido y preparo parametros para query opradb.billingStatus()')
		: null;

		//valido si los parametros llegaron ok (path, body)
		data.body && data.path.product_name && data.path.carrier_id && data.path.page_size && data.path.page_number
		? (() => {
			//valido si es posible mapear por product_name
			productMap[data.path.product_name] && countryInfo[data.path.carrier_id]
			? (() => {
				data.paramsBillingStatus = new Array();
				for(var i in productMap[data.path.product_name].paqueteid){
					var pr = new Object();
					pr.sponsorid = countryInfo[data.path.carrier_id].sponsorId;
					pr.paqueteid = productMap[data.path.product_name].paqueteid[i]; 
					pr.interval = countryInfo[data.path.carrier_id].interval;
					pr.top = data.path.page_size;
					data.paramsBillingStatus.push(pr);
				}
				//envio los datos a step 3
				cb(false, data);
			})()
			: (() => {
				//no llegaron los parametros, envio los datos a funcion final con error
				(function error(error){
					data.code --;
					mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
					data.error = error || mensajeDefaut;
				})("Error de mapeo : No es posible mepear (productMap, countryInfo)");

				cb(true, data);
			})();
		})()
		: (() => {
			//no llegaron los parametros, envio los datos a funcion final con error
			(function error(error){
				data.code --;
				mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
				data.error = error || mensajeDefaut;
			})("Error parametros : No llegaron los parametros (data.body, data.path.product_name, data.path.carrier_id, data.path.page_size, data.path.page_number)");

			cb(true, data);
		})();
	},
	(data, cb) => {
		//step 3 ejecuto query 'opradb.billingStatus'
		(function update(cantError){
			data.step ++;
			data.code -= data.cantError;
			data.cantError = cantError || 0;
		})(2);

		debug
		? logger.debug('step' + data.step + ' : Ejecuto query opradb.billingStatus()')
		: null;

		async.eachSeries(data.paramsBillingStatus, function(currentParam, next){
			//ejecuto la query 'opradb.billingStatus'
			opradb.billingStatus(currentParam, (err, rs) => {
				data.billingStatusRs = rs;
				data.billingStatusRs.subscription !== false
				? (() => {				debug
					? logger.debug('step' + data.step + ' : Rs query opradb.billingStatus() :  \n\n' + JSON.stringify(data.billingStatusRs) + '\n\n')
					: null;

					cb(false, data);
				})()
				: (() => {
					//no llegaron los parametros, envio los datos a funcion final con error
					(function error(error){
						data.code --;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error db : problema al ejecutar opradb.billingStatus, no encontro una subscription con los parametros enviados");
					return next();
				})();
			});
		}, function (){
			if(data.error == "Error db : opradb.isActive, no encontro una subscription con los parametros enviados"){
				cb(true, data);
			}			
		});

	}
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


module.exports = router;