const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

router.get('/', usuariosController.getUsuarios);

/* Agregar los demas metodos */

/*




*/

module.exports = router;
