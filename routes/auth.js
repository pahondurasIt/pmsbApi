// auth.js (o routes/authRoutes.js, dependiendo de tu estructura)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Ajusta la ruta si es necesario

// Ruta para el inicio de sesión
router.post('/', authController.login);

router.post('/login-despacho', authController.loginDespacho); // Ruta para verificar el estado del usuario

// Puedes añadir otras rutas relacionadas con la autenticación aquí, como /register, /logout, etc.
router.get('/user-list', authController.getAllUsers); 

// Ruta para obtener todas las compañias
router.get("/companies", authController.getAllCompanies);

// Ruta para crear un usuario en la base de datos
router.post('/createuser', authController.createuser); // Ruta para crear un usuario


module.exports = router;