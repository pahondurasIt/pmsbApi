const express = require('express');
const router = express.Router();
const userController = require('../controllers/usuariosController');

router.get('/', userController.getUsuarios);

// Obtener permisos de los usuarios
router.get('/permissions', userController.getPermissions);

module.exports = router;