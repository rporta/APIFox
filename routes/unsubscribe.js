var async = require('async');
var express = require('express');
var router = express.Router();
var request = require('request');

var logger, mssql, debug, mw, opradb, productMap, countryInfo, getSessionId, carrierMap, authorization;

router.post('/:product_name', function(req, res, next) {
	logger = req.app.locals.logger;
	mssql = req.app.locals.mssql;
	debug = req.app.locals.debug;
	mw = req.app.locals.mw;
	opradb = req.app.locals.opradb;
	productMap = req.app.locals.productMap;
	countryInfo = req.app.locals.countryInfo;
	getSessionId = req.app.locals.utils.getSessionId();
	authorization = req.app.locals.authorization;

	/**
	 * Ramiro Portas : #1
	 * (1) cargo a reqFull, parametros de tipo path y body
	 */
	var reqFull = {}
	reqFull.path = req.params;
	reqFull.headers = req.headers;
	reqFull.body = req.body;
	//#1

	debug
		?
		logger.info('Request method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(reqFull)) :
		logger.info('Request method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(reqFull));

	asyncResolveUnsubscribe(reqFull, (err, rs) => {
		var response = {};
		response['result'] = {};
		response['status'] = {};
		if (!err) {
			debug
				?
				logger.debug('\n\n asyncResolveUnsubscribe(): cb rs -> \n\n' + JSON.stringify(rs)) :
				null;
			//aca preparar json de respuesta caso exitoso

			//aca evaluo respuesta del request API
			rs.ApiRs.statusCode === 0 ?
				(() => {
					//caso exitoso
					response.result['code'] = 2; // peticion de baja recibida y procesada contra el operador (síncrono) creo q es external
					response.result['description'] = [1, 2].includes(response.result.code) ? "OK" : rs.ApiRs.body.statusMsg;
					response.result['server_response_id'] = getSessionId;

					response.status['code'] = 1;
					response.status['description'] = rs.ApiRs.body.statusMsg;
				})() :
				(() => {
					//otros casos
					response.result['code'] = rs.ApiRs.body.statusCode === 102 ? 3 : 4; // peticion de baja recibida y procesada contra el operador (síncrono) creo q es external
					response.result['description'] = rs.ApiRs.body.statusMsg;
					response.result['server_response_id'] = getSessionId;

					response.status['code'] = rs.ApiRs.body.statusCode === 1 ? 0 : rs.ApiRs.body.statusCode;
					response.status['description'] = getSessionId;
				})();

			debug
				?
				logger.info('Response method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(response)) :
				logger.info('Response method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(response));

			res.status(200).send(response);
		} else {
			//aca preparar json de respuesta caso err
			response.status['code'] = rs.code;
			response.status['description'] = rs.error;

			debug
				?
				logger.info('Response method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(response)) :
				logger.info('Response method ' + '(/v1/subscriber/unsubscribe)' + ' : ' + JSON.stringify(response));

			res.status(400).send(response);
		}
	});
});

/**
 * Ramiro Portas : Funcion que implementa async.waterfall
 * @param  {[Regular Obj]}		data	[description] objeto regular que contiene parametros de tipo path y body del request
 * @param  {[Function]}			cb		[description] funcion anonima que recibe 2 parametros : err, rs
 * @return {[void]}						[description] quien resuelve es el callback
 */
var asyncResolveUnsubscribe = (data, cb) => {

	//vector de funciones
	var ini = [
		(cb) => {
			//step 1 valido headers authorization
			(function ini(step, code, cantError) {
				data.step = step || 1;
				data.code = code || 99;
				data.cantError = cantError || 0;
			})(null, null, 2);

			debug
				?
				logger.debug('step' + data.step + ' : valido header') :
				null;

			//valido que este headers.authorization
			data.headers.authorization ?
				(() => {
					var ha = {};
					ha.value = data.headers.authorization.split(" ");
					ha.type = ha.value[0];
					ha.token = ha.value[1];
					ha.decodeToken = new Buffer(ha.token, 'base64').toString('ascii').split(":");
					ha.user = ha.decodeToken[0];
					ha.pass = ha.decodeToken[1];

					//valido que headers.authorization sea 'Basic' && decodifico el token y valido usuario y contraseña
					ha.type === authorization.type &&
						ha.user == authorization.user &&
						ha.pass == authorization.password ?
						cb(false, data) :
						(() => {
							(function error(error) {
								data.code--;
								mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
								data.error = error || mensajeDefaut;
							})("Error authorization : alguno de estos datos es incorrecto (type, user, pass)");

							cb(true, data);
						})();

				})() :
				(() => {
					(function error(error) {
						data.code--;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error authorization : No existe el headers.authorization");

					cb(true, data);
				})()
		},
		(data, cb) => {
			//step 2 valido parametros
			(function update(cantError) {
				data.step++;
				data.code -= data.cantError;
				data.cantError = cantError || 0;
			})(2);

			debug
				?
				logger.debug('step' + data.step + ' : valido parametros, armo parametros para query opradb.isActive() en step3') :
				null;


			//valido si los parametros llegaron ok (path, body)
			data.body && data.path.product_name ?
				(() => {
					//valido si es posible mapear por product_name 
					productMap[data.path.product_name] ?
						(() => {
							data.paramsIsActive = new Array();
							for (var i in productMap[data.path.product_name].paqueteid) {
								//preparo parametros para la query 'opradb.isActive'
								var pr = new Object();
								pr.paqueteid = productMap[data.path.product_name].paqueteid[i];
								pr.msisdn = data.body.msisdn ? data.body.msisdn : '';
								pr.suscripcionid = data.body.user_id ? data.body.user_id : '';
								data.paramsIsActive.push(pr);
							}
							//envio los datos a step 2
							cb(false, data);
						})()
						//no se pudo mapear por product_name, envio los datos a funcion final con error
						:
						(() => {

							(function error(error) {
								data.code--;
								mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
								data.error = error || mensajeDefaut;
							})("Error de mapeo : No es posible mapear (productMap)");

							cb(true, data);
						})()
				})() :
				(() => {
					//no llegaron los parametros, envio los datos a funcion final con error
					(function error(error) {
						data.code--;
						mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
						data.error = error || mensajeDefaut;
					})("Error parametros : No llegaron los parametros (data.body, data.path.product_name)");

					cb(true, data);
				})();
		},
		(data, cb) => {
			//step 3 ejecuto query 'opradb.isActive'
			(function update(cantError) {
				data.step++;
				data.code -= data.cantError;
				data.cantError = cantError || 0;
			})(1);

			debug
				?
				logger.debug('step' + data.step + ' : Ejecuto query opradb.isActive()') :
				null;

			async.eachSeries(data.paramsIsActive, function(currentParam, next) {
				//ejecuto la query 'opradb.isActive'
				opradb.isActive(currentParam, (err, rs) => {
					logger.debug("rsIsActive : " + JSON.stringify(rs));
					data.isActiveRs = rs;
					rs.subscription !== false ?
						cb(false, data) :
						(() => {
							//no llegaron los parametros, envio los datos a funcion final con error
							(function error(error) {
								data.code--;
								mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
								data.error = error || mensajeDefaut;
							})("Error db : opradb.isActive, no encontro una subscription con los parametros enviados");
							return next();
						})();
				});
			}, function() {
				if (data.error == "Error db : opradb.isActive, no encontro una subscription con los parametros enviados") {
					cb(true, data);
				}
			});
		},
		(data, cb) => {
			//step 4 realizo un api call a EndPoint 'http://api.hera.opratel.com/unsubscribe'
			(function update(cantError) {
				data.step++;
				data.code -= data.cantError;
				data.cantError = cantError || 0;
			})(1);

			debug
				?
				logger.debug('step' + data.step + ' : Realizo un http request para unsubscribe') :
				null;

			//valido si se puede mapear por carrier_id en countryInfo
			countryInfo[data.body.carrier_id] ?
				(() => {
					//preparo parametros para enviar a la api 'http://api.hera.opratel.com/unsubscribe' ----------(original)
					var postData = {
						'msisdn': data.isActiveRs.subscription.Origen,
						'medioId': data.isActiveRs.subscription.MedioId,
						'paqueteId': data.isActiveRs.subscription.PaqueteId,
						'sponsorId': countryInfo[data.body.carrier_id].sponsorId,
						'medioSuscripcionId': data.isActiveRs.subscription.MedioSuscripcionId
					};

					logger.debug("postData : " + JSON.stringify(postData));


					//preparo parametros para enviar a la api 'http://api.hera.opratel.com/unsubscribe' ----------(test)
					// var postData = {
					// 	'msisdn': '99999999999999',
					// 	'medioId': '88',
					// 	'paqueteId': '88',
					// 	'sponsorId': '88',
					// 	'medioSuscripcionId': '88'
					// };


					// var postData = ((obj) => {			
					// 	var str = [];
					// 	for (var p in obj){
					// 		str.push(p + '=' + obj[p]);
					// 	}
					// 	return str.join("&");
					// })(postData);

					//preparo opciones de configuracion para enviar a la api 'http://api.hera.opratel.com/unsubscribe'
					var postRequest = {
						method: mw.method,
						body: postData,
						json: true,
						url: mw.protocolo + mw.host + '/' + mw.path,
						headers: {
							'Authorization': 'Bearer ' + mw.apiKey
						}
					};
					try {
						var req = request(postRequest, function(error, response, body) {
							if (!error && response.statusCode == 200) {
								data.ApiRs = {};
								data.ApiRs.error = error;
								data.ApiRs.response = response;
								data.ApiRs.body = body;
								cb(false, data);
							}
						})
					} catch (e) {
						//ocurrio un error, envio los datos a funcion final con error
						logger.debug('catch :' + e);
						data.e = e;
						(function error(error) {
							data.code--;
							mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
							data.error = error || mensajeDefaut;
						})("Error request API : 'http://api.hera.opratel.com/unsubscribe'");
						cb(true, data);
					}
				})() :
				cb(true, data);


		},
	];

	//funcion final
	var final = (err, data) => {
		debug
			?
			logger.debug('Final') :
			null;

		err
			?
			(() => {
				logger.debug('Error final step(' + data.step + '): ' + data.error);
				cb(true, data);
			})() :
			cb(false, data);
	};

	//registro vector funciones, funcion final
	async.waterfall(ini, final);
}

module.exports = router;