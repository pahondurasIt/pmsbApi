const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

// Ruta para obtener datos iniciales (tipos de permiso y empleados)
router.get('/', permissionController.getPermissionData );

// Ruta para autorizar/crear un nuevo permiso desde el formulario
router.post('/authorize', permissionController.authorizePermission);


module.exports = router;

