const express = require('express');
const router = express.Router();
const usercompanyController = require('../controllers/usercompanyController');

router.get('/', usercompanyController.getuserCompany);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
