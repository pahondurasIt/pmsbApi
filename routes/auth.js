// auth.js (o routes/authRoutes.js, dependiendo de tu estructura)
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Ajusta la ruta si es necesario

// Ruta para el inicio de sesión
router.post('/', authController.login);

// Puedes añadir otras rutas relacionadas con la autenticación aquí, como /register, /logout, etc.

module.exports = router;