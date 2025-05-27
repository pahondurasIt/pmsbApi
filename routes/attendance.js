const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.get('/:id/:fechaInicial/:fechaFinal', attendanceController.getRegistrosByEmp);
router.get('/empleadosActivos', attendanceController.getEmpleadosActivos);


module.exports = router;
