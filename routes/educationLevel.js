const express = require('express');
const router = express.Router();
const educationLevelController = require('../controllers/educationLevelController');

router.get('/', educationLevelController.getEducationLevel);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
