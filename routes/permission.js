const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

// Ruta para obtener tipos de permisos y empleados
router.get('/', permissionController.getPermissionData);
// Ruta para todos los permisos
router.get('/allPermissions', permissionController.getAllPermissions);
router.get('/permissionsWithoutApproval', permissionController.getPermissionsWithoutApproval);
router.put('/paidPermission/:permissionID', permissionController.markPermissionAsPaid);

// Ruta para crear un permiso
router.post('/', permissionController.createPermission);
router.put('/approvedPermission/:permissionID', permissionController.approvedPermission);
router.delete('/:permissionID', permissionController.deletePermission);



module.exports = router;