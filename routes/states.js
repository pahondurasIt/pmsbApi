const express = require('express');
const router = express.Router();
const statesController = require('../controllers/statesController');

router.get('/', statesController.getStates);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
