var async = require('async');
var express = require('express');
var router = express.Router();

var logger, mssql;

router.get('/:product_name/:carrier_id/:page_size/:page_number', function(req, res, next) {
    logger = req.app.locals.logger;
    mssql = req.app.locals.mssql;

    console.log(req.params);
    res.sendStatus(200);
})

module.exports = router;