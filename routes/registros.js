const express = require('express');
const router = express.Router();
const registrosController = require('../controllers/registrosController');

router.get('/attendanceReport/:fechaInicial/:fechaFinal', registrosController.getAttendanceReport);
router.get('/:id/:fechaInicial/:fechaFinal', registrosController.getRegistrosByEmp);
router.get('/empleadosActivos', registrosController.getEmpleadosActivos);


module.exports = router;
