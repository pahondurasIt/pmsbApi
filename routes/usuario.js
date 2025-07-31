const express = require('express');
const router = express.Router();
const userController = require('../controllers/usuariosController');

router.get('/', userController.getUsuarios);

// Obtener permisos de los usuarios
router.get('/permissions', userController.getPermissions);
router.get('/permissionsByUser/:userID', userController.getPermissionById);
router.post('/userProfile', userController.createProfileByUser);

router.get('/modules', userController.getModules);
router.get('/screens/:moduleID', userController.getScreens);
module.exports = router;