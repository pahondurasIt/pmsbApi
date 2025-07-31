// auth.js (o routes/authRoutes.js, dependiendo de tu estructura)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Ajusta la ruta si es necesario

// Ruta para el inicio de sesión
router.post('/', authController.login);

router.post('/login-despacho', authController.loginDespacho); // Ruta para verificar el estado del usuario

// Ruta para obtener todas las compañias
router.get("/companies", authController.getAllCompanies);


module.exports = router;