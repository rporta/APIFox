var async = require('async');
var express = require('express');
var router = express.Router();
var request = require('request');


var logger, mssql, debug, mw, opradb, productMap, countryInfo, getSessionId, authorization;

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
		logger.info('Request method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(reqFull)) :
		logger.info('Request method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(reqFull));

	asyncResolveLogin(reqFull, (err, rs) => {
		//preparo json respuesta ambos casos
		var response = {};
		response['result'] = {};
		response['status'] = {};
		(() => {
			if (rs.isActiveRs) {
				response.result['login_status'] = rs.isActiveRs.subscription !== false ? 1 : 0;
				response.result['subscriber_status'] = rs.isActiveRs.subscription !== false ? 1 : 0; //queda definido en 0 y 1 por Benja
				response.result['billing_status'] =
					rs.isActiveRs.subscription !== false ?
					((spid) => {

						//uso SponsorId para utilizar en la configuracion de mapeo 'countryInfo' para obtener interval, 
						//con interval puedo obtener el billing_stat
						//billing_status = (ultimo_cobro diff now() < interval) ? 1 : 0;

						var interval = ((x) => {
							for (var carrierId in countryInfo) {
								if (countryInfo[carrierId].sponsorId == x) {
									return countryInfo[carrierId].interval;
								}
							}
							return '0';
						})(spid);
						var dayInt = 1000 * 60 * 60 * 24;
						var dateNow = new Date();
						var dateLastBilling = new Date(rs.isActiveRs.subscription.ultimocobro);
						var diffDays = parseInt((dateLastBilling - dateNow) / dayInt);
						var billing_status = diffDays < interval ? '1' : '0';
						// logger.debug('dateNow :' + dateNow);
						// logger.debug('dateLastBilling :' + dateLastBilling);
						// logger.debug('diffDays :' + diffDays);
						// logger.debug('interval :' + interval);
						return billing_status;

					})(rs.isActiveRs.subscription.SponsorId) :
					'0';

				response.result['user_id'] = rs.isActiveRs.subscription.UserId ? rs.isActiveRs.subscription.UserId : '0';
				response.result['msisdn'] = rs.isActiveRs.subscription.Origen ? rs.isActiveRs.subscription.Origen : '0';

				response.result['carrier_id'] =

					//uso SponsorId para utilizar en la configuracion de mapeo 'countryInfo' para obtener carrierId
					rs.isActiveRs.subscription !== false ?
					((spid) => {
						for (var carrierId in countryInfo) {
							if (countryInfo[carrierId].sponsorId == spid) {
								return carrierId;
							}
						}
						return false;
					})(rs.isActiveRs.subscription.SponsorId) :
					'0';

				response.result['server_response_id'] = getSessionId;
			}
		})();

		!err
			?
			(() => {
				//aca preparar json de respuesta caso rs
				response.status['code'] = 1;
				response.status['description'] = "La operacion se pudo realizar/consulta";

				//guardo response en log
				debug
					?
					logger.info('Response method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(response)) :
					logger.info('Response method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(response));

				res.status(200).send(response);
			})() :
			(() => {
				//aca preparar json de respuesta caso err

				response.status['code'] = rs.code;
				response.status['description'] = rs.error;

				debug
					?
					logger.info('Response method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(response)) :
					logger.info('Response method ' + '(/v1/subscriber/login)' + ' : ' + JSON.stringify(response));

				res.status(400).send(response);
			})();
	});
});

/**
 * Ramiro Portas : Funcion que implementa async.waterfall
 * @param  {[Regular Obj]}		data	[description] objeto regular que contiene parametros de tipo path y body del request
 * @param  {[Function]}			cb		[description] funcion anonima que recibe 2 parametros : err, rs
 * @return {[void]}						[description] quien resuelve es el callback
 */
var asyncResolveLogin = (data, cb) => {

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
							//preparo parametros para la query 'opradb.isActive'
							data.paramsIsActive = new Array();
							for (var i in productMap[data.path.product_name].paqueteid) {
								var pr = new Object();
								pr.paqueteid = productMap[data.path.product_name].paqueteid[i];
								pr.msisdn = data.body.msisdn ? data.body.msisdn : '';
								pr.suscripcionid = data.body.user_id ? data.body.user_id : '';
								data.paramsIsActive.push(pr);
							}
							//envio los datos a step 3
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
				//cb : err | final 
				if (data.error == "Error db : opradb.isActive, no encontro una subscription con los parametros enviados") {
					cb(true, data);
				}
			});
		}
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