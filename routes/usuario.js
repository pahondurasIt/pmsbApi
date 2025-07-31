const express = require("express");
const router = express.Router();
const userController = require("../controllers/usuariosController");

router.get("/", userController.getUsuarios);
router.post("/createuser", userController.createuser); // Ruta para crear un usuario
router.get("/user-list", userController.getAllUsers);

// Obtener permisos de los usuarios
router.get("/permissions", userController.getPermissions);
router.get("/permissionsByUser/:userID", userController.getPermissionById);
router.post("/userProfile", userController.createProfileByUser);

module.exports = router;
