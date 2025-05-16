const express = require('express');
const router = express.Router();
const transportationController = require('../controllers/transportationController');

router.get('/', transportationController.getTransportation);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
