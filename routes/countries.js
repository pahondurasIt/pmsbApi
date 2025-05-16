const express = require('express');
const router = express.Router();
const countriesController = require('../controllers/countriesController');

router.get('/', countriesController.getCountries);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
