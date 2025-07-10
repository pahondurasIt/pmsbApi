const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Ruta para obtener registros de asistencia
router.get('/', attendanceController.getAttendance);

// Ruta unificada para registrar entrada o salida
router.post('/register', attendanceController.registerAttendance);

// Ruta para obtener registros de despacho
router.post('/updatePermissionComment', attendanceController.updatePermissionComment);

//Ruta para poder actualizar las horas de las tablas:
router.post('/updateTime',attendanceController.updateTimeAttendance );

module.exports = router;