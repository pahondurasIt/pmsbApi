const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

// Ruta para obtener tipos de permisos y empleados
router.get('/', permissionController.getPermissionData);
// Ruta para todos los permisos
router.get('/allPermissions', permissionController.getAllPermissions);
router.put('/paidPermission/:permissionID', permissionController.markPermissionAsPaid);

// Ruta para autorizar un permiso
router.post('/authorize', permissionController.authorizePermission);


module.exports = router;