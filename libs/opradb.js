
var utils = require('/var/node/libs/utils');

var opradb = {
	setOperator: function(operator){
		this.operator = operator;
	},
	setDB: function(db){
		this.db = db;
	},
	setLogger: function(logger){
		this.logger = logger;
	},
	setRedis: function(redis){
		this.redis = redis;
	},
	isActive: function(data, callback){
		var params = {
			Origen: data.msisdn,
			SuscripcionId: data.suscripcionid,
			PaqueteId: data.paqueteid
		}

		var self = this;
		this.db.execute(this.operator.db.isActive, params, function(rs) {
			if (rs && rs.length > 0 && typeof rs[0][0] != 'undefined'){
				if (typeof rs[0][0] != 'undefined'){
					self.logger.info('Subscription found, id: ' + rs[0][0]['SuscripcionId']);
					data.subscription = rs[0][0];
					callback(null, data);
				}else{
					self.logger.error('Subscription not found: ' + JSON.stringify(params));
					data.subscription = false;
					callback(null, data);
				}
			}else{
				self.logger.error('Subscription not found: ' + JSON.stringify(params));
				data.subscription = false;
				callback(null, data);
			}
		})
	},
	billingStatus: function(data, callback){
		var params = {
			SponsorId: data.sponsorid,
			PaqueteId: data.paqueteid,
			Interval: data.interval,
			Top: data.top
		}

		var self = this;
		this.db.execute(this.operator.db.billingStatus, params, function(rs) {
			if (rs && rs.length > 0 && typeof rs[0] != 'undefined'){
				if (typeof rs[0] != 'undefined'){
					self.logger.info('Subscription found, Array: ' + JSON.stringify(rs[0]));
					data.subscription = rs[0];
					callback(null, data);
				}else{
					self.logger.error('Subscription not found: ' + JSON.stringify(params));
					data.suscripcion = false;
					callback(null, data);
				}
			}else{
				self.logger.error('Subscription not found: ' + JSON.stringify(params));
				data.suscripcion = false;
				callback(null, data);
			}
		})
	},
	insertMT: function(data, callback){
		var params = {
			EntradaId: data.entradaid,
			Origen: data.shortcode,
			Destino: data.msisdn,
			AplicacionId: data.aplicacionid,
			MedioId: data.medioid,
			Contenido: data.contenido,
			NoCharge: data.nocharge || 0,
			EstadoEsId: data.estadoesid || 3,
			SuscripcionId: data.suscripcionid,
			Relacion: data.mds || 0,
			Prioridad: data.prioridad || 5,
			SponsorId: data.sponsorid,
			Rebotado: data.rebotado || 0
		}
		this.logger.debug('Inserting MT: ' + JSON.stringify(params));
		var self = this;
		this.db.execute(this.operator.db.setMT, params, function(rs) {
			if (rs) {
				if (rs.length == 1) var salidaId = rs[0][0]["SalidaId"];
				if (rs.length > 1)  var salidaId = rs[1][0]["SalidaId"];
				data.salidaid = salidaId;
				callback(null, data);
			}else{
				self.logger.error('Error inserting MT: ' + JSON.stringify(params));
				callback(true, data);
			}
		});
	}
}

module.exports = opradb;
