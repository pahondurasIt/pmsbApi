const express = require("express");
const router = express.Router();
const userController = require("../controllers/usuariosController");

router.get("/", userController.getUsuarios);
router.post("/createuser", userController.createuser); // Ruta para crear un usuario
router.get("/user-list", userController.getAllUsers);
router.get("/userData/:userID", userController.getUserById);
router.put("/updateuser/:userID", userController.updateUserById);

// Obtener permisos de los usuarios
router.get("/permissions", userController.getPermissions);
router.get("/permissionsByUser/:userID", userController.getPermissionById);
router.post("/userProfile", userController.createProfileByUser);

router.get('/modules', userController.getModules);
router.get('/screens/:moduleID', userController.getScreens);
router.get('/permissions-by-screen/:screenID', userController.getScreensByPermission);

router.post('/create-permission', userController.createPermission);
router.post('/create-screen', userController.createScreen);
router.post('/create-module', userController.createModule);

router.get('/active_user', userController.getActiveUsers)
router.post('/change_password',userController.adminChangePassword)

module.exports = router;