const express = require('express');
const router = express.Router();
const maritalStatusController = require('../controllers/maritalStatusController');

router.get('/', maritalStatusController.getMarital);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
