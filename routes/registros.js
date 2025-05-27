const express = require('express');
const router = express.Router();
const registrosController = require('../controllers/registrosController');

router.get('/:id/:fechaInicial/:fechaFinal', registrosController.getRegistrosByEmp);
router.get('/empleadosActivos', registrosController.getEmpleadosActivos);


module.exports = router;
