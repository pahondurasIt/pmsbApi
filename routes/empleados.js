const express = require('express');
const router = express.Router();
const empleadosController = require('../controllers/empleadosController');

router.get('/', empleadosController.getEmpleados);
router.post('/', empleadosController.createEmpleados);
router.put('/:id', empleadosController.updateEmpleados);
router.delete('/:id', empleadosController.deleteUsuario);

module.exports = router;
