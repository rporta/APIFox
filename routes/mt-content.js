var async = require('async');
var express = require('express');
var router = express.Router();

var logger, mssql, debug, redis, getSessionId, authorization;

router.post('/:product_name', function(req, res, next) {
	logger = req.app.locals.logger;
	mssql = req.app.locals.mssql;
	debug = req.app.locals.debug;
	redis = req.app.locals.redis;
	getSessionId = req.app.locals.utils.getSessionId();
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
		?
		logger.info('Request method ' + '(/v1/subscriber/mt-content)' + ' : ' + JSON.stringify(reqFull)) :
		logger.info('Request method ' + '(/v1/subscriber/mt-content)' + ' : ' + JSON.stringify(reqFull));
	asyncResolveMtContent(reqFull, (err, rs) => {
		var response = {};
		response['result'] = {};
		response['status'] = {};
		if (!err) {
			//aca preparar json de respuesta caso exitoso

			response.result['code'] = 0;
			response.result['description'] = "OK";
			response.result['server_response_id'] = getSessionId;
			response.status['code'] = 1;
			response.status['description'] = "la operacion se puedo realizar/consultar";
			debug
				?
				logger.info('Response method ' + '(/v1/subscriber/pin-recover)' + ' : ' + JSON.stringify(response)) :
				logger.info('Response method ' + '(/v1/subscriber/pin-recover)' + ' : ' + JSON.stringify(response));

			res.status(200).send(response);
		} else {
			//aca preparar json de respuesta caso err

			response.result['code'] = 2;
			response.result['description'] = "error";
			response.result['server_response_id'] = getSessionId;

			response.status['code'] = rs.code;
			response.status['description'] = rs.error;

			debug
				?
				logger.info('Response method ' + '(/v1/subscriber/pin-recover)' + ' : ' + JSON.stringify(response)) :
				logger.info('Response method ' + '(/v1/subscriber/pin-recover)' + ' : ' + JSON.stringify(response));

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
var asyncResolveMtContent = (data, cb) => {

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
			})(1);

			debug
				?
				logger.debug('step' + data.step + ' : valido parametros, armo parametros para query opradb.isActive() en step3') :
				null;


			//valido si los parametros llegaron ok (path, body)
			data.body && data.path.product_name ?
				cb(false, data) :
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
			data.step++;
			(function update(cantError) {
				data.step++;
				data.code -= data.cantError;
				data.cantError = cantError || 0;
			})(1);

			debug
				?
				logger.debug('step' + data.step + ' : Persisto requesrt en redis') :
				null;

			//persisto request en redis
			try {
				var k, v, dataFull;
				dataFull = {};
				dataFull.body = data.body;
				dataFull.path = data.path;
				k = "apifox-mt-content-" + dataFull.body.content_id;
				v = JSON.stringify(dataFull);
				redis.set(k, v);
				cb(false, data);
			} catch (e) {
				(function error(error) {
					data.code--;
					mensajeDefaut = 'Error en step(' + data.step + '), code: ' + data.code;
					data.error = error || mensajeDefaut;
				})("Error redis : No se logro persistir la consulta");

				cb(true, data);
			}
		},
		// (data, cb) => {
		// 	debug
		// 	? logger.debug('asyncResolveMtContent(): Execute process... 3') 
		// 	: null;

		// 	cb(false, data);
		// },
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