const express = require('express');
const router = express.Router();
const bloodTypeController = require('../controllers/bloodTypeController');

router.get('/', bloodTypeController.getBloodType);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
