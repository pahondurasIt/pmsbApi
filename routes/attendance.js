const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Ruta para obtener registros de asistencia
router.get('/', attendanceController.getAttendance);

// Ruta unificada para registrar entrada o salida
router.post('/register', attendanceController.registerAttendance);

// Ruta para obtener registros de despacho
router.post('/updatePermissionComment', attendanceController.updatePermissionComment);

module.exports = router;