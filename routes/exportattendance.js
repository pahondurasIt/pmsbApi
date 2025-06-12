const express = require('express');
const router = express.Router();
const exportattendanceController = require('../controllers/exportattendanceController');

// Ruta para exportar asistencia a Excel
router.post('/', exportattendanceController.exportAttendance);
// Añade esta línea para definir la ruta de exportación semanal
router.post('/exportweeklyattendance', exportattendanceController.exportWeeklyAttendance);


module.exports = router;