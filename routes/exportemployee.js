const express = require('express');
const router = express.Router();
const exportEmployeeController = require('../controllers/exportEmployeeController');

// Ruta para exportar asistencia a Excel
router.get('/', exportEmployeeController.exportEmployee);


module.exports = router;