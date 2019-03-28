var async = require('async');
var express = require('express');
var router = express.Router();

var logger, mssql, debug;

router.post('/:product_name', function(req, res, next) {	
	logger = req.app.locals.logger;
	mssql = req.app.locals.mssql;
	debug = req.app.locals.debug;

	/**
	 * Ramiro Portas : #1
	 * (1) cargo a reqFull, parametros de tipo path y body
	 */
	 var reqFull = {}
	 reqFull.body = req.body
	 reqFull.path = req.params;
	 reqFull.headers = req.headers;
	//#1

	asyncResolveMtContent(reqFull, (err, rs) => {
		var response = {};			
		if (!err){
			//aca preparar json de respuesta caso exitoso
			
			response['result'] = {};
			response.result['code'] = 0;
			response.result['description'] = "string";
			response.result['server_response_id'] = "string";

			response['status'] = {};
			response.status['code'] = 1;
			response.status['description'] = "string";

			res.status(200).send(response);
		}else{
			//aca preparar json de respuesta con error
			response['result'] = {};
			
			response['status'] = {};
			response.status['code'] = 99;
			response.status['description'] = "Invalid authorization header";
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
		debug
		? logger.debug('asyncResolveMtContent(): Execute process... 1') 
		: null;

		//valido si los parametros llegaron ok
		data.body && data.path.product_name && data.headers.authorization
		? cb(null, data)
		: cb(data, null);
	},
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveMtContent(): Execute process... 2') 
	// 	: null;

	// 	cb(null, data);
	// },
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveMtContent(): Execute process... 3') 
	// 	: null;

	// 	cb(null, data);
	// },
	];

	//funcion final
	var final = (err, rs) => {
		debug
		? logger.debug('asyncResolveMtContent(): Execute final... ')
		: null;

		err
		? (() => {
			logger.debug('asyncResolveMtContent(): Error final... ');
			console.log(err);
			cb(err, rs);
		})()
		: cb(err, rs);
	};

	//registro vector funciones, funcion final
	async.waterfall(ini, final);	
}

module.exports = router;