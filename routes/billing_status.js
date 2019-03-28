var async = require('async');
var express = require('express');
var router = express.Router();

var logger, mssql, debug;

router.get('/:product_name/:carrier_id/:page_size/:page_number', function(req, res, next) {
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
	asyncResolveBillingStatus(reqFull, (err, rs) => {
		var response = {};			
		if (!err){
			//aca preparar json de respuesta caso exitoso
			
			response['user_id'] = [0];

			response['status'] = {};
			response.status['code'] = 1;
			response.status['description'] = "string";

			res.status(200).send(response);
		}else{
			//aca preparar json de respuesta con error
			response['user_id'] = [];
			
			response['status'] = {};
			response.status['code'] = 99;
			response.status['description'] = "Invalid authorization header";
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
		debug
		? logger.debug('asyncResolveBillingStatus(): Execute process... 1') 
		: null;
		//valido si los parametros llegaron ok
		data.body && data.path.product_name && data.path.carrier_id && data.path.page_size && data.path.page_number && data.headers.authorization
		? cb(null, data)
		: cb(data, null);
	},
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveBillingStatus(): Execute process... 2') 
	// 	: null;

	// 	cb(null, data);
	// },
	// (data, cb) => {
	// 	debug
	// 	? logger.debug('asyncResolveBillingStatus(): Execute process... 3') 
	// 	: null;

	// 	cb(null, data);
	// },
	];

	//funcion final
	var final = (err, rs) => {
		debug
		? logger.debug('asyncResolveBillingStatus(): Execute final... ')
		: null;

		err
		? (() => {
			logger.debug('asyncResolveBillingStatus(): Error final... ');
			console.log(err);
			cb(err, rs);
		})()
		: cb(err, rs);
	};

	//registro vector funciones, funcion final
	async.waterfall(ini, final);	
}


module.exports = router;