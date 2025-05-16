const express = require('express');
const router = express.Router();
const citiesController = require('../controllers/citiesController');

router.get('/', citiesController.getCity);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
