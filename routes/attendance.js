const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');


router.get('/', attendanceController.getAttendance );
// NUEVA RUTA UNIFICADA para registrar entrada o salida
router.post('/register', attendanceController.registerAttendance);

module.exports = router;